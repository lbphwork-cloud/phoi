'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Spinner } from '@/components/site';
import { useAsyncData, useAuth, useTaxonomy } from '@/lib/hooks';
import { formatRelative } from '@/lib/format';
import {
  MODEL_TYPES, SCENES, buildImagePrompt, requestAiImage,
  type AiProviderId,
} from '@/lib/aiImage';
import { ITEM_ROLE_LABEL } from '@/lib/supabase/types';
import type {
  AiCredentialPublic, AiProvider, OutfitWithItems,
} from '@/lib/supabase/types';

/**
 * Khe cam AI theo mo hinh BYOK — ban tu nhap API key cua chinh ban.
 *
 * VI SAO THIET KE THE NAY:
 *   - Khong ai phai tra tien AI thay ban, va ban khong bi khoa vao mot nha cung
 *     cap nao.
 *   - Gemini co goi mien phi cho tao anh (khoang 500 anh/ngay, khong can the
 *     tin dung) — nhieu hon nhu cau cua mot nguoi van hanh gap nhieu lan.
 *
 * KEY DUOC GIU NHU THE NAO:
 *   1. Ban dan key tho vao o duoi. Trinh duyet gui no cho Edge Function
 *      `ai-credentials` qua HTTPS.
 *   2. Edge Function ma hoa key roi ghi vao bang. Key tho khong bao gio duoc
 *      luu.
 *   3. Cot encrypted_key da bi REVOKE quyen SELECT o migration 0002, nen ngay
 *      ca chinh ban cung khong doc lai duoc qua API. Giao dien chi hien key_hint.
 *   4. Chi Edge Function (dung service role) moi giai ma duoc de goi nha cung cap.
 *
 * Giai doan dau CHI admin dung duoc. Mo cho nguoi dung thuong la mot trach
 * nhiem phap ly that (neu ro ri, ho mat tien), nen doi tori khi ban san sang
 * nhan trach nhiem do. Schema va Edge Function da chuan bi san.
 */

const PROVIDERS: Array<{
  id: AiProvider;
  label: string;
  note: string;
  keyHint: string;
  free: boolean;
}> = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    // KHONG ghi "co goi mien phi cho tao anh" nua — do la mot cau sai.
    // Goi mien phi cua Gemini cho TAO CHU; han muc TAO ANH bang 0.
    note: 'Gói miễn phí viết chữ được nhưng không dựng ảnh được (hạn mức ảnh bằng 0). '
      + 'Muốn dựng ảnh phải bật thanh toán trên Google Cloud. Lấy key ở aistudio.google.com.',
    // Khong dung "AIza..." lam goi y trong o nhap: no nhin y het mot key that
    // da duoc dien san, va chu website da hieu nham dung nhu vay.
    keyHint: 'Dán key của bạn vào đây',
    free: false,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    note: 'Tạo ảnh là dịch vụ trả tiền, tính theo từng ảnh. Lấy key ở platform.openai.com.',
    keyHint: 'Dán key của bạn vào đây',
    free: false,
  },
  {
    id: 'local_comfyui',
    label: 'ComfyUI trên máy cá nhân',
    note: 'Không cần key. Local Helper sẽ nhận việc từ hàng đợi ai_jobs và chạy trên máy bạn.',
    keyHint: 'Không cần key',
    free: true,
  },
];

interface AiJob {
  id: string;
  provider: AiProvider;
  prompt: string;
  status: string;
  result_urls: string[];
  error: string | null;
  created_at: string;
}

export default function AdminAiPage() {
  const { session } = useAuth();

  const [creds, setCreds] = useState<AiCredentialPublic[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [rawKey, setRawKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    let alive = true;
    Promise.all([
      // KHONG select('*') — cot encrypted_key bi thu hoi quyen doc, select('*')
      // se loi. Phai liet ke tung cot duoc phep.
      sb.from('ai_credentials')
        .select('id, owner_id, provider, key_hint, is_active, last_used_at, created_at'),
      sb.from('ai_jobs').select('*').order('created_at', { ascending: false }).limit(20),
    ]).then(([c, j]) => {
      if (!alive) return;
      if (c.error) setError(c.error.message);
      setCreds((c.data as AiCredentialPublic[]) ?? []);
      setJobs((j.data as AiJob[]) ?? []);
      setLoading(false);
    });

    return () => { alive = false; };
  }, [nonce]);

  const saveKey = async () => {
    const sb = getSupabase();
    if (!sb || !session) return;

    if (provider !== 'local_comfyui' && rawKey.trim().length < 20) {
      setError('Key trông không đúng — quá ngắn.');
      return;
    }

    setBusy(true);
    setError(null);
    setMsg(null);

    try {
      const { data, error: e } = await sb.functions.invoke('ai-credentials', {
        body: { action: 'save', provider, key: rawKey.trim() },
      });

      if (e) throw new Error(e.message);
      const r = data as { ok: boolean; error?: string };
      if (!r?.ok) throw new Error(r?.error ?? 'Không lưu được key.');

      setRawKey('');
      setMsg('Đã lưu key. Từ giờ chỉ hiện phần gợi nhớ, không đọc lại được key gốc.');
      setNonce((n) => n + 1);
    } catch (err) {
      setError(
        `${(err as Error).message}. Nếu chưa triển khai Edge Function "ai-credentials", ` +
          'xem hướng dẫn trong supabase/functions/README.md.',
      );
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: AiCredentialPublic) => {
    const sb = getSupabase()!;
    setBusy(true);
    const { error: e } = await sb
      .from('ai_credentials')
      .update({ is_active: !c.is_active })
      .eq('id', c.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    setNonce((n) => n + 1);
  };

  const remove = async (c: AiCredentialPublic) => {
    if (!window.confirm('Xoá key này? Không thể hoàn lại.')) return;
    const sb = getSupabase()!;
    setBusy(true);
    const { error: e } = await sb.from('ai_credentials').delete().eq('id', c.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    setNonce((n) => n + 1);
  };

  if (loading) return <Spinner />;

  const active = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div className="flex flex-col gap-14">
      <section>
        <h1 className="display-sm mb-1">Tạo ảnh bằng AI</h1>
        <p className="muted mb-6 max-w-2xl text-sm leading-relaxed">
          Hiện tại bạn tự làm ảnh và tải lên bằng tay — cách đó vẫn luôn dùng được
          và không cần gì ở trang này. Khi muốn tự động hoá, nhập API key của
          chính bạn vào đây rồi bật lên.
        </p>

        <div className="notice mb-8">
          <p className="eyebrow mb-2">Ảnh AI luôn phải qua kiểm duyệt</p>
          <p className="muted text-sm leading-relaxed">
            Mọi ảnh do AI tạo đều lưu ở dạng bản nháp, phải được duyệt tay trước khi
            đăng, và bài hiển thị nhãn &quot;Ảnh tạo bởi AI&quot; kèm lưu ý rằng ảnh không
            đảm bảo giống tuyệt đối sản phẩm thật. Đây là quy tắc cố định, không có
            công tắc tắt.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="display-xs mb-4">Thêm API key</h2>

        <div className="mb-4 flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              aria-pressed={provider === p.id}
              onClick={() => setProvider(p.id)}
            >
              {p.label}
              {p.free && <span className="tag tag-ok">có gói free</span>}
            </button>
          ))}
        </div>

        <p className="muted-2 mb-4 text-sm">{active.note}</p>

        {provider !== 'local_comfyui' && (
          <>
            <label className="label" htmlFor="key">API key</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="key"
                type="password"
                value={rawKey}
                onChange={(e) => setRawKey(e.target.value)}
                className="field"
                placeholder={active.keyHint}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-sm shrink-0"
                disabled={busy || !rawKey.trim()}
                onClick={saveKey}
              >
                {busy ? 'Đang lưu…' : 'Lưu key'}
              </button>
            </div>
            <p className="hint">
              Key được mã hoá trước khi lưu và không bao giờ trả lại trình duyệt.
              Sau khi lưu, bạn chỉ thấy vài ký tự đầu và cuối để nhận diện.
            </p>
          </>
        )}

        {msg && <div className="notice notice-ok mt-4">{msg}</div>}
        {error && <div className="notice notice-danger mt-4">{error}</div>}
      </section>

      {/* ------------------------------------------------------------------ */}
      <ImageGenerator activeProviders={creds.filter((c) => c.is_active).map((c) => c.provider)} />

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="display-xs mb-4">Key đã lưu</h2>
        {creds.length === 0 ? (
          <p className="muted-2 text-sm">Chưa có key nào. Ảnh vẫn tải lên tay được bình thường.</p>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th>Key</th>
                  <th>Trạng thái</th>
                  <th>Dùng lần cuối</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {creds.map((c) => (
                  <tr key={c.id}>
                    <td>{PROVIDERS.find((p) => p.id === c.provider)?.label ?? c.provider}</td>
                    <td><code className="text-xs">{c.key_hint}</code></td>
                    <td>
                      <span className={`tag ${c.is_active ? 'tag-ok' : 'tag-quiet'}`}>
                        {c.is_active ? 'Đang bật' : 'Đã tắt'}
                      </span>
                    </td>
                    <td className="muted-2 text-xs">
                      {c.last_used_at ? formatRelative(c.last_used_at) : 'chưa dùng'}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          disabled={busy}
                          onClick={() => toggle(c)}
                        >
                          {c.is_active ? 'Tắt' : 'Bật'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          disabled={busy}
                          onClick={() => remove(c)}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="display-xs mb-4">Việc tạo ảnh gần đây</h2>
        {jobs.length === 0 ? (
          <p className="muted-2 text-sm">Chưa có yêu cầu tạo ảnh nào.</p>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Nhà cung cấp</th>
                  <th>Mô tả</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="muted-2 whitespace-nowrap text-xs">{formatRelative(j.created_at)}</td>
                    <td className="text-xs">{j.provider}</td>
                    <td className="text-xs">{j.prompt.slice(0, 90)}{j.prompt.length > 90 && '…'}</td>
                    <td>
                      <span className={`tag ${j.status === 'done' ? 'tag-ok' : j.status === 'failed' ? 'tag-danger' : 'tag-warn'}`}>
                        {j.status}
                      </span>
                      {j.error && <span className="hint-error block text-xs">{j.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


/**
 * Khu tao anh.
 *
 * Cau lenh duoc DUNG TU DU LIEU cua set do (phong cach, dip, mau, cac mon) roi
 * cho phep sua truoc khi gui. Lam vay de 20 set do ra 20 anh cung mot ngon ngu
 * hinh anh, chu khong phai 20 phong cach khac nhau.
 *
 * Anh tra ve la BAN NHAP: hien ra de bạn xem, va bạn tu bam gan vao set do.
 * Khong tu dong gan — day la mot phan cua quy tac "anh AI luon qua kiem duyet tay".
 */
function ImageGenerator({ activeProviders }: { activeProviders: AiProvider[] }) {
  const tax = useTaxonomy();

  const [outfitId, setOutfitId] = useState('');
  const [sceneId, setSceneId] = useState<string>(SCENES[0].id);
  const [modelTypeId, setModelTypeId] = useState<string>(MODEL_TYPES[1].id);
  const [provider, setProvider] = useState<AiProviderId>('gemini');
  const [modelName, setModelName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [edited, setEdited] = useState(false);

  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Chi lay outfit dang can anh: chua co anh dai dien, hoac dang o ban nhap.
  const { data: outfits } = useAsyncData<OutfitWithItems[]>('ai-outfits', (sb) =>
    sb
      .from('outfits')
      .select('*, outfit_items(*, products(*), affiliate_links(*))')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => ({
        data: (data as OutfitWithItems[] | null) ?? [],
        error,
      })),
  );

  const selected = (outfits ?? []).find((o) => o.id === outfitId) ?? null;

  /** Dung lai cau lenh tu set do dang chon. Ghi de phan da sua tay. */
  const rebuild = () => {
    if (!selected) return;
    const items = (selected.outfit_items ?? [])
      .filter((it) => it.products)
      .map((it) => ({
        roleLabel: ITEM_ROLE_LABEL[it.role],
        name: it.products!.name,
        colorLabel: it.products!.color_slug
          ? tax.colorLabel(it.products!.color_slug)
          : undefined,
      }));

    setPrompt(
      buildImagePrompt({
        outfitTitle: selected.title,
        styleLabel: tax.styleLabel(selected.style_slug),
        occasionLabel: tax.occasionLabel(selected.occasion_slug),
        colorLabels: selected.color_slugs.map((c) => tax.colorLabel(c)),
        items,
        sceneId,
        modelTypeId,
      }),
    );
    setEdited(false);
  };

  const generate = async () => {
    if (!prompt.trim()) { setErr('Chưa có mô tả. Chọn set đồ rồi bấm "Dựng mô tả".'); return; }

    setBusy(true);
    setErr(null);
    setMsg(null);
    setUrls([]);

    const r = await requestAiImage({
      provider,
      prompt,
      outfitId: outfitId || null,
      model: modelName.trim() || undefined,
    });

    setBusy(false);
    if (!r.ok) { setErr(r.message); return; }
    setUrls(r.urls);
    setMsg(r.message);
  };

  /**
   * Gan anh vao set do.
   *
   * Neu set do DA duoc dang, trigger trong database se tu dong dua no ve trang
   * thai cho duyet — ke ca khi admin lam. Day dung la hanh vi mong doi: doi anh
   * la doi noi dung nguoi xem thay.
   */
  const attach = async (url: string) => {
    const sb = getSupabase();
    if (!sb || !selected) return;

    setAttaching(true);
    const { error } = await sb
      .from('outfits')
      .update({ hero_image_url: url, ai_generated: true, ai_provider: provider })
      .eq('id', selected.id);
    setAttaching(false);

    if (error) { setErr(error.message); return; }
    setMsg(
      `Đã gán ảnh vào "${selected.title}". Bài mang nhãn "Ảnh tạo bởi AI". ` +
        'Kiểm tra lại trong trang Kiểm duyệt trước khi đăng.',
    );
  };

  const noKey = !activeProviders.includes(provider);

  return (
    <section>
      <h2 className="display-xs mb-1">Tạo ảnh cho set đồ</h2>
      <p className="muted-2 mb-6 text-sm">
        Mô tả được dựng từ dữ liệu set đồ để ảnh giữa các bài nhìn liền mạch. Bạn
        sửa được trước khi gửi.
      </p>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ai-outfit">Set đồ</label>
          <select
            id="ai-outfit"
            value={outfitId}
            onChange={(e) => { setOutfitId(e.target.value); setEdited(false); }}
            className="field"
          >
            <option value="">— Chọn set đồ —</option>
            {(outfits ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.hero_image_url ? '' : '[chưa có ảnh] '}
                {o.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ai-scene">Bối cảnh</label>
          <select
            id="ai-scene"
            value={sceneId}
            onChange={(e) => setSceneId(e.target.value)}
            className="field"
          >
            {SCENES.map((sc) => <option key={sc.id} value={sc.id}>{sc.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ai-model">Kiểu người mẫu</label>
          <select
            id="ai-model"
            value={modelTypeId}
            onChange={(e) => setModelTypeId(e.target.value)}
            className="field"
          >
            {MODEL_TYPES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ai-prov">Nhà cung cấp</label>
          <select
            id="ai-prov"
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiProviderId)}
            className="field"
          >
            <option value="gemini">Google Gemini (có gói free)</option>
            <option value="openai">OpenAI (trả tiền)</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ai-modelname">Tên mô hình (tuỳ chọn)</label>
          <input
            id="ai-modelname"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="field"
            placeholder={provider === 'gemini' ? 'gemini-2.5-flash-image' : 'gpt-image-1'}
          />
          <p className="hint">
            Google đổi tên mô hình ảnh khá thường xuyên. Nếu báo lỗi không tìm thấy
            mô hình, điền tên mới vào đây.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm" disabled={!selected} onClick={rebuild}>
          Dựng mô tả từ set đồ
        </button>
        {prompt && !edited && (
          <span className="muted-2 self-center text-xs">
            Mô tả đã dựng. Sửa trực tiếp bên dưới nếu muốn.
          </span>
        )}
      </div>

      <label className="label" htmlFor="ai-prompt">Mô tả gửi cho AI</label>
      <textarea
        id="ai-prompt"
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value); setEdited(true); }}
        className="field mb-2"
        rows={7}
        maxLength={4000}
        placeholder="Chọn set đồ rồi bấm &quot;Dựng mô tả từ set đồ&quot;."
      />
      <p className="hint mb-5">
        {prompt.length}/4000 ký tự. Mô tả viết bằng tiếng Anh vì các mô hình tạo
        ảnh hiểu tiếng Anh tốt hơn nhiều.
      </p>

      {noKey && (
        <div className="notice notice-warn mb-4">
          Chưa có API key đang bật cho {provider === 'gemini' ? 'Gemini' : 'OpenAI'}.
          Nhập key ở mục trên rồi quay lại.
        </div>
      )}

      <button
        type="button"
        className="btn btn-solid"
        disabled={busy || !prompt.trim() || noKey}
        onClick={generate}
      >
        {busy ? 'Đang tạo ảnh…' : 'Tạo ảnh'}
      </button>

      {msg && <div className="notice notice-ok mt-4">{msg}</div>}
      {err && <div className="notice notice-danger mt-4">{err}</div>}

      {urls.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-3">Kết quả — bản nháp, chưa gán vào bài nào</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {urls.map((u) => (
              <div key={u}>
                <div className="frame mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="Ảnh do AI tạo" />
                </div>
                <button
                  type="button"
                  className="btn btn-sm w-full"
                  disabled={attaching || !selected}
                  onClick={() => attach(u)}
                >
                  Gán vào set đồ
                </button>
              </div>
            ))}
          </div>

          <div className="notice notice-warn mt-4">
            Ảnh AI không giữ chính xác logo, chữ in và hoạ tiết nhỏ, và thường lệch
            màu nhẹ. Đây là giới hạn cố hữu của mô hình, không phải lỗi cấu hình.
            Ảnh sản phẩm thật lấy từ link vẫn là thứ người mua dựa vào để quyết định.
          </div>
        </div>
      )}
    </section>
  );
}
