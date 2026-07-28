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
  /**
   * Bai do he thong dung san de lam day catalog, khong phai nguoi that dang.
   *
   * Dung de XEP XUONG DUOI chu khong de loai bo: chung van la goi y hop le,
   * chi la khong nen che mat bai ma nguoi ta bo cong lam.
   */
  isSeed?: boolean;
}

/** Ban do slug mau -> hanh, lay tu bang colors trong database. */
export type ColorElementMap = Record<string, NguHanh | null>;

/**
 * BA BAC, KHONG PHAI HAI.
 *
 *   2 — ca ao lan quan deu hop menh
 *   1 — mot trong hai mon hop
 *   0 — khong mon nao hop
 *
 * VI SAO KHONG KHOA CUNG O HAI MAU
 *   Ban dau luat la "phai du hai mau moi tinh la hop". Chu website bac lai, va
 *   ly do dung: khoa cung nhu vay thi rat kho phoi do, va nguoi ta co the chi
 *   thich DUNG MOT MON trong bo — mot chiec ao mau hop menh van la mot goi y
 *   that, du chiec quan di kem thuoc hanh khac.
 *
 *   Nguong hai mau van con y nghia, nhung la de XEP TREN chu khong phai de
 *   loai bo. Ba bac giu duoc ca hai dieu: khong bo sot goi y that, ma van noi
 *   duoc set nao hop hon set nao.
 */
export const BAC_HOP_CA_BO = 2;
export const BAC_HOP_MOT_MON = 1;

/** Bac hop menh cua mot set: 2 (ca bo), 1 (mot mon), 0 (khong). */
export function bacHopMenh(
  colorSlugs: string[],
  colorElements: ColorElementMap,
  element: NguHanh,
): 0 | 1 | 2 {
  const n = demMauHopMenh(colorSlugs, colorElements, element);
  return n >= 2 ? 2 : n === 1 ? 1 : 0;
}

/** Dem so mau chu dao thuoc hanh ban menh hoac hanh tuong sinh. */
export function demMauHopMenh(
  colorSlugs: string[],
  colorElements: ColorElementMap,
  element: NguHanh,
): number {
  const g = colorGuidanceFor(element);
  return colorSlugs.filter((slug) => {
    const el = colorElements[slug];
    return el === g.tuongSinh || el === g.banMenh;
  }).length;
}

/** Cac mau chu dao dang hop menh — dung de to dam dung nhung o mau do. */
export function mauHopMenh(
  colorSlugs: string[],
  colorElements: ColorElementMap,
  element: NguHanh,
): string[] {
  const g = colorGuidanceFor(element);
  return colorSlugs.filter((slug) => {
    const el = colorElements[slug];
    return el === g.tuongSinh || el === g.banMenh;
  });
}

/**
 * Co hop menh khong — tu MOT mau tro len la co.
 *
 * Cau hoi "co hop khong" va cau hoi "hop den dau" la hai cau khac nhau. Ham
 * nay tra loi cau thu nhat (dung cho bo loc va cho nhan tren the); `bacHopMenh`
 * tra loi cau thu hai (dung cho thu tu sap xep).
 */
export function laHopMenh(
  colorSlugs: string[],
  colorElements: ColorElementMap,
  element: NguHanh,
): boolean {
  return demMauHopMenh(colorSlugs, colorElements, element) >= BAC_HOP_MOT_MON;
}

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

    /*
      KHONG CO NGUONG O DAY NUA.

      Mot mau hop van duoc cong diem cua rieng no; hai mau hop duoc cong ca hai
      nen tu nhien nhieu diem hon. Phep cong san co da xep dung thu tu ma khong
      can dat nguong — va dat nguong chinh la thu vua bi bo, vi no lam mot set
      co dung mot mon hop menh bien mat khoi goi y.
    */
    pos = clamp(pos, 0, ELEM_POSITIVE_CAP);
    neg = clamp(neg, ELEM_NEGATIVE_CAP, 0);

    const bac = bacHopMenh(outfit.colorSlugs, colorElements, ctx.element);
    add(bac === 2 ? 'Cả áo và quần đều hợp mệnh' : 'Có một món hợp mệnh', pos);
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
  /**
   * Bat khi nguoi dung bam nut "Ưu tiên hợp mệnh".
   *
   * Day KHONG phai them diem — day la mot bac xep tren diem. Cong diem thi bai
   * hop menh van co the bi mot bai dung phong cach yeu thich (+40) vuot len, va
   * nguoi dung bam nut xong khong thay gi doi. Bam mot nut co ten "uu tien" thi
   * phai thay ngay thu minh vua uu tien nam tren cung.
   *
   * Trong bac, thu tu van do diem quyet dinh — nen so thich ca nhan van dinh
   * doat trat tu ben trong nhom hop menh, dung nhu bat bien o dau file.
   */
  uuTienMenh: boolean = false,
): Array<T & { score: ScoreBreakdown }> {
  const hidden = new Set(ctx.hiddenOutfitIds);
  const menh = uuTienMenh && ctx.elementEnabled ? ctx.element : null;

  /*
    CAC BAC XEP TREN DIEM, theo dung thu tu quan trong.

    Gom vao MOT cho thay vi rai ra tung nhanh if trong ham so sanh. Truoc day
    chi co mot bac (menh) va no nam thang trong `sort`; them bac thu hai kieu do
    la bat dau co ba bien `ba`, `bb`, `ba2`, `bb2` va khong ai doc ra duoc thu
    tu uu tien nua.

    Bac dau danh sach = bac quan trong nhat. Doi thu tu hai dong duoi la doi
    han cach xep trang, nen chung nam canh nhau de thay ngay.
  */
  const cacBac: Array<(o: ScorableOutfit) => number> = [
    // 1. BAI CUA NGUOI THAT TRUOC BAI DUNG SAN.
    //    Bai do toi dung de lam day catalog khong duoc dung tren bai ma nguoi
    //    that bo cong dang — du no co hop menh hay dung phong cach den dau.
    (o) => (o.isSeed ? 0 : 1),
    // 2. Hop menh, chi khi nguoi dung dang bat nut uu tien.
    (o) => (menh ? bacHopMenh(o.colorSlugs, colorElements, menh) : 0),
  ];

  return outfits
    .filter((o) => !hidden.has(o.id))
    .map((o) => ({ ...o, score: scoreOutfit(o, ctx, colorElements, now) }))
    .sort((a, b) => {
      for (const bac of cacBac) {
        const d = bac(b) - bac(a);
        if (d !== 0) return d;
      }
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
