'use client';

/**
 * Cac mon nam trong mot set do, sua duoc ngay tai cho.
 *
 * VI SAO KHONG CON TRANG "SAN PHAM" RIENG
 *   Truoc day co mot trang liet ke moi san pham trong database. Nhin vao mot
 *   dong "Ao thun cotton tron trang" khong biet no thuoc set nao, nen sua thi
 *   khong biet minh dang lam hong bai nao. San pham o day khong phai mot kho
 *   hang doc lap — no chi ton tai vi co mot set do dung no. Dat no ben trong
 *   set la dat dung cho no thuoc ve.
 *
 * TAI DU LIEU KHI MO RA, KHONG TAI SAN
 *   Danh sach outfit co the len hang tram dong. Tai san pham cua tat ca ngay
 *   tu dau la keo ve mot dong du lieu ma 99% se khong ai nhin. Mo dong nao
 *   tai dong do.
 *
 * LUU TUNG MON
 *   Moi mon mot nut luu. Mot nut luu tat ca nghia la mot loi mang lam mat toan
 *   bo cong sua, va khong biet mon nao hong.
 */

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useAsyncData, useAuth } from '@/lib/hooks';
import { uploadImage } from '@/lib/storage';
import { checkAffiliateUrl } from '@/lib/affiliate';
import { formatVnd, IMAGE_LIMITS } from '@/lib/format';
import { Spinner } from '@/components/site';
import { UploadButton } from '@/components/UploadButton';
import { ITEM_ROLE_LABEL } from '@/lib/supabase/types';
import type { OutfitWithItems } from '@/lib/supabase/types';

/** Ban nhap cua mot mon. Chi chua truong nguoi dung da dong vao. */
interface ItemDraft {
  name?: string;
  price?: string;
  imageUrl?: string;
  affiliateUrl?: string;
}

export function AdminOutfitItems({ outfitId }: { outfitId: string }) {
  const { session } = useAuth();

  const { data, loading, error, reload } = useAsyncData<OutfitWithItems | null>(
    `admin-outfit-items-${outfitId}`,
    (sb) =>
      sb
        .from('outfits')
        .select('*, outfit_items(*, products(*), affiliate_links(*))')
        .eq('id', outfitId)
        .maybeSingle()
        .then(({ data: r, error: e }) => ({ data: (r as OutfitWithItems | null) ?? null, error: e })),
  );

  const [draft, setDraft] = useState<Record<string, ItemDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Anh dai dien cua ca set. Giu rieng khoi `draft` vi no thuoc bang outfits,
  // khong thuoc mon nao.
  const [heroDraft, setHeroDraft] = useState<string | null>(null);
  const [heroBusy, setHeroBusy] = useState(false);
  const [heroSaved, setHeroSaved] = useState(false);

  if (loading) return <Spinner label="Đang tải sản phẩm trong set" />;
  if (error) return <p className="hint-error">Không tải được sản phẩm: {error}</p>;
  if (!data) return <p className="muted-2 text-sm">Không tìm thấy set đồ này.</p>;

  const items = [...(data.outfit_items ?? [])].sort((a, b) => a.position - b.position);
  const heroUrl = heroDraft ?? data.hero_image_url ?? '';
  const heroDirty = heroDraft !== null && heroDraft !== (data.hero_image_url ?? '');

  const uploadHero = async (file: File) => {
    if (!session) return;
    setHeroBusy(true);
    setSaveError(null);

    const r = await uploadImage('outfit-images', session.user.id, file);
    setHeroBusy(false);

    if (!r.ok || !r.url) { setSaveError(r.message); return; }
    setHeroDraft(r.url);
    setHeroSaved(false);
  };

  const saveHero = async () => {
    const sb = getSupabase();
    if (!sb || heroDraft === null) return;

    setHeroBusy(true);
    setSaveError(null);

    const { error: e } = await sb
      .from('outfits')
      .update({ hero_image_url: heroDraft.trim() || null })
      .eq('id', outfitId);

    setHeroBusy(false);
    if (e) { setSaveError(`Ảnh đại diện: ${e.message}`); return; }

    setHeroSaved(true);
    setHeroDraft(null);
    reload();
  };

  const set = (itemId: string, patch: ItemDraft) => {
    setDraft((d) => ({ ...d, [itemId]: { ...d[itemId], ...patch } }));
    setSavedId(null);
  };

  const uploadItemImage = async (itemId: string, file: File) => {
    if (!session) return;
    setBusyId(itemId);
    setSaveError(null);

    const r = await uploadImage('product-images', session.user.id, file);
    setBusyId(null);

    if (!r.ok || !r.url) { setSaveError(r.message); return; }
    set(itemId, { imageUrl: r.url });
  };

  const save = async (item: OutfitWithItems['outfit_items'][number]) => {
    const sb = getSupabase();
    if (!sb) return;

    const d = draft[item.id];
    if (!d) return;

    // Kiem ten mien TRUOC khi gui. Database co trigger chan link la thu that
    // ngan duoc; kiem o day chi de bao loi bang tieng Viet ngay lap tuc thay vi
    // doi mot vong may chu roi nhan thong bao cua Postgres.
    if (d.affiliateUrl !== undefined) {
      const check = checkAffiliateUrl(d.affiliateUrl);
      if (!check.ok) { setSaveError(check.message); return; }
    }

    setBusyId(item.id);
    setSaveError(null);

    if (item.products && (d.name !== undefined || d.price !== undefined || d.imageUrl !== undefined)) {
      const patch: Record<string, unknown> = {};
      if (d.name !== undefined) patch.name = d.name.trim();
      if (d.imageUrl !== undefined) patch.image_url = d.imageUrl.trim();
      if (d.price !== undefined) patch.price_vnd = Number(d.price.replace(/\D/g, '')) || 0;

      const { error: e } = await sb.from('products').update(patch).eq('id', item.products.id);
      if (e) { setBusyId(null); setSaveError(`Sản phẩm: ${e.message}`); return; }
    }

    if (item.affiliate_links && d.affiliateUrl !== undefined) {
      const { error: e } = await sb
        .from('affiliate_links')
        .update({ url: d.affiliateUrl.trim() })
        .eq('id', item.affiliate_links.id);
      if (e) { setBusyId(null); setSaveError(`Link: ${e.message}`); return; }
    }

    setBusyId(null);
    setSavedId(item.id);
    setDraft((x) => { const n = { ...x }; delete n[item.id]; return n; });
    reload();
  };

  return (
    <div className="flex flex-col gap-6">
      {saveError && <div className="notice notice-danger">{saveError}</div>}

      {/* ------------------------------------------------------------------ */}
      {/* Anh dai dien cua ca set                                            */}
      {/*                                                                     */}
      {/* Dat TREN cac mon vi day la thu nguoi xem nhin thay dau tien o trang */}
      {/* chu va trang kham pha — anh mon le chi hien khi da bam vao bai.     */}
      {/* Doi anh dai dien cua bai DA DANG se dua bai quay lai cho duyet:     */}
      {/* trigger outfits_require_rereview() lam viec do, khong phai ma o day.*/}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 border p-4 sm:flex-row" style={{ borderColor: 'var(--line)' }}>
        <div className="w-24 shrink-0">
          <div className="frame" style={{ aspectRatio: '4 / 5' }}>
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroUrl} alt="" />
            ) : (
              <div className="frame frame-empty absolute inset-0">—</div>
            )}
          </div>
          <p className="muted-2 mt-2 text-center text-xs">Ảnh bài</p>
        </div>

        <div className="flex-1">
          <label className="label">Ảnh đại diện của set</label>
          <UploadButton
            className="mb-2"
            label="Chọn ảnh từ máy"
            busy={heroBusy}
            maxBytes={IMAGE_LIMITS.outfit}
            onPick={(f) => void uploadHero(f)}
          />
          <input
            className="field"
            value={heroUrl}
            placeholder="Hoặc dán địa chỉ ảnh"
            onChange={(e) => { setHeroDraft(e.target.value); setHeroSaved(false); }}
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              className="btn btn-sm"
              disabled={!heroDirty || heroBusy}
              onClick={() => void saveHero()}
            >
              {heroBusy ? 'Đang lưu…' : 'Lưu ảnh đại diện'}
            </button>
            {heroDirty && !heroBusy && (
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                onClick={() => setHeroDraft(null)}
              >
                Hoàn tác
              </button>
            )}
            {heroSaved && (
              <span className="text-xs" style={{ color: 'var(--color-ok)' }}>Đã lưu</span>
            )}
          </div>

          {data.status === 'published' && (
            <p className="hint">
              Bài đang hiển thị công khai. Đổi ảnh đại diện sẽ đưa bài quay lại chờ duyệt —
              quy tắc nằm ở tầng database.
            </p>
          )}
        </div>
      </div>

      {items.length === 0 && (
        <p className="muted-2 text-sm">Set này chưa có sản phẩm nào.</p>
      )}

      {items.map((it) => {
        const p = it.products;
        const d = draft[it.id] ?? {};
        const name = d.name ?? p?.name ?? '';
        const price = d.price ?? String(p?.price_vnd ?? '');
        const imageUrl = d.imageUrl ?? p?.image_url ?? '';
        const affiliateUrl = d.affiliateUrl ?? it.affiliate_links?.url ?? '';
        const dirty = Object.keys(d).length > 0;
        const busy = busyId === it.id;

        return (
          <div
            key={it.id}
            className="flex flex-col gap-4 border p-4 sm:flex-row"
            style={{ borderColor: 'var(--line)' }}
          >
            <div className="w-24 shrink-0">
              <div className="frame frame-square">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" />
                ) : (
                  <div className="frame frame-empty absolute inset-0">—</div>
                )}
              </div>
              <p className="muted-2 mt-2 text-center text-xs">{ITEM_ROLE_LABEL[it.role]}</p>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Tên sản phẩm</label>
                <input
                  className="field"
                  value={name}
                  maxLength={200}
                  onChange={(e) => set(it.id, { name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Giá (đ)</label>
                <input
                  className="field"
                  value={price}
                  inputMode="numeric"
                  onChange={(e) => set(it.id, { price: e.target.value.replace(/\D/g, '') })}
                />
                <p className="hint">
                  {formatVnd(Number(price) || 0)}. Tổng giá của set được tính lại tự động.
                </p>
              </div>

              <div>
                <label className="label">Ảnh</label>
                <UploadButton
                  className="mb-2"
                  label="Chọn ảnh từ máy"
                  busy={busy}
                  maxBytes={IMAGE_LIMITS.product}
                  onPick={(f) => void uploadItemImage(it.id, f)}
                />
                <input
                  className="field"
                  value={imageUrl}
                  placeholder="Hoặc dán địa chỉ ảnh"
                  onChange={(e) => set(it.id, { imageUrl: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label">Link affiliate</label>
                <input
                  className="field"
                  value={affiliateUrl}
                  inputMode="url"
                  onChange={(e) => set(it.id, { affiliateUrl: e.target.value })}
                />
                <p className="hint">
                  Chỉ nhận Shopee hoặc TikTok. Đổi link của bài đã đăng sẽ đưa bài quay lại
                  chờ duyệt — quy tắc nằm ở tầng database.
                </p>
              </div>

              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!dirty || busy}
                  onClick={() => void save(it)}
                >
                  {busy ? 'Đang lưu…' : 'Lưu món này'}
                </button>
                {dirty && !busy && (
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    onClick={() =>
                      setDraft((x) => { const n = { ...x }; delete n[it.id]; return n; })
                    }
                  >
                    Hoàn tác
                  </button>
                )}
                {savedId === it.id && (
                  <span className="text-xs" style={{ color: 'var(--color-ok)' }}>Đã lưu</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
