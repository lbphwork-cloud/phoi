'use client';

/**
 * Hang doi kiem duyet — xem nhu nguoi dung thay, va sua ngay tai cho.
 *
 * BO CUC HAI COT
 *   Trai  — dung lai bai DUNG NHU trang cong khai: anh lon, tieu de, danh sach
 *           mon kem anh va gia. Doi ngay khi go o cot phai.
 *   Phai  — o sua tung truong, o nhap ly do, va cac nut duyet.
 *
 *   VI SAO PHAI DUNG LAI PHAN NHIN
 *     Ban cu chi hien anh nho 220px va mot bang du lieu. Nhung loi hay gap nhat
 *     khi duyet lai la loi NHIN: anh mo, anh bi cat mat dau, tieu de dai qua bi
 *     vo dong, mau trong anh khong khop mo ta. Nhung loi do khong nhin ra duoc
 *     tu mot bang chu.
 *
 * SUA TAI CHO CHAM VAO BA BANG KHAC NHAU
 *   outfits          — tieu de, mo ta, anh, phong cach, dip
 *   products         — ten va gia tung mon
 *   affiliate_links  — dia chi link
 *
 *   Chung duoc luu trong MOT lan bam, nhung goi rieng tung bang. Neu mot bang
 *   loi thi bao ro bang nao, khong im lang bo qua.
 *
 * CANH BAO PHAI HIEN CHO NGUOI DUYET
 *   Sua `products` anh huong MOI bai dang dung san pham do, khong chi bai nay.
 *   Doi link affiliate cua bai DA DANG thi trigger tu dua bai ve cho duyet.
 *   Ca hai deu duoc ghi ngay canh o nhap, khong giau trong tai lieu.
 *
 * Ba nut duyet deu goi CUNG mot ham SQL review_outfit(), khong tu UPDATE bang
 * outfits. Ham do lam ba viec trong MOT giao dich — doi trang thai, ghi
 * post_reviews, ghi admin_audit_log — va bat buoc co ly do khi yeu cau sua.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { EmptyState, Spinner } from '@/components/site';
import { StatusTag } from '@/components/outfit';
import { UploadButton } from '@/components/UploadButton';
import { deleteOutfit, confirmDelete } from '@/lib/deleteOutfit';
import { useAsyncData, useTaxonomy, useAuth } from '@/lib/hooks';
import { uploadImage } from '@/lib/storage';
import { formatRelative, formatVnd, IMAGE_LIMITS } from '@/lib/format';
import type { OutfitWithItems, ReviewAction } from '@/lib/supabase/types';

/** Cac truong cua bai co the sua ngay tai trang duyet. */
interface OutfitEdit {
  title?: string;
  description?: string;
  hero_image_url?: string;
  style_slug?: string;
  occasion_slug?: string;
}

/**
 * Ly do soan san cho viec tu choi hoac yeu cau sua.
 *
 * VI SAO CO DANH SACH NAY
 *   Bat quan tri vien go tay moi lan dan tori hai ket cuc, deu xau: hoac ho go
 *   qua ngan ("khong dat") — tac gia doc xong van khong biet phai sua gi; hoac
 *   ho ngai go nen bam duyet cho xong. Bam mot cai la co mot cau day du, ro
 *   rang, va giong nhau giua cac bai.
 *
 *   Van giu o go tu do ben duoi: danh sach nay khong bao gio phu het truong hop
 *   that, va ep moi ly do vao mot khuon co san la cach chac chan de mot ngay
 *   nao do gui cho tac gia mot ly do khong dung voi bai cua ho.
 */
const REASON_PRESETS = [
  'Ảnh mờ hoặc chất lượng thấp, cần ảnh rõ hơn.',
  'Ảnh không khớp với các sản phẩm được liệt kê trong set.',
  'Link sản phẩm không mở được hoặc đã hết hàng.',
  'Giá ghi không khớp với giá thật trên sàn.',
  'Tên sản phẩm chưa rõ, cần ghi đúng tên trên trang bán.',
  'Các món chưa tạo thành một set hoàn chỉnh.',
  'Mô tả sao chép nguyên văn từ trang bán, cần viết lại.',
  'Nội dung không phù hợp với chủ đề thời trang nam.',
];

export default function ModerationPage() {
  const tax = useTaxonomy();
  const { session } = useAuth();

  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [outfitEdits, setOutfitEdits] = useState<Record<string, OutfitEdit>>({});
  const [productEdits, setProductEdits] = useState<
    Record<string, { name?: string; price_vnd?: number | null }>
  >({});
  const [linkEdits, setLinkEdits] = useState<Record<string, string>>({});

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  /*
    TIM VA LOC TRONG HANG DOI KIEM DUYET.

    Hang doi lay toi 60 bai. Voi 60 the day du anh va danh sach san pham thi
    cuon het mot lan la rat lau — va thuong quan tri vien vao day vi mot bai cu
    the, hoac vi muon duyet dut mot phong cach.

    Loc o day KHONG goi lai database: 60 dong da nam san trong bo nho, va goi
    lai chi de doi bo loc se lam mat cho dang cuon.
  */
  const [q, setQ] = useState('');
  const [style, setStyle] = useState('all');

  const { data, loading, error: loadError, reload } = useAsyncData<OutfitWithItems[]>(
    filter,
    (sb) => {
      let q = sb
        .from('outfits')
        .select('*, outfit_items(*, products(*), affiliate_links(*))')
        // nullsFirst: false de bai da co moc gui duyet len truoc — hang doi
        // phai theo thu tu ai gui truoc duoc xet truoc.
        .order('submitted_at', { ascending: true, nullsFirst: false })
        .limit(60);

      q = filter === 'pending'
        ? q.eq('status', 'pending')
        : q.in('status', ['pending', 'needs_revision', 'rejected', 'hidden']);

      return q.then(({ data: r, error }) => ({
        data: (r as OutfitWithItems[] | null) ?? [],
        error,
      }));
    },
  );

  const tatCa = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tatCa.filter(
      (o) =>
        (style === 'all' || o.style_slug === style) &&
        (!needle || o.title.toLowerCase().includes(needle)),
    );
  }, [tatCa, style, q]);

  const error = actionError ?? loadError;

  /** Gia tri hien tai cua mot truong: uu tien ban dang sua. */
  const field = <K extends keyof OutfitEdit>(
    o: OutfitWithItems,
    k: K,
  ): string => (outfitEdits[o.id]?.[k] ?? (o[k as keyof OutfitWithItems] as string) ?? '');

  const setField = (id: string, k: keyof OutfitEdit, v: string) => {
    setOutfitEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
    setSavedId(null);
  };

  const hasEdits = (o: OutfitWithItems) => {
    if (outfitEdits[o.id] && Object.keys(outfitEdits[o.id]).length > 0) return true;
    return (o.outfit_items ?? []).some(
      (it) =>
        (it.products && productEdits[it.products.id]) ||
        (it.affiliate_links && linkEdits[it.affiliate_links.id] !== undefined),
    );
  };

  /** Luu moi thay doi cua mot bai. Goi rieng tung bang de bao loi dung cho. */
  const saveEdits = async (o: OutfitWithItems) => {
    const sb = getSupabase()!;
    setBusyId(o.id);
    setActionError(null);

    const patch = outfitEdits[o.id];
    if (patch && Object.keys(patch).length > 0) {
      const { error: e } = await sb.from('outfits').update(patch).eq('id', o.id);
      if (e) { setBusyId(null); setActionError(`Bài: ${e.message}`); return; }
    }

    for (const it of o.outfit_items ?? []) {
      const pid = it.products?.id;
      if (pid && productEdits[pid]) {
        const { error: e } = await sb.from('products').update(productEdits[pid]).eq('id', pid);
        if (e) { setBusyId(null); setActionError(`Sản phẩm: ${e.message}`); return; }
      }

      const lid = it.affiliate_links?.id;
      if (lid && linkEdits[lid] !== undefined) {
        const { error: e } = await sb
          .from('affiliate_links')
          .update({ url: linkEdits[lid] })
          .eq('id', lid);
        if (e) { setBusyId(null); setActionError(`Link: ${e.message}`); return; }
      }
    }

    setOutfitEdits((e) => { const n = { ...e }; delete n[o.id]; return n; });
    setBusyId(null);
    setSavedId(o.id);
    reload();
  };

  const onHeroFile = async (o: OutfitWithItems, file: File) => {
    if (!session) return;
    setBusyId(o.id);
    setActionError(null);

    const r = await uploadImage('outfit-images', session.user.id, file);
    setBusyId(null);

    if (!r.ok || !r.url) { setActionError(r.message); return; }
    setField(o.id, 'hero_image_url', r.url);
  };

  const review = async (id: string, action: ReviewAction) => {
    const sb = getSupabase()!;
    const reason = (reasons[id] ?? '').trim();

    // Tu choi la ket thuc, khong co duong lam tiep — nen no can mot ly do hon
    // chu khong phai it hon. Ham review_outfit trong database cung chan, day
    // chi la lop bao loi som bang tieng Viet.
    if ((action === 'request_changes' || action === 'reject') && !reason) {
      setActionError(
        action === 'reject'
          ? 'Phải nhập lý do khi từ chối. Bài bị từ chối là hết đường, tác giả cần biết vì sao.'
          : 'Phải nhập lý do khi yêu cầu sửa. Tác giả cần biết phải sửa gì.',
      );
      return;
    }

    setBusyId(id);
    setActionError(null);

    const { error: e } = await sb.rpc('review_outfit', {
      p_outfit_id: id,
      p_action: action,
      p_reason: reason || null,
    });

    setBusyId(null);
    if (e) { setActionError(e.message); return; }

    setReasons((r) => ({ ...r, [id]: '' }));
    reload();
  };

  /** An noi dung vi pham. 'hidden' la trang thai khoa: tac gia khong tu mo lai duoc. */
  const hide = async (id: string) => {
    const sb = getSupabase()!;
    const reason = (reasons[id] ?? '').trim();
    if (!reason) { setActionError('Nhập lý do ẩn để lưu vào nhật ký.'); return; }

    setBusyId(id);
    const { error: e } = await sb
      .from('outfits')
      .update({ status: 'hidden', review_note: reason })
      .eq('id', id);

    if (!e) {
      await sb.rpc('log_admin_action', {
        p_action: 'outfit.hide',
        p_entity_type: 'outfit',
        p_entity_id: id,
        p_detail: { reason },
      });
    }

    setBusyId(null);
    if (e) { setActionError(e.message); return; }
    reload();
  };

  const removeOutfit = async (o: OutfitWithItems) => {
    if (!confirmDelete(o.title)) return;

    setBusyId(o.id);
    setActionError(null);

    const r = await deleteOutfit(o);

    setBusyId(null);
    if (!r.ok) { setActionError(r.message ?? 'Không xoá được.'); return; }
    reload();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-sm">Kiểm duyệt</h1>
          <p className="muted-2 text-sm">
            {rows.length === tatCa.length
              ? `${rows.length} bài trong danh sách`
              : `${rows.length}/${tatCa.length} bài khớp bộ lọc`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="chip"
            aria-pressed={filter === 'pending'}
            onClick={() => setFilter('pending')}
          >
            Chờ duyệt
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Tất cả cần chú ý
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field max-w-xs"
          placeholder="Tìm theo tên bài"
          aria-label="Tìm bài trong hàng đợi"
        />
        <select
          className="field max-w-xs"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          aria-label="Lọc theo phong cách"
        >
          <option value="all">Tất cả phong cách</option>
          {tax.styles.map((st) => (
            <option key={st.slug} value={st.slug}>{st.label}</option>
          ))}
        </select>
        {(q.trim() || style !== 'all') && (
          <button type="button" className="btn btn-sm btn-quiet"
                  onClick={() => { setQ(''); setStyle('all'); }}>
            Bỏ lọc
          </button>
        )}
      </div>

      {error && <div className="notice notice-danger mb-6">{error}</div>}

      {rows.length === 0 ? (
        <EmptyState title={tatCa.length === 0 ? 'Không có bài nào cần duyệt' : 'Không có bài nào khớp'}>
          {tatCa.length === 0
            ? 'Hàng đợi trống. Bài mới sẽ hiện ở đây khi có người gửi duyệt.'
            : 'Thử bỏ bớt bộ lọc.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-12">
          {rows.map((o) => {
            const busy = busyId === o.id;
            const items = o.outfit_items ?? [];

            return (
              <article key={o.id} className="border" style={{ borderColor: 'var(--line)' }}>
                <div className="flex flex-wrap items-center gap-2 border-b p-4"
                     style={{ borderColor: 'var(--line)' }}>
                  <StatusTag status={o.status} />
                  {o.is_seed && <span className="tag tag-quiet">Dữ liệu mẫu</span>}
                  {o.ai_generated && <span className="tag tag-warn">Ảnh tạo bởi AI</span>}
                  <span className="muted-2 text-xs">
                    {o.submitted_at ? `gửi ${formatRelative(o.submitted_at)}` : 'chưa gửi'}
                  </span>
                  <Link
                    href={`/outfit/${o.slug}`}
                    target="_blank"
                    className="btn btn-quiet btn-sm ml-auto"
                  >
                    Xem như người dùng ↗
                  </Link>
                </div>

                <div className="grid gap-8 p-5 lg:grid-cols-[1fr_1fr] lg:gap-10">
                  {/* ---------------------------------------------------------- */}
                  {/* TRAI — dung lai dung nhu nguoi dung thay                    */}
                  {/* ---------------------------------------------------------- */}
                  <div>
                    <p className="eyebrow mb-3">Người dùng sẽ thấy</p>

                    <div className="frame mb-5" style={{ aspectRatio: '4 / 5' }}>
                      {field(o, 'hero_image_url') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={field(o, 'hero_image_url')} alt="" />
                      ) : (
                        <div className="frame frame-empty absolute inset-0">Chưa có ảnh</div>
                      )}
                    </div>

                    <h2 className="display-sm mb-2">{field(o, 'title') || '(chưa có tiêu đề)'}</h2>
                    <p className="muted-2 mb-4 text-xs">
                      {tax.styleLabel(field(o, 'style_slug'))} ·{' '}
                      {tax.occasionLabel(field(o, 'occasion_slug'))} ·{' '}
                      {formatVnd(o.total_price_vnd)} · {items.length} món
                    </p>

                    {field(o, 'description') && (
                      <p className="muted mb-5 text-sm leading-relaxed">
                        {field(o, 'description')}
                      </p>
                    )}

                    <div className="flex flex-col gap-3">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-center gap-3">
                          <div
                            className="frame shrink-0"
                            style={{ width: '3.5rem', aspectRatio: '1 / 1' }}
                          >
                            {it.products?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.products.image_url} alt="" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">
                              {productEdits[it.products?.id ?? '']?.name ??
                                it.products?.name ??
                                '—'}
                            </p>
                            <p className="muted-2 text-xs">
                              {it.role} ·{' '}
                              {formatVnd(
                                productEdits[it.products?.id ?? '']?.price_vnd ??
                                  it.products?.price_vnd ??
                                  null,
                              )}
                            </p>
                          </div>
                          {!it.affiliate_links && (
                            <span className="hint-error text-xs">thiếu link</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ---------------------------------------------------------- */}
                  {/* PHAI — sua tai cho                                          */}
                  {/* ---------------------------------------------------------- */}
                  <div>
                    <p className="eyebrow mb-3">Sửa trực tiếp</p>

                    <label className="label" htmlFor={`t-${o.id}`}>Tiêu đề</label>
                    <input
                      id={`t-${o.id}`}
                      className="field mb-3"
                      value={field(o, 'title')}
                      onChange={(e) => setField(o.id, 'title', e.target.value)}
                    />

                    <label className="label" htmlFor={`d-${o.id}`}>Mô tả</label>
                    <textarea
                      id={`d-${o.id}`}
                      className="field mb-3"
                      rows={3}
                      value={field(o, 'description')}
                      onChange={(e) => setField(o.id, 'description', e.target.value)}
                    />

                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="label" htmlFor={`s-${o.id}`}>Phong cách</label>
                        <select
                          id={`s-${o.id}`}
                          className="field"
                          value={field(o, 'style_slug')}
                          onChange={(e) => setField(o.id, 'style_slug', e.target.value)}
                        >
                          {tax.styles.map((s) => (
                            <option key={s.slug} value={s.slug}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor={`oc-${o.id}`}>Dịp</label>
                        <select
                          id={`oc-${o.id}`}
                          className="field"
                          value={field(o, 'occasion_slug')}
                          onChange={(e) => setField(o.id, 'occasion_slug', e.target.value)}
                        >
                          {tax.occasions.map((x) => (
                            <option key={x.slug} value={x.slug}>{x.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <label className="label">Đổi ảnh đại diện</label>
                    <UploadButton
                      className="mb-4"
                      label="Chọn ảnh từ máy"
                      busy={busyId === o.id}
                      maxBytes={IMAGE_LIMITS.outfit}
                      onPick={(f) => void onHeroFile(o, f)}
                    />

                    {/* --- Tung mon --- */}
                    <p className="eyebrow mb-2 mt-5">Từng món</p>
                    <p className="hint mb-3">
                      Sửa tên hoặc giá ở đây đổi luôn trong <strong>mọi bài</strong> dùng
                      sản phẩm đó. Đổi link của bài đã đăng sẽ tự đưa bài về chờ duyệt.
                    </p>

                    <div className="flex flex-col gap-4">
                      {items.map((it) => {
                        const p = it.products;
                        const l = it.affiliate_links;
                        if (!p) return null;

                        return (
                          <div key={it.id} className="border p-3" style={{ borderColor: 'var(--line)' }}>
                            <p className="eyebrow mb-2">{it.role}</p>
                            <input
                              className="field mb-2"
                              value={productEdits[p.id]?.name ?? p.name}
                              onChange={(e) =>
                                setProductEdits((s) => ({
                                  ...s,
                                  [p.id]: { ...s[p.id], name: e.target.value },
                                }))
                              }
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="field"
                                type="number"
                                step={1000}
                                placeholder="Giá (đ)"
                                value={
                                  productEdits[p.id]?.price_vnd ?? p.price_vnd ?? ''
                                }
                                onChange={(e) =>
                                  setProductEdits((s) => ({
                                    ...s,
                                    [p.id]: {
                                      ...s[p.id],
                                      price_vnd: e.target.value === '' ? null : Number(e.target.value),
                                    },
                                  }))
                                }
                              />
                              <input
                                className="field"
                                placeholder="Link Shopee / TikTok"
                                value={l ? (linkEdits[l.id] ?? l.url) : ''}
                                disabled={!l}
                                onChange={(e) =>
                                  l && setLinkEdits((s) => ({ ...s, [l.id]: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!hasEdits(o) || busy}
                        onClick={() => void saveEdits(o)}
                      >
                        {busy ? 'Đang lưu…' : 'Lưu chỉnh sửa'}
                      </button>
                      {savedId === o.id && (
                        <span className="text-xs" style={{ color: 'var(--color-ok)' }}>
                          Đã lưu
                        </span>
                      )}
                    </div>

                    {/* --- Quyet dinh duyet --- */}
                    <div className="mt-8 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
                      <label className="label" htmlFor={`reason-${o.id}`}>
                        Lý do (bắt buộc khi từ chối, yêu cầu sửa hoặc ẩn)
                      </label>

                      {/* Bam mot ly do la no duoc THEM vao o ben duoi chu khong
                          ghi de: mot bai co the vua mo anh vua sai gia. Bam lai
                          lan nua thi bo ly do do ra. */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        {REASON_PRESETS.map((preset) => {
                          const current = reasons[o.id] ?? '';
                          const on = current.includes(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              className="chip"
                              aria-pressed={on}
                              onClick={() =>
                                setReasons((r) => {
                                  const cur = r[o.id] ?? '';
                                  const next = on
                                    ? cur.replace(preset, '').replace(/\s{2,}/g, ' ').trim()
                                    : (cur ? `${cur.trim()} ${preset}` : preset);
                                  return { ...r, [o.id]: next };
                                })
                              }
                            >
                              {preset}
                            </button>
                          );
                        })}
                      </div>

                      <textarea
                        id={`reason-${o.id}`}
                        value={reasons[o.id] ?? ''}
                        onChange={(e) => setReasons((r) => ({ ...r, [o.id]: e.target.value }))}
                        className="field mb-3"
                        rows={2}
                        placeholder="Bấm lý do có sẵn ở trên, hoặc tự viết. Tác giả sẽ đọc đúng những dòng này."
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-solid"
                          disabled={busy}
                          onClick={() => review(o.id, 'approve')}
                        >
                          Duyệt và đăng
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() => review(o.id, 'request_changes')}
                        >
                          Yêu cầu sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={busy}
                          onClick={() => review(o.id, 'reject')}
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={busy}
                          onClick={() => hide(o.id)}
                        >
                          Ẩn vì vi phạm
                        </button>
                      </div>

                      {/* XOA HAN chi hien voi bai da tu choi hoac da an.
                          Bai dang cho duyet ma co nut xoa canh nut duyet la moi
                          truong cho mot cu bam nham khong hoan lai duoc. Da tu
                          choi thi quyet dinh da xong roi, xoa chi la don dep. */}
                      {(o.status === 'rejected' || o.status === 'hidden') && (
                        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={busy}
                            onClick={() => void removeOutfit(o)}
                          >
                            Xoá hẳn bài này
                          </button>
                          <p className="hint">
                            Bài bị từ chối vẫn chiếm chỗ trong danh sách và trong database.
                            Xoá hẳn thì mất vĩnh viễn; sản phẩm vẫn nằm lại vì có thể set
                            khác đang dùng.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
