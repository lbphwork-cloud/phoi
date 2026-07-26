'use client';

import { useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { EmptyState, Spinner } from '@/components/site';
import { useAsyncData, useAuth, useTaxonomy } from '@/lib/hooks';
import { checkAffiliateUrl } from '@/lib/affiliate';
import { fetchProductFromUrl } from '@/lib/fetchProduct';
import { formatVnd } from '@/lib/format';
import { uploadImage } from '@/lib/storage';
import { CATEGORY_LABEL } from '@/lib/supabase/types';
import type { AffiliateLink, Product, ProductCategory } from '@/lib/supabase/types';

type Row = Product & { affiliate_links: AffiliateLink[] };

/**
 * Quan ly san pham.
 *
 * Trang nay ton tai chu yeu vi mot viec rat cu the: khi ban co tai khoan
 * affiliate, ban se phai thay TOAN BO link thuong bang link affiliate. Neu
 * phai mo tung bai roi sua tung o thi voi vai tram san pham la khong lam noi.
 * Nen o day co o sua link ngay tai bang, va o "lay lai thong tin" cho tung dong.
 */
export default function AdminProductsPage() {
  const { session } = useAuth();
  const tax = useTaxonomy();

  const [q, setQ] = useState('');
  const [onlySeed, setOnlySeed] = useState(false);
  const [onlyNoImage, setOnlyNoImage] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Tach du lieu MAY CHU khoi ban SUA CUC BO.
   *
   * Truoc day ca hai nam trong mot state `rows`, va effect tai du lieu phai goi
   * setRows — tuc la setState dong bo trong effect. Tach ra thi du lieu may chu
   * do useAsyncData quan ly (chi ghi trong .then, khong bao gio dong bo), con
   * `edits` la state thuan cua giao dien.
   *
   * Loi them: sau khi bam Luu va tai lai, `edits` duoc don sach nen khong con
   * nguy co hien gia tri cu de len du lieu that vua ve.
   */
  const { data, loading, error: loadError, reload } = useAsyncData<Row[]>(
    'admin-products',
    (sb) =>
      sb
        .from('products')
        .select('*, affiliate_links(*)')
        .order('created_at', { ascending: false })
        .limit(400)
        .then(({ data: r, error }) => ({ data: (r as Row[] | null) ?? [], error })),
  );

  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  const error = actionError ?? loadError;

  const rows = useMemo(
    () => (data ?? []).map((r) => ({ ...r, ...edits[r.id] })),
    [data, edits],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlySeed && !r.is_seed) return false;
      if (onlyNoImage && r.image_url) return false;
      if (!needle) return true;
      return r.name.toLowerCase().includes(needle);
    });
  }, [rows, q, onlySeed, onlyNoImage]);

  const patchLocal = (id: string, p: Partial<Row>) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...p } }));

  const refreshAll = () => { setEdits({}); reload(); };

  /** Luu mot dong. Chi gui cac cot da doi. */
  const saveRow = async (r: Row) => {
    const sb = getSupabase()!;
    setBusyId(r.id);
    setActionError(null);

    const { error: e } = await sb
      .from('products')
      .update({
        name: r.name.trim(),
        category: r.category,
        color_slug: r.color_slug || null,
        price_vnd: r.price_vnd,
        // Moi lan sua gia la mot lan kiem tra gia moi — dong lai moc thoi gian
        // de trang cong khai hien dung "gia kiem tra X ngay truoc".
        price_checked_at: new Date().toISOString(),
        image_url: r.image_url || null,
        // Da sua tay thi khong con la du lieu mau nua.
        is_seed: false,
      })
      .eq('id', r.id);

    setBusyId(null);
    if (e) { setActionError(e.message); return; }
    setNote((n) => ({ ...n, [r.id]: 'Đã lưu.' }));
    patchLocal(r.id, { is_seed: false });
  };

  /**
   * Thay link affiliate.
   *
   * Trigger validate_affiliate_link() trong database se tu choi neu ten mien
   * khong thuoc Shopee/TikTok, hoac neu nen tang khong khop. Nen o day chi can
   * bao loi som cho de chiu, khong phai tu kiem tra lai cho ky.
   */
  const saveLink = async (r: Row, url: string) => {
    const sb = getSupabase()!;
    const check = checkAffiliateUrl(url);

    if (!check.ok) { setNote((n) => ({ ...n, [r.id]: check.message })); return; }

    setBusyId(r.id);
    setActionError(null);

    const existing = r.affiliate_links?.[0];

    if (existing) {
      const { error: e } = await sb
        .from('affiliate_links')
        .update({ url: url.trim(), platform: check.platform!, is_seed: false })
        .eq('id', existing.id);
      setBusyId(null);
      if (e) { setNote((n) => ({ ...n, [r.id]: e.message })); return; }
    } else {
      const { error: e } = await sb.from('affiliate_links').insert({
        product_id: r.id,
        owner_id: session?.user.id ?? null,
        platform: check.platform!,
        url: url.trim(),
      });
      setBusyId(null);
      if (e) { setNote((n) => ({ ...n, [r.id]: e.message })); return; }
    }

    setNote((n) => ({
      ...n,
      [r.id]: check.needsResolve
        ? 'Đã lưu link rút gọn. Cần resolve trước khi bài được đăng.'
        : 'Đã lưu link.',
    }));
    refreshAll();
  };

  /** Lay lai ten / gia / anh tu link, theo chuoi ba bac. */
  const refetch = async (r: Row) => {
    const url = r.affiliate_links?.[0]?.url ?? r.source_url;
    if (!url) { setNote((n) => ({ ...n, [r.id]: 'Sản phẩm này chưa có link.' })); return; }

    setBusyId(r.id);
    const out = await fetchProductFromUrl(url, session?.user.id ?? null, {
      onProgress: (m) => setNote((n) => ({ ...n, [r.id]: m })),
    });
    setBusyId(null);

    if (!out.ok || !out.data) { setNote((n) => ({ ...n, [r.id]: out.message })); return; }

    // Chi dien vao o dang trong. Khong ghi de thu ban da sua tay.
    patchLocal(r.id, {
      name: r.name || out.data.name || r.name,
      price_vnd: r.price_vnd ?? out.data.price_vnd ?? null,
      image_url: r.image_url || out.data.image_url || null,
    });
    setNote((n) => ({
      ...n,
      [r.id]: `${out.message} Kiểm tra rồi bấm Lưu.`,
    }));
  };

  /** Upload anh thay the tu may tinh. */
  const changeImage = async (r: Row, file: File) => {
    if (!session) return;

    setBusyId(r.id);
    const up = await uploadImage('product-images', session.user.id, file);
    setBusyId(null);

    if (!up.ok) { setNote((n) => ({ ...n, [r.id]: up.message })); return; }

    patchLocal(r.id, { image_url: up.url });
    setNote((n) => ({ ...n, [r.id]: 'Đã tải ảnh. Bấm Lưu để áp dụng.' }));
  };

  if (loading) return <Spinner />;

  const seedCount = rows.filter((r) => r.is_seed).length;
  const noImageCount = rows.filter((r) => !r.image_url).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="display-sm mb-1">Sản phẩm</h1>
        <p className="muted-2 text-sm">
          {rows.length} sản phẩm · {seedCount} là dữ liệu mẫu · {noImageCount} chưa có ảnh
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field max-w-xs"
          placeholder="Tìm theo tên sản phẩm"
        />
        <button type="button" className="chip" aria-pressed={onlySeed} onClick={() => setOnlySeed((v) => !v)}>
          Chỉ dữ liệu mẫu
        </button>
        <button type="button" className="chip" aria-pressed={onlyNoImage} onClick={() => setOnlyNoImage((v) => !v)}>
          Chỉ loại chưa có ảnh
        </button>
        <span className="muted-2 text-sm">{visible.length} kết quả</span>
      </div>

      {error && <div className="notice notice-danger mb-6">{error}</div>}

      {visible.length === 0 ? (
        <EmptyState title="Không có sản phẩm nào khớp" />
      ) : (
        <div className="flex flex-col gap-5">
          {visible.map((r) => (
            <div key={r.id} className="border p-4" style={{ borderColor: 'var(--line)' }}>
              <div className="grid gap-4 lg:grid-cols-[96px_1fr_auto]">
                {/* Anh */}
                <div>
                  <div className="frame frame-square">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" />
                    ) : (
                      <div className="frame frame-empty absolute inset-0">Chưa có</div>
                    )}
                  </div>
                  <label className="btn btn-quiet btn-sm mt-2 w-full cursor-pointer">
                    Đổi ảnh
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void changeImage(r, f);
                      }}
                    />
                  </label>
                </div>

                {/* Cac o sua */}
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {r.is_seed && <span className="tag tag-quiet">Dữ liệu mẫu</span>}
                    <span className="tag tag-quiet">{CATEGORY_LABEL[r.category]}</span>
                    {r.affiliate_links?.[0]?.is_alive === false && (
                      <span className="tag tag-danger">Link có thể đã hỏng</span>
                    )}
                  </div>

                  <input
                    value={r.name}
                    onChange={(e) => patchLocal(r.id, { name: e.target.value })}
                    className="field mb-3"
                    placeholder="Tên sản phẩm"
                  />

                  <div className="mb-3 grid gap-3 sm:grid-cols-3">
                    <select
                      value={r.category}
                      onChange={(e) => patchLocal(r.id, { category: e.target.value as ProductCategory })}
                      className="field"
                    >
                      {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>

                    <select
                      value={r.color_slug ?? ''}
                      onChange={(e) => patchLocal(r.id, { color_slug: e.target.value || null })}
                      className="field"
                    >
                      <option value="">— Màu —</option>
                      {tax.colors.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                    </select>

                    <input
                      value={r.price_vnd ?? ''}
                      onChange={(e) =>
                        patchLocal(r.id, {
                          price_vnd: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null,
                        })
                      }
                      className="field"
                      inputMode="numeric"
                      placeholder="Giá VNĐ"
                    />
                  </div>

                  {/* O thay link — day la ly do chinh trang nay ton tai */}
                  <label className="label">Link affiliate</label>
                  <LinkField
                    initial={r.affiliate_links?.[0]?.url ?? r.source_url ?? ''}
                    disabled={busyId === r.id}
                    onSave={(url) => saveLink(r, url)}
                  />

                  {note[r.id] && (
                    <p className={note[r.id].startsWith('Đã') ? 'hint' : 'hint-error'}>
                      {note[r.id]}
                    </p>
                  )}
                </div>

                {/* Hanh dong */}
                <div className="flex flex-col gap-2 lg:w-36">
                  <button
                    type="button"
                    className="btn btn-sm btn-solid"
                    disabled={busyId === r.id}
                    onClick={() => saveRow(r)}
                  >
                    {busyId === r.id ? '…' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busyId === r.id}
                    onClick={() => refetch(r)}
                  >
                    Lấy lại từ link
                  </button>
                  <p className="muted-2 text-xs">{formatVnd(r.price_vnd)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * O nhap link co trang thai rieng, de go dang do khong bi mat khi bang tai lai.
 * Hien canh bao ngay khi ten mien sai, truoc ca khi bam luu.
 */
function LinkField({
  initial, disabled, onSave,
}: {
  initial: string;
  disabled: boolean;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(initial);
  const check = url.trim() ? checkAffiliateUrl(url) : null;
  const dirty = url.trim() !== initial.trim();

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={`field ${check && !check.ok ? 'field-error' : ''}`}
          placeholder="https://shopee.vn/... hoặc https://s.shopee.vn/..."
          inputMode="url"
        />
        <button
          type="button"
          className="btn btn-sm shrink-0"
          disabled={disabled || !dirty || (check ? !check.ok : true)}
          onClick={() => onSave(url)}
        >
          Lưu link
        </button>
      </div>
      {check && !check.ok && <p className="hint-error">{check.message}</p>}
      {check?.ok && check.needsResolve && (
        <p className="hint">Link rút gọn — sẽ được resolve và kiểm tra đích đến thật.</p>
      )}
    </>
  );
}
