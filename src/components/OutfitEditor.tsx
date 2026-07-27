'use client';

/**
 * Trinh soan set do. Dung chung cho ca trang /tao-bai cua nguoi dung va trang
 * /admin/outfit cua quan tri vien — chi khac o quyen, ma quyen thi do RLS va
 * trigger trong database quyet dinh, khong phai do component nay.
 *
 * Luong luu:
 *   1. Upload anh (neu co) len Supabase Storage, thu muc mang ten user id.
 *   2. Tao/cap nhat dong outfits.
 *   3. Voi tung san pham: tao dong products, roi affiliate_links, roi outfit_items.
 *   4. Neu bam "gui duyet" thi dat status = 'pending'.
 *
 * Luu y quan trong: tac gia KHONG the tu dat status = 'published'. Trigger
 * enforce_outfit_status() trong database chan viec do. Component nay khong co
 * nut nao lam duoc dieu do ca, nhung cho du co thi database van tu choi.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';
import { useAuth, useTaxonomy, useRateLimit } from '@/lib/hooks';
import { checkAffiliateUrl } from '@/lib/affiliate';
import {
  fetchProductFromUrl, guessCategory, platformFromUrl, roleFromCategory,
} from '@/lib/fetchProduct';
import { formatVnd, IMAGE_LIMITS, validateImageFile } from '@/lib/format';
import { uploadImage } from '@/lib/storage';
import {
  SCENES, MODEL_TYPES, buildImagePrompt, requestAiImage,
  buildDescriptionPrompt, requestAiDescription, explainPromptVi,
  type AiProviderId,
} from '@/lib/aiImage';
import { CATEGORY_LABEL, ITEM_ROLE_LABEL } from '@/lib/supabase/types';
import type { ItemRole, Platform, ProductCategory } from '@/lib/supabase/types';

interface DraftItem {
  /** Khoa tam trong giao dien, khong phai id trong database */
  key: string;
  name: string;
  category: ProductCategory;
  role: ItemRole;
  colorSlug: string;
  priceVnd: string;
  imageUrl: string;
  affiliateUrl: string;
  platform: Platform | null;
  /**
   * Du lieu tori tu dau. Dung ten thay vi so vi tung co bug o day: gia tri 0
   * (tien ich Chrome) la falsy nen bi hien thanh loi mau do.
   */
  source: 'edge' | 'helper' | 'extension' | null;
  fetchNote: string;
  busy: boolean;
}

/**
 * Doc du lieu san pham do tien ich Chrome gui tori qua phan hash cua URL.
 *
 * Tien ich mo trang nay voi #phoi=<base64 JSON>. Dat o HASH chu khong phai
 * query string la co y: phan hash KHONG duoc gui len may chu trong yeu cau
 * HTTP, nen du lieu san pham khong nam trong log truy cap cua Cloudflare hay
 * bat ky may chu trung gian nao.
 *
 * Ham nay o cap module (khong nam trong component) de goi duoc tu ham khoi tao
 * state — nho vay form co du lieu ngay tu lan render dau, khong can effect.
 */
function readExtensionPayload(): { item: DraftItem | null; error: string | null } {
  if (typeof window === 'undefined') return { item: null, error: null };

  const m = /[#&]phoi=([^&]+)/.exec(window.location.hash);
  if (!m) return { item: null, error: null };

  try {
    const raw = decodeURIComponent(escape(atob(m[1])));
    const d = JSON.parse(raw) as {
      name?: string;
      price_vnd?: number | null;
      image_url?: string | null;
      url?: string;
      platform?: Platform | null;
    };

    if (!d?.name || !d?.url) return { item: null, error: null };

    // Kiem tra ten mien ngay ca voi du lieu tu tien ich cua chinh minh: tien ich
    // co the bi sua, va hash trong URL thi ai cung go duoc bang tay.
    const check = checkAffiliateUrl(d.url);
    if (!check.ok) {
      return { item: null, error: `Tiện ích gửi một link không hợp lệ: ${check.message}` };
    }

    const cat = guessCategory(d.name) as ProductCategory;

    return {
      item: {
        ...newItem(),
        name: d.name,
        category: cat,
        role: roleFromCategory(cat) as ItemRole,
        priceVnd: d.price_vnd ? String(d.price_vnd) : '',
        imageUrl: d.image_url ?? '',
        affiliateUrl: d.url,
        platform: d.platform ?? check.platform,
        source: 'extension',
        fetchNote: 'Nhận từ tiện ích Chrome. Kiểm tra lại giá rồi bổ sung màu.',
      },
      error: null,
    };
  } catch {
    return {
      item: null,
      error: 'Không đọc được dữ liệu từ tiện ích Chrome. Bạn nhập tay nhé.',
    };
  }
}

let keySeq = 0;
const newItem = (): DraftItem => ({
  key: `item-${++keySeq}`,
  name: '', category: 'ao', role: 'top', colorSlug: '',
  priceVnd: '', imageUrl: '', affiliateUrl: '', platform: null,
  source: null, fetchNote: '', busy: false,
});

export function OutfitEditor({ asAdmin = false }: { asAdmin?: boolean }) {
  const router = useRouter();
  const { session } = useAuth();
  const tax = useTaxonomy();
  const limitSubmit = useRateLimit('submit-outfit', 10, 60 * 60 * 1000);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [styleSlug, setStyleSlug] = useState('');
  const [occasionSlug, setOccasionSlug] = useState('');
  const [colorSlugs, setColorSlugs] = useState<string[]>([]);
  const [aiGenerated, setAiGenerated] = useState(false);

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string>('');
  const [heroError, setHeroError] = useState<string | null>(null);

  // Anh tung mon: tai len ngay, nen can biet mon nao dang tai.
  const [itemUploading, setItemUploading] = useState<string | null>(null);
  const [itemUploadError, setItemUploadError] = useState<string | null>(null);

  // Tao anh bang AI. `heroUrlDirect` la anh AI da chon: no da nam tren
  // Storage roi nen khong phai tai len lai luc luu.
  const [aiProvider, setAiProvider] = useState<AiProviderId>('gemini');
  const [sceneId, setSceneId] = useState<string>(SCENES[0].id);
  const [modelTypeId, setModelTypeId] = useState<string>(MODEL_TYPES[1].id);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiUrls, setAiUrls] = useState<string[]>([]);
  const [heroUrlDirect, setHeroUrlDirect] = useState<string>('');
  const [descBusy, setDescBusy] = useState(false);
  const [descMessage, setDescMessage] = useState<string | null>(null);
  const [showPromptVi, setShowPromptVi] = useState(false);

  // Doc du lieu tu tien ich Chrome NGAY TRONG ham khoi tao state.
  //
  // Truoc day viec nay nam trong useEffect va goi setItems — tuc la setState
  // dong bo trong effect, cong them mot vong render du thua va mot khoanh khac
  // form hien trong roi moi dien. Doc trong ham khoi tao thi form co du lieu
  // ngay tu lan render dau.
  const [extension] = useState(readExtensionPayload);
  const [items, setItems] = useState<DraftItem[]>(() =>
    extension.item ? [extension.item] : [newItem()],
  );
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(extension.error);

  const patch = (key: string, p: Partial<DraftItem>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  // Don hash sau khi da doc, de bam tai lai trang khong dien lai lan nua.
  // history.replaceState la tac dong ra ngoai React, khong phai setState — nen
  // dat trong effect la dung cho.
  useEffect(() => {
    if (window.location.hash.includes('phoi=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Anh dai dien
  // -------------------------------------------------------------------------

  const pickHero = (f: File | null) => {
    setHeroError(null);
    if (!f) { setHeroFile(null); setHeroPreview(''); return; }

    // Kiem tra o day chi de bao loi som. Gioi han THAT nam o cap bucket
    // Supabase (file_size_limit + allowed_mime_types trong 0004_storage.sql).
    const v = validateImageFile(f, IMAGE_LIMITS.outfit);
    if (!v.ok) { setHeroError(v.message); return; }

    setHeroFile(f);
    setHeroPreview(URL.createObjectURL(f));
  };

  const uploadHero = async (uid: string): Promise<string | null> => {
    if (!heroFile) return null;
    const r = await uploadImage('outfit-images', uid, heroFile);
    if (!r.ok) throw new Error(r.message);
    return r.url;
  };

  /**
   * Tai anh cho MOT mon len ngay lap tuc.
   *
   * Khac anh dai dien: anh dai dien doi den luc bam Luu moi tai len, vi luc do
   * moi biet bai co duoc tao khong. Anh tung mon tai ngay de nguoi dung thay
   * duoc no truoc khi bam tao anh AI — cai nut do can co anh that de tham chieu.
   */
  /**
   * Goi AI dung anh set do tu chinh du lieu dang nhap trong form.
   *
   * Cau lenh duoc dung tu ten cac mon, mau, phong cach va dip — nen anh ra bam
   * theo bai nay chu khong phai mot anh thoi trang chung chung.
   */
  /** Du lieu dung chung cho ca cau lenh tao anh lan cau lenh viet mo ta. */
  const promptInput = () => ({
    outfitTitle: title,
    styleLabel: tax.styleLabel(styleSlug),
    occasionLabel: tax.occasionLabel(occasionSlug),
    colorLabels: colorSlugs.map((s) => tax.colorLabel(s)),
    items: items
      .filter((i) => i.name.trim())
      .map((i) => ({
        roleLabel: ITEM_ROLE_LABEL[i.role],
        name: i.name.trim(),
        colorLabel: i.colorSlug ? tax.colorLabel(i.colorSlug) : undefined,
      })),
    sceneId,
    modelTypeId,
  });

  /** AI viet mo ta bang tieng Viet. Ket qua la BAN NHAP, nguoi dung sua lai. */
  const generateDescription = async () => {
    setDescBusy(true);
    setDescMessage(null);
    const r = await requestAiDescription({
      provider: aiProvider,
      prompt: buildDescriptionPrompt(promptInput()),
    });
    setDescBusy(false);
    setDescMessage(r.message);
    if (r.ok && r.text) setDescription(r.text);
  };

  const generateAiImage = async () => {
    setAiBusy(true);
    setAiMessage(null);

    const prompt = buildImagePrompt(promptInput());

    const r = await requestAiImage({ provider: aiProvider, prompt });
    setAiBusy(false);
    setAiMessage(r.message);

    if (r.ok && r.urls.length > 0) setAiUrls(r.urls);
  };

  const uploadItemImage = async (it: DraftItem, file: File) => {
    const userId = session?.user.id;
    if (!userId) { setItemUploadError('Cần đăng nhập để tải ảnh lên.'); return; }

    setItemUploading(it.key);
    setItemUploadError(null);

    const r = await uploadImage('product-images', userId, file);
    setItemUploading(null);

    if (!r.ok || !r.url) { setItemUploadError(r.message); return; }
    patch(it.key, { imageUrl: r.url });
  };

  // -------------------------------------------------------------------------
  // Lay du lieu tu link
  // -------------------------------------------------------------------------

  const runFetch = async (it: DraftItem) => {
    const check = checkAffiliateUrl(it.affiliateUrl);
    if (!check.ok) {
      patch(it.key, { fetchNote: check.message, source: null });
      return;
    }

    patch(it.key, { busy: true, fetchNote: 'Bắt đầu…', platform: check.platform });

    const out = await fetchProductFromUrl(it.affiliateUrl, session?.user.id ?? null, {
      onProgress: (m) => patch(it.key, { fetchNote: m }),
    });

    if (!out.ok || !out.data) {
      patch(it.key, { busy: false, fetchNote: out.message, source: null });
      return;
    }

    const d = out.data;
    const guessedCat = d.name ? (guessCategory(d.name) as ProductCategory) : it.category;

    patch(it.key, {
      busy: false,
      source: out.tier === 1 ? 'edge' : 'helper',
      fetchNote: out.message,
      // Chi dien vao o dang TRONG — khong ghi de thu nguoi dung da sua tay.
      name: it.name || d.name || '',
      priceVnd: it.priceVnd || (d.price_vnd ? String(d.price_vnd) : ''),
      imageUrl: it.imageUrl || d.image_url || '',
      category: it.name ? it.category : guessedCat,
      role: it.name ? it.role : (roleFromCategory(guessedCat) as ItemRole),
      platform: d.platform ?? check.platform,
    });
  };

  // -------------------------------------------------------------------------
  // Luu
  // -------------------------------------------------------------------------

  const validate = (): string | null => {
    if (!title.trim()) return 'Chưa đặt tên cho set đồ.';
    if (!styleSlug) return 'Chưa chọn phong cách.';
    if (!occasionSlug) return 'Chưa chọn dịp sử dụng.';
    if (colorSlugs.length === 0) return 'Chọn ít nhất một màu chủ đạo.';

    const real = items.filter((i) => i.name.trim() || i.affiliateUrl.trim());
    if (real.length === 0) return 'Thêm ít nhất một sản phẩm.';

    for (const [i, it] of real.entries()) {
      if (!it.name.trim()) return `Sản phẩm ${i + 1}: chưa có tên.`;
      if (!it.affiliateUrl.trim()) return `Sản phẩm ${i + 1}: chưa có link mua.`;
      const c = checkAffiliateUrl(it.affiliateUrl);
      if (!c.ok) return `Sản phẩm ${i + 1}: ${c.message}`;
      if (it.priceVnd && Number.isNaN(Number(it.priceVnd))) {
        return `Sản phẩm ${i + 1}: giá phải là số.`;
      }
    }
    return null;
  };

  const save = async (submit: boolean) => {
    const sb = getSupabase();
    if (!sb || !session) { setError('Cần đăng nhập.'); return; }

    const v = validate();
    if (v) { setError(v); return; }

    if (submit) {
      const rl = limitSubmit();
      if (!rl.allowed) {
        setError(`Bạn vừa gửi khá nhiều bài. Thử lại sau ${rl.retryAfterSec} giây.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    const uid = session.user.id;

    try {
      setProgress('Đang tải ảnh…');
      // Anh AI da nam tren Storage roi, khong phai tai len lai. Anh nguoi
      // dung tu chon tu may thi moi phai upload.
      const heroUrl = heroUrlDirect || (await uploadHero(uid));

      setProgress('Đang tạo set đồ…');
      const { data: outfit, error: e1 } = await sb
        .from('outfits')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          hero_image_url: heroUrl,
          style_slug: styleSlug,
          occasion_slug: occasionSlug,
          color_slugs: colorSlugs,
          author_id: uid,
          ai_generated: aiGenerated,
          // Luon tao o 'draft'. Chuyen sang 'pending' o buoc rieng ben duoi de
          // trigger dong dau moc submitted_at dung.
          status: 'draft',
        })
        .select('id, slug')
        .single();

      if (e1 || !outfit) throw new Error(e1?.message ?? 'Không tạo được set đồ.');

      const real = items.filter((i) => i.name.trim() && i.affiliateUrl.trim());

      for (const [idx, it] of real.entries()) {
        setProgress(`Đang lưu sản phẩm ${idx + 1}/${real.length}…`);

        const platform = it.platform ?? platformFromUrl(it.affiliateUrl);
        if (!platform) throw new Error(`Sản phẩm ${idx + 1}: không nhận ra sàn từ link.`);

        const { data: product, error: e2 } = await sb
          .from('products')
          .insert({
            name: it.name.trim(),
            category: it.category,
            color_slug: it.colorSlug || null,
            price_vnd: it.priceVnd ? Number(it.priceVnd) : null,
            price_checked_at: it.priceVnd ? new Date().toISOString() : null,
            image_url: it.imageUrl || null,
            source_platform: platform,
            source_url: it.affiliateUrl.trim(),
            created_by: uid,
            fetched_meta: it.source ? { source: it.source } : null,
          })
          .select('id')
          .single();

        if (e2 || !product) throw new Error(`Sản phẩm ${idx + 1}: ${e2?.message}`);

        // Link affiliate thuoc ve NGUOI DANG. Day la co che "nguoi dang huong
        // toan bo hoa hong": owner_id = chinh ho, va RLS khong cho ai khac sua.
        const { data: link, error: e3 } = await sb
          .from('affiliate_links')
          .insert({
            product_id: product.id,
            owner_id: uid,
            platform,
            url: it.affiliateUrl.trim(),
          })
          .select('id')
          .single();

        if (e3 || !link) throw new Error(`Sản phẩm ${idx + 1} (link): ${e3?.message}`);

        const { error: e4 } = await sb.from('outfit_items').insert({
          outfit_id: outfit.id,
          product_id: product.id,
          affiliate_link_id: link.id,
          role: it.role,
          position: idx,
        });

        if (e4) throw new Error(`Sản phẩm ${idx + 1} (gán vào set): ${e4.message}`);
      }

      if (submit) {
        setProgress('Đang gửi duyệt…');
        const { error: e5 } = await sb
          .from('outfits')
          .update({ status: 'pending' })
          .eq('id', outfit.id);
        if (e5) throw new Error(`Không gửi duyệt được: ${e5.message}`);
      }

      setProgress(null);
      router.push('/bai-cua-toi');
    } catch (e) {
      setSaving(false);
      setProgress(null);
      setError((e as Error).message);
    }
  };

  const totalPrice = items.reduce((s, i) => s + (Number(i.priceVnd) || 0), 0);

  return (
    <div className="flex flex-col gap-10">
      {/* ------------------------------------------------------------------ */}
      <Block title="Thông tin set đồ">
        <label className="label" htmlFor="title">Tên set đồ</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field mb-5"
          maxLength={120}
          placeholder="Ví dụ: Tối giản trắng đen ngày thường"
        />

        <label className="label" htmlFor="desc">Mô tả</label>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field mb-5"
          rows={3}
          maxLength={600}
          placeholder="Vì sao cách phối này hợp lý. Một hai câu là đủ."
        />

        {/* AI viet mo ta bang TIENG VIET — khac cau lenh tao anh, xem chu
            thich buildDescriptionPrompt trong src/lib/aiImage.ts. */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-sm btn-quiet"
            disabled={descBusy || items.every((i) => !i.name.trim())}
            onClick={() => void generateDescription()}
          >
            {descBusy ? 'Đang viết…' : 'Để AI viết mô tả (tiếng Việt)'}
          </button>
          {descMessage && <span className="muted-2 text-xs">{descMessage}</span>}
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="style">Phong cách</label>
            <select id="style" value={styleSlug} onChange={(e) => setStyleSlug(e.target.value)} className="field">
              <option value="">— Chọn —</option>
              {tax.styles.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="occ">Dịp sử dụng</label>
            <select id="occ" value={occasionSlug} onChange={(e) => setOccasionSlug(e.target.value)} className="field">
              <option value="">— Chọn —</option>
              {tax.occasions.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <p className="label">Màu chủ đạo</p>
        <div className="flex flex-wrap gap-2">
          {tax.colors.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="chip"
              aria-pressed={colorSlugs.includes(c.slug)}
              onClick={() =>
                setColorSlugs((xs) =>
                  xs.includes(c.slug) ? xs.filter((x) => x !== c.slug) : [...xs, c.slug],
                )
              }
            >
              <span className="swatch" style={{ background: c.hex }} />
              {c.label}
            </button>
          ))}
        </div>
        <p className="hint">Bộ lọc và gợi ý theo mệnh dùng đúng các màu bạn chọn ở đây.</p>
      </Block>

      {/* ------------------------------------------------------------------ */}
      <Block title="Ảnh đại diện" note="Ảnh lớn hiện ở đầu bài. Tối đa 5 MB, định dạng JPG, PNG, WebP hoặc AVIF.">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => pickHero(e.target.files?.[0] ?? null)}
          className="field"
        />
        {heroError && <p className="hint-error">{heroError}</p>}

        {heroPreview && (
          <div className="mt-4 max-w-sm">
            <div className="frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPreview} alt="Xem trước ảnh đại diện" />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Tao anh set do bang AI                                            */}
        {/*                                                                   */}
        {/* Day la duong TUY CHON. Ai khong muon dung AI thi tai anh cua minh */}
        {/* len o tren, hoac de trong — bai van dang duoc. Khong bao gio bat  */}
        {/* buoc phai co key AI moi dung duoc website.                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
          <p className="eyebrow mb-3">Hoặc để AI dựng ảnh set đồ</p>
          <p className="hint mb-4">
            AI dựng một ảnh minh hoạ theo phong cách, màu và các món bạn đã nhập.
            Ảnh sinh ra là <strong>ảnh minh hoạ</strong>, không phải ảnh sản phẩm thật:
            nó không giữ đúng logo, chữ in hay hoạ tiết nhỏ. Ảnh luôn được gắn nhãn
            &ldquo;Ảnh tạo bởi AI&rdquo; và vẫn phải qua kiểm duyệt.
          </p>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ai-provider">Dịch vụ</label>
              <select
                id="ai-provider"
                className="field"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as AiProviderId)}
              >
                <option value="gemini">Gemini (có gói miễn phí)</option>
                <option value="openai">OpenAI (trả tiền mỗi ảnh)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ai-scene">Bối cảnh</label>
              <select
                id="ai-scene"
                className="field"
                value={sceneId}
                onChange={(e) => setSceneId(e.target.value)}
              >
                {SCENES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ai-model">Dáng người mẫu</label>
              <select
                id="ai-model"
                className="field"
                value={modelTypeId}
                onChange={(e) => setModelTypeId(e.target.value)}
              >
                {MODEL_TYPES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            disabled={aiBusy || items.every((i) => !i.name.trim())}
            onClick={() => void generateAiImage()}
          >
            {aiBusy ? 'Đang tạo ảnh…' : 'Tạo ảnh set đồ bằng AI'}
          </button>

          {items.every((i) => !i.name.trim()) && (
            <p className="hint">Nhập tên ít nhất một món trước đã — AI cần biết dựng gì.</p>
          )}

          <button
            type="button"
            className="btn btn-sm btn-quiet ml-2"
            onClick={() => setShowPromptVi((v) => !v)}
          >
            {showPromptVi ? 'Ẩn yêu cầu gửi cho AI' : 'Xem yêu cầu gửi cho AI'}
          </button>

          {showPromptVi && (
            <div className="notice mt-4">
              <p className="eyebrow mb-2">Đang yêu cầu AI những gì</p>
              <ul className="muted flex list-disc flex-col gap-1 pl-5 text-sm">
                {explainPromptVi(promptInput()).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="hint mt-3">
                Câu lệnh thật gửi đi bằng tiếng Anh — các mô hình tạo ảnh hiểu tiếng Anh
                tốt hơn hẳn, viết tiếng Việt cho ra ảnh tệ hơn rõ rệt. Đây là bản dịch
                để bạn đọc, không phải thứ được gửi đi.
              </p>
            </div>
          )}

          {aiMessage && <p className="hint mt-3">{aiMessage}</p>}

          {aiUrls.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {aiUrls.map((u) => (
                <button
                  key={u}
                  type="button"
                  className="w-32 text-left"
                  onClick={() => { setHeroPreview(u); setHeroUrlDirect(u); setAiGenerated(true); }}
                >
                  <div className="frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="Ảnh do AI tạo" />
                  </div>
                  <span className="muted-2 text-xs">Bấm để dùng ảnh này</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={aiGenerated}
            onChange={(e) => setAiGenerated(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            Ảnh này do AI tạo ra
            <span className="muted-2 block text-xs">
              Bắt buộc đánh dấu nếu đúng. Bài sẽ hiện nhãn &quot;Ảnh tạo bởi AI&quot; và
              một dòng lưu ý rằng ảnh không đảm bảo giống tuyệt đối sản phẩm thật.
            </span>
          </span>
        </label>
      </Block>

      {/* ------------------------------------------------------------------ */}
      <Block
        title="Sản phẩm trong set"
        note="Dán link Shopee hoặc TikTok rồi bấm lấy thông tin. Nếu không lấy được, nhập tay — cách nào cũng hợp lệ."
      >
        <div className="flex flex-col gap-8">
          {items.map((it, idx) => (
            <div key={it.key} className="border p-4" style={{ borderColor: 'var(--line)' }}>
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">Sản phẩm {idx + 1}</p>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}
                  >
                    Xoá
                  </button>
                )}
              </div>

              <label className="label">Link mua trên Shopee hoặc TikTok</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={it.affiliateUrl}
                  onChange={(e) => patch(it.key, { affiliateUrl: e.target.value, fetchNote: '' })}
                  className="field"
                  placeholder="https://shopee.vn/..."
                  inputMode="url"
                />
                <button
                  type="button"
                  className="btn btn-sm shrink-0"
                  disabled={it.busy || !it.affiliateUrl.trim()}
                  onClick={() => runFetch(it)}
                >
                  {it.busy ? 'Đang lấy…' : 'Lấy thông tin'}
                </button>
              </div>

              {it.fetchNote && (
                <p className={it.source ? 'hint' : 'hint-error'}>
                  {it.source === 'edge' && 'Bậc 1 · '}
                  {it.source === 'helper' && 'Bậc 2 (Local Helper) · '}
                  {it.source === 'extension' && 'Tiện ích Chrome · '}
                  {it.fetchNote}
                </p>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Tên sản phẩm</label>
                  <input
                    value={it.name}
                    onChange={(e) => patch(it.key, { name: e.target.value })}
                    className="field"
                    maxLength={200}
                    placeholder="Áo thun cotton trơn trắng form regular"
                  />
                </div>

                <div>
                  <label className="label">Loại</label>
                  <select
                    value={it.category}
                    onChange={(e) => {
                      const cat = e.target.value as ProductCategory;
                      patch(it.key, { category: cat, role: roleFromCategory(cat) as ItemRole });
                    }}
                    className="field"
                  >
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Vai trò trong set</label>
                  <select
                    value={it.role}
                    onChange={(e) => patch(it.key, { role: e.target.value as ItemRole })}
                    className="field"
                  >
                    {Object.entries(ITEM_ROLE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Màu</label>
                  <select
                    value={it.colorSlug}
                    onChange={(e) => patch(it.key, { colorSlug: e.target.value })}
                    className="field"
                  >
                    <option value="">— Không rõ —</option>
                    {tax.colors.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Giá (VNĐ)</label>
                  <input
                    value={it.priceVnd}
                    onChange={(e) => patch(it.key, { priceVnd: e.target.value.replace(/\D/g, '') })}
                    className="field"
                    inputMode="numeric"
                    placeholder="189000"
                  />
                </div>

                {/* Ba duong lay anh cho mot mon, xep theo do de dung:
                    1. Tu dien khi lay duoc tu link
                    2. Tu tai anh len — dung khi ban tu chup hoac tu lam anh
                    3. Dan dia chi anh — duong cuoi, cho anh da co san o noi khac

                    Duong 2 la thu truoc day thieu: nguoi dung khong co cach nao
                    dua anh cua CHINH HO vao tung mon, chi dan duoc dia chi. */}
                <div className="sm:col-span-2">
                  <label className="label">Ảnh sản phẩm</label>

                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="text-sm"
                      disabled={itemUploading === it.key}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadItemImage(it, f);
                      }}
                    />
                    {itemUploading === it.key && (
                      <span className="muted-2 text-xs">Đang tải ảnh lên…</span>
                    )}
                  </div>

                  <input
                    value={it.imageUrl}
                    onChange={(e) => patch(it.key, { imageUrl: e.target.value })}
                    className="field"
                    placeholder="Tự điền khi lấy được từ link, hoặc dán địa chỉ ảnh"
                  />
                </div>
              </div>

              {it.imageUrl && (
                <div className="mt-4 w-24">
                  <div className="frame frame-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.imageUrl} alt="" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {itemUploadError && <p className="hint-error">{itemUploadError}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-sm" onClick={() => setItems((xs) => [...xs, newItem()])}>
            Thêm sản phẩm
          </button>
          {totalPrice > 0 && (
            <span className="muted-2 text-sm">Tổng tạm tính: {formatVnd(totalPrice)}</span>
          )}
        </div>
      </Block>

      {/* ------------------------------------------------------------------ */}
      {error && <div className="notice notice-danger">{error}</div>}
      {progress && <div className="notice">{progress}</div>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn flex-1" disabled={saving} onClick={() => save(false)}>
          Lưu bản nháp
        </button>
        <button type="button" className="btn btn-solid flex-1" disabled={saving} onClick={() => save(true)}>
          {saving ? 'Đang xử lý…' : 'Gửi quản trị viên duyệt'}
        </button>
      </div>

      <p className="muted-2 text-xs leading-relaxed">
        {asAdmin
          ? 'Bạn là quản trị viên: bài vẫn đi qua trạng thái chờ duyệt, bạn tự duyệt trong trang kiểm duyệt. Làm vậy để mọi bài đều có dấu vết kiểm duyệt trong nhật ký.'
          : 'Bài không hiển thị công khai ngay. Quản trị viên sẽ duyệt, hoặc yêu cầu sửa kèm lý do. Sau khi bài đã được duyệt, nếu bạn sửa ảnh, đổi sản phẩm hoặc đổi link thì bài tự động quay lại chờ duyệt — quy tắc này được thực thi ở tầng database nên không thể bỏ qua.'}
      </p>
    </div>
  );
}

function Block({
  title, note, children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="display-xs mb-1">{title}</h2>
      {note && <p className="muted-2 mb-4 text-sm">{note}</p>}
      <div className={note ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}
