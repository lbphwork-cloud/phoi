/**
 * Cham diem outfit de sap xep goi y cho tung nguoi dung.
 *
 * Dung LUAT, khong dung hoc may. Voi vai tram outfit thi luat cho ket qua
 * khong kem hon, ma lai re (chay ngay tren trinh duyet, khong ton server),
 * giai thich duoc cho nguoi dung ("goi y vi ban thich phong cach toi gian"),
 * va sua duoc ngay khi thay sai.
 *
 * BAT BIEN QUAN TRONG — de bai muc 4: "Uu tien so thich thuc te cua nguoi
 * dung cao hon yeu to menh."
 * Duoc dam bao bang cach chon trong so: tong dong gop TOI DA cua menh
 * (MENH_MAX_TOTAL) nho hon dong gop cua mot lan khop phong cach, va nho hon
 * gia tri tuyet doi cua mot lan phan hoi "khong thich mau".
 * scripts/verify-scoring.ts kiem tra dung bat bien nay.
 */

import type { NguHanh } from './nguhanh';
import { colorGuidanceFor } from './nguhanh';

// --- Trong so -------------------------------------------------------------
// So thich truc tiep cua nguoi dung
const W_STYLE_MATCH = 40;
const W_COLOR_MATCH = 12;
const W_COLOR_MATCH_CAP = 24;
const W_PRICE_IN_RANGE = 20;

// Menh — co y dat thap. Tong toi da phai nho hon W_STYLE_MATCH.
const W_ELEM_TUONG_SINH = 8;
const W_ELEM_BAN_MENH = 5;
const W_ELEM_HAN_CHE = -6;
const ELEM_POSITIVE_CAP = 12;
const ELEM_NEGATIVE_CAP = -10;

/** Tong dong gop toi da (ve gia tri tuyet doi) ma yeu to menh co the tao ra. */
export const MENH_MAX_TOTAL = ELEM_POSITIVE_CAP;

// Phan hoi tieu cuc — phai manh hon moi dong gop tich cuc cua menh
const W_DISLIKED_COLOR = -35;
const W_DISLIKED_STYLE = -50;
const W_DISLIKED_PAIRING = -100;

/**
 * Phan hoi TICH CUC cho mot set do cu the.
 *
 * +40 chu khong phai +100 doi xung voi ban tieu cuc. Hai huong nay khong can
 * doi xung, va co y khong doi xung:
 *
 *   "Khong thich" la mot loi tu choi ro rang — nguoi dung dang noi dung cho
 *   toi thay cai nay nua, va he thong phai nghe ngay.
 *
 *   "Thich" la mot loi khen. Neu no manh bang, mot set duoc thich se dinh cung
 *   tren dau danh sach va che mat moi thu khac, ke ca thu nguoi dung chua tung
 *   thay. Danh sach goi y se dong bang lai quanh vai bai da thich.
 *
 * +40 du de day mot set len tren nhung khong du de no doc chiem cho.
 */
const W_LIKED_PAIRING = 40;

// Uu tien nhe noi dung moi de catalog khong bi dong bang
const W_FRESHNESS_MAX = 6;

export interface UserContext {
  preferredStyles: string[];
  preferredColors: string[];
  priceMinVnd: number;
  priceMaxVnd: number;
  /** null neu nguoi dung chua nhap ngay sinh */
  element: NguHanh | null;
  /** false neu nguoi dung tat goi y theo menh */
  elementEnabled: boolean;
  dislikedColors: string[];
  dislikedStyles: string[];
  /** Outfit bi an han — loc bo hoan toan, khong phai tru diem */
  hiddenOutfitIds: string[];
  /** Outfit bi danh dau "khong thich cach phoi" */
  dislikedPairingOutfitIds: string[];
  likedPairingOutfitIds: string[];
}

export interface ScorableOutfit {
  id: string;
  styleSlug: string | null;
  occasionSlug: string | null;
  colorSlugs: string[];
  totalPriceVnd: number | null;
  publishedAt: string | null;
}

/** Ban do slug mau -> hanh, lay tu bang colors trong database. */
export type ColorElementMap = Record<string, NguHanh | null>;

export interface ScoreBreakdown {
  total: number;
  /** Tung phan diem, de giai thich cho nguoi dung va de go loi */
  parts: Array<{ label: string; points: number }>;
}

export function emptyUserContext(): UserContext {
  return {
    preferredStyles: [],
    preferredColors: [],
    priceMinVnd: 0,
    priceMaxVnd: Number.MAX_SAFE_INTEGER,
    element: null,
    elementEnabled: true,
    dislikedColors: [],
    dislikedStyles: [],
    hiddenOutfitIds: [],
    dislikedPairingOutfitIds: [],
    likedPairingOutfitIds: [],
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function scoreOutfit(
  outfit: ScorableOutfit,
  ctx: UserContext,
  colorElements: ColorElementMap,
  now: number = 0,
): ScoreBreakdown {
  const parts: ScoreBreakdown['parts'] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) parts.push({ label, points });
  };

  // --- So thich truc tiep ------------------------------------------------
  if (outfit.styleSlug && ctx.preferredStyles.includes(outfit.styleSlug)) {
    add('Đúng phong cách bạn thích', W_STYLE_MATCH);
  }

  // CO Y khong cham diem theo dip su dung: nguoi dung khong khai bao "toi thich
  // dip nao", vi dip phu thuoc hoan canh tung ngay chu khong phai so thich co
  // dinh. Dip la BO LOC tren trang kham pha, khong phai yeu to xep hang.

  const colorHits = outfit.colorSlugs.filter((c) => ctx.preferredColors.includes(c)).length;
  if (colorHits > 0) {
    add(
      `Có ${colorHits} màu bạn thích`,
      Math.min(colorHits * W_COLOR_MATCH, W_COLOR_MATCH_CAP),
    );
  }

  if (
    outfit.totalPriceVnd !== null &&
    outfit.totalPriceVnd >= ctx.priceMinVnd &&
    outfit.totalPriceVnd <= ctx.priceMaxVnd
  ) {
    add('Trong khoảng giá của bạn', W_PRICE_IN_RANGE);
  }

  // --- Menh (diem cong mem, khong phai bo loc cung) ----------------------
  //
  // PHONG CACH "PHA CACH" DUOC MIEN PHAN TRU DIEM.
  //   Ca y do cua phong cach do la tron mau lech nhau co chu dich. Tru diem no
  //   vi "co mau nen han che theo menh" la dung mot he quy chieu de phat mot
  //   phong cach duoc dinh nghia bang viec pha he quy chieu do.
  //
  //   Phan CONG diem thi van giu: mot set pha cach ma tinh co hop menh thi van
  //   dang duoc uu tien hon, khong co ly do gi bo.
  const isPhaCach = outfit.styleSlug === 'pha-cach';

  if (ctx.element && ctx.elementEnabled) {
    const g = colorGuidanceFor(ctx.element);
    let pos = 0;
    let neg = 0;

    for (const slug of outfit.colorSlugs) {
      const el = colorElements[slug];
      if (!el) continue;
      if (el === g.tuongSinh) pos += W_ELEM_TUONG_SINH;
      else if (el === g.banMenh) pos += W_ELEM_BAN_MENH;
      else if (el === g.hanChe) neg += W_ELEM_HAN_CHE;
    }

    pos = clamp(pos, 0, ELEM_POSITIVE_CAP);
    neg = clamp(neg, ELEM_NEGATIVE_CAP, 0);

    add('Màu hợp mệnh của bạn', pos);
    if (!isPhaCach) add('Có màu nên hạn chế theo mệnh', neg);
  }

  // --- Phan hoi tieu cuc -------------------------------------------------
  const badColors = outfit.colorSlugs.filter((c) => ctx.dislikedColors.includes(c)).length;
  if (badColors > 0) {
    add(`Có ${badColors} màu bạn đã bỏ`, badColors * W_DISLIKED_COLOR);
  }

  if (outfit.styleSlug && ctx.dislikedStyles.includes(outfit.styleSlug)) {
    add('Phong cách bạn đã bỏ', W_DISLIKED_STYLE);
  }

  if (ctx.dislikedPairingOutfitIds.includes(outfit.id)) {
    add('Bạn không thích cách phối này', W_DISLIKED_PAIRING);
  }

  if (ctx.likedPairingOutfitIds.includes(outfit.id)) {
    add('Bạn đã thích cách phối này', W_LIKED_PAIRING);
  }

  // --- Do moi ------------------------------------------------------------
  if (now > 0 && outfit.publishedAt) {
    const ageDays = (now - Date.parse(outfit.publishedAt)) / 86400000;
    if (Number.isFinite(ageDays) && ageDays >= 0) {
      // Giam dan trong 30 ngay dau
      add('Mới đăng', Math.round(W_FRESHNESS_MAX * clamp(1 - ageDays / 30, 0, 1)));
    }
  }

  return { total: parts.reduce((s, p) => s + p.points, 0), parts };
}

/**
 * Sap xep danh sach outfit cho mot nguoi dung.
 * Outfit bi an han duoc LOAI BO khoi ket qua, khong phai chi tru diem.
 */
export function rankOutfits<T extends ScorableOutfit>(
  outfits: T[],
  ctx: UserContext,
  colorElements: ColorElementMap,
  now: number = 0,
): Array<T & { score: ScoreBreakdown }> {
  const hidden = new Set(ctx.hiddenOutfitIds);
  return outfits
    .filter((o) => !hidden.has(o.id))
    .map((o) => ({ ...o, score: scoreOutfit(o, ctx, colorElements, now) }))
    .sort((a, b) => {
      if (b.score.total !== a.score.total) return b.score.total - a.score.total;
      // Bang diem thi uu tien bai moi hon, roi den id de thu tu on dinh
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      if (tb !== ta) return tb - ta;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/**
 * Suy ra so thich tieu cuc tu lich su phan hoi.
 * Nguong 2 lan: mot lan bo mau co the la ngau nhien, hai lan la co y.
 */
export function derivePreferencesFromFeedback(
  events: Array<{ kind: string; target_value: string | null; outfit_id: string | null }>,
  threshold = 2,
): Pick<
  UserContext,
  'dislikedColors' | 'dislikedStyles' | 'hiddenOutfitIds' | 'dislikedPairingOutfitIds'
  | 'likedPairingOutfitIds'
> {
  const colorCount = new Map<string, number>();
  const styleCount = new Map<string, number>();
  const hidden: string[] = [];
  const pairing: string[] = [];
  const liked: string[] = [];

  for (const e of events) {
    switch (e.kind) {
      case 'dislike_color':
        if (e.target_value) {
          colorCount.set(e.target_value, (colorCount.get(e.target_value) ?? 0) + 1);
        }
        break;
      case 'dislike_style':
        if (e.target_value) {
          styleCount.set(e.target_value, (styleCount.get(e.target_value) ?? 0) + 1);
        }
        break;
      case 'hide_outfit':
        if (e.outfit_id) hidden.push(e.outfit_id);
        break;
      case 'dislike_pairing':
        if (e.outfit_id) pairing.push(e.outfit_id);
        break;
      case 'like_pairing':
        if (e.outfit_id) liked.push(e.outfit_id);
        break;
    }
  }

  const atLeast = (m: Map<string, number>) =>
    [...m.entries()].filter(([, n]) => n >= threshold).map(([k]) => k);

  return {
    dislikedColors: atLeast(colorCount),
    dislikedStyles: atLeast(styleCount),
    hiddenOutfitIds: [...new Set(hidden)],
    dislikedPairingOutfitIds: [...new Set(pairing)],
    likedPairingOutfitIds: [...new Set(liked)],
  };
}
