'use client';

import { useState } from 'react';
import { getSupabase } from './supabase/client';
import { useAsyncData } from './hooks';
import type { Outfit, OutfitWithItems } from './supabase/types';
import { rankOutfits, type UserContext, type ColorElementMap } from './scoring';

export interface OutfitFilters {
  styleSlug?: string | null;
  occasionSlug?: string | null;
  /**
   * Cac mau duoc chon. Rong = khong loc theo mau.
   *
   * NHIEU MAU, KHONG PHAI MOT. Truoc day chi chon duoc mot mau, va do la mot
   * gioi han khong co ly do: nguoi ta tim "do den" hay "be nau" nhu mot tong
   * mau, khong phai tung mau roi.
   *
   * Loc theo kieu HOAC (co bat ky mau nao trong danh sach), khong phai VA.
   * Loc VA se tra ve gan nhu khong bai nao — mot set do chi co hai ba mau chu
   * dao, doi no chua ca bon mau da chon la doi mot thu khong ton tai.
   */
  colorSlugs?: string[] | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

/**
 * Moc thoi gian ON DINH cho ca vong doi cua component.
 *
 * Bo cham diem cong mot it diem cho outfit moi dang, nen no can biet "bay gio".
 * Nhung goi Date.now() ngay trong than component la mot loi that: moi lan
 * render lai se ra mot con so khac, diem so doi theo, va thu tu outfit co the
 * nhay ngay truoc mat nguoi dung dang doc.
 *
 * useState voi ham khoi tao lazy chi chay MOT lan khi component duoc tao, nen
 * moc thoi gian giu nguyen suot phien. Do moi cua bai tinh theo ngay chu khong
 * theo giay, nen giu nguyen mot moc la hoan toan du chinh xac.
 */
function useStableNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

/**
 * Tai danh sach outfit dang hien thi cong khai, roi sap xep theo ngu canh ca
 * nhan cua nguoi dung.
 *
 * Vi sao LOC o may chu nhung SAP XEP o trinh duyet:
 *   - Loc (phong cach, mau, gia) o may chu de khong tai ve du lieu khong dung —
 *     quan trong voi han muc egress 5GB/thang cua goi Supabase mien phi.
 *   - Sap xep o trinh duyet vi diem so phu thuoc lich su phan hoi cua TUNG
 *     nguoi. Neu tinh o may chu thi phai luu bang diem cho moi cap
 *     (nguoi dung x outfit) — ton kem va khong can thiet o quy mo nay.
 *
 * Voi vai tram outfit thi cach nay chay tuc thi. Khi nao vuot vai nghin outfit
 * moi can chuyen sang phan trang co diem tinh san.
 */
export function useOutfits(
  filters: OutfitFilters,
  ctx: UserContext,
  colorElements: ColorElementMap,
  limit = 60,
  /** Nguoi dung dang bat "Ưu tiên hợp mệnh" — day bai hop menh len dau. */
  uuTienMenh = false,
) {
  const now = useStableNow();
  const key = JSON.stringify(filters) + '|' + limit;

  const { data, loading, error, reload } = useAsyncData<Outfit[]>(key, (sb) => {
    let q = sb
      .from('outfits')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (filters.styleSlug) q = q.eq('style_slug', filters.styleSlug);
    if (filters.occasionSlug) q = q.eq('occasion_slug', filters.occasionSlug);
    // contains dung toan tu @> cua Postgres, co index GIN tren color_slugs
    if (filters.colorSlugs?.length) {
      // `overlaps` = giao nhau khac rong, dung nghia "co bat ky mau nao".
      q = q.overlaps('color_slugs', filters.colorSlugs);
    }
    if (filters.priceMin != null) q = q.gte('total_price_vnd', filters.priceMin);
    if (filters.priceMax != null) q = q.lte('total_price_vnd', filters.priceMax);

    return q.then(({ data: rows, error: e }) => ({
      data: (rows as Outfit[] | null) ?? [],
      error: e,
    }));
  });

  const rows = data ?? [];

  const ranked = rankOutfits(
    rows.map((o) => ({
      id: o.id,
      styleSlug: o.style_slug,
      occasionSlug: o.occasion_slug,
      colorSlugs: o.color_slugs,
      totalPriceVnd: o.total_price_vnd,
      publishedAt: o.published_at,
      isSeed: o.is_seed,
      raw: o,
    })),
    ctx,
    colorElements,
    now,
    uuTienMenh,
  );

  return {
    loading,
    error,
    /** Da sap xep theo diem, da loai outfit bi an */
    outfits: ranked.map((r) => ({ ...r.raw, score: r.score })),
    total: rows.length,
    /**
     * Tai lai danh sach. Dung sau khi nguoi dung gui phan hoi: bo cham diem
     * doc feedback_events, nen phai lay lai moi thay thu tu doi.
     */
    reload,
  };
}

/** Tai mot outfit kem toan bo san pham va link affiliate. */
export function useOutfitDetail(slug: string) {
  const { data, loading, error } = useAsyncData<OutfitWithItems>(slug, (sb) =>
    sb
      .from('outfits')
      .select('*, outfit_items(*, products(*), affiliate_links(*))')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data: row, error: e }) => {
        const outfit = (row as OutfitWithItems | null) ?? null;
        outfit?.outfit_items?.sort((a, b) => a.position - b.position);

        // Dem luot xem. Phai di qua ham RPC vi cot view_count da bi thu hoi
        // quyen UPDATE o migration 0002 — client khong tu cong duoc.
        // Fire-and-forget: mat mot luot dem con hon lam cham trang.
        if (outfit?.status === 'published') {
          void getSupabase()?.rpc('increment_outfit_view', { p_slug: slug });
        }

        return { data: outfit, error: e };
      }),
  );

  return {
    outfit: data,
    loading,
    error,
    // Da tai xong ma khong co du lieu nghia la khong ton tai, hoac RLS khong
    // cho nguoi nay xem (bai chua duyet cua nguoi khac).
    notFound: !loading && !error && data === null,
  };
}
