/**
 * Xac dinh nien menh Ngu hanh Nap am tu ngay sinh, va suy ra goi y mau.
 *
 * PHAM VI SU DUNG: day la mot bo loc THAM KHAO ve mau sac trong thoi trang.
 * Khong dua ra bat ky du doan nao ve van menh, suc khoe, tai loc hay tuong lai.
 * Nguoi dung tat duoc hoan toan (user_private.element_enabled).
 *
 * Uu tien: so thich thuc te cua nguoi dung LUON cao hon yeu to menh. Xem
 * scoreOutfit() trong src/lib/scoring.ts — menh chi la diem cong nho, khong
 * phai bo loc cung. Neu loc cung theo menh thi nguoi menh Thuy chi con thay
 * do den va xanh, catalog ngheo di ngay.
 */

import { convertSolarToLunar, type LunarDate } from './lunar';

export type NguHanh = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho';

export const NGU_HANH_LABEL: Record<NguHanh, string> = {
  kim: 'Kim',
  moc: 'Mộc',
  thuy: 'Thủy',
  hoa: 'Hỏa',
  tho: 'Thổ',
};

/** x sinh ra SINH[x]. Vong tuong sinh: Kim -> Thuy -> Moc -> Hoa -> Tho -> Kim */
const SINH: Record<NguHanh, NguHanh> = {
  kim: 'thuy',
  thuy: 'moc',
  moc: 'hoa',
  hoa: 'tho',
  tho: 'kim',
};

/** x khac KHAC[x]. Kim khac Moc, Moc khac Tho, Tho khac Thuy, Thuy khac Hoa, Hoa khac Kim */
const KHAC: Record<NguHanh, NguHanh> = {
  kim: 'moc',
  moc: 'tho',
  tho: 'thuy',
  thuy: 'hoa',
  hoa: 'kim',
};

const invert = (m: Record<NguHanh, NguHanh>): Record<NguHanh, NguHanh> =>
  Object.fromEntries(
    Object.entries(m).map(([k, v]) => [v, k]),
  ) as Record<NguHanh, NguHanh>;

/** Hanh nao SINH RA hanh nay (hanh "me"). Mau cua no la mau tuong sinh. */
const DUOC_SINH_BOI = invert(SINH);

/** Hanh nao KHAC hanh nay. Mau cua no la mau nen han che. */
const BI_KHAC_BOI = invert(KHAC);

export const CAN = [
  'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý',
] as const;

export const CHI = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ',
  'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
] as const;

/**
 * Bang Ngu hanh Nap am, 30 cap can chi phu kin vong 60 nam.
 * Moc: nam 1984 la Giap Tu, ung voi phan tu thu 0.
 */
const NAP_AM: ReadonlyArray<{ label: string; element: NguHanh }> = [
  { label: 'Hải Trung Kim',   element: 'kim'  }, // Giáp Tý  – Ất Sửu
  { label: 'Lư Trung Hỏa',    element: 'hoa'  }, // Bính Dần – Đinh Mão
  { label: 'Đại Lâm Mộc',     element: 'moc'  }, // Mậu Thìn – Kỷ Tỵ
  { label: 'Lộ Bàng Thổ',     element: 'tho'  }, // Canh Ngọ – Tân Mùi
  { label: 'Kiếm Phong Kim',  element: 'kim'  }, // Nhâm Thân – Quý Dậu
  { label: 'Sơn Đầu Hỏa',     element: 'hoa'  }, // Giáp Tuất – Ất Hợi
  { label: 'Giản Hạ Thủy',    element: 'thuy' }, // Bính Tý  – Đinh Sửu
  { label: 'Thành Đầu Thổ',   element: 'tho'  }, // Mậu Dần  – Kỷ Mão
  { label: 'Bạch Lạp Kim',    element: 'kim'  }, // Canh Thìn – Tân Tỵ
  { label: 'Dương Liễu Mộc',  element: 'moc'  }, // Nhâm Ngọ – Quý Mùi
  { label: 'Tuyền Trung Thủy',element: 'thuy' }, // Giáp Thân – Ất Dậu
  { label: 'Ốc Thượng Thổ',   element: 'tho'  }, // Bính Tuất – Đinh Hợi
  { label: 'Tích Lịch Hỏa',   element: 'hoa'  }, // Mậu Tý   – Kỷ Sửu
  { label: 'Tùng Bách Mộc',   element: 'moc'  }, // Canh Dần – Tân Mão
  { label: 'Trường Lưu Thủy', element: 'thuy' }, // Nhâm Thìn – Quý Tỵ
  { label: 'Sa Trung Kim',    element: 'kim'  }, // Giáp Ngọ – Ất Mùi
  { label: 'Sơn Hạ Hỏa',      element: 'hoa'  }, // Bính Thân – Đinh Dậu
  { label: 'Bình Địa Mộc',    element: 'moc'  }, // Mậu Tuất – Kỷ Hợi
  { label: 'Bích Thượng Thổ', element: 'tho'  }, // Canh Tý  – Tân Sửu
  { label: 'Kim Bạch Kim',    element: 'kim'  }, // Nhâm Dần – Quý Mão
  { label: 'Phú Đăng Hỏa',    element: 'hoa'  }, // Giáp Thìn – Ất Tỵ
  { label: 'Thiên Hà Thủy',   element: 'thuy' }, // Bính Ngọ – Đinh Mùi
  { label: 'Đại Trạch Thổ',   element: 'tho'  }, // Mậu Thân – Kỷ Dậu
  { label: 'Thoa Xuyên Kim',  element: 'kim'  }, // Canh Tuất – Tân Hợi
  { label: 'Tang Đố Mộc',     element: 'moc'  }, // Nhâm Tý  – Quý Sửu
  { label: 'Đại Khê Thủy',    element: 'thuy' }, // Giáp Dần – Ất Mão
  { label: 'Sa Trung Thổ',    element: 'tho'  }, // Bính Thìn – Đinh Tỵ
  { label: 'Thiên Thượng Hỏa',element: 'hoa'  }, // Mậu Ngọ  – Kỷ Mùi
  { label: 'Thạch Lựu Mộc',   element: 'moc'  }, // Canh Thân – Tân Dậu
  { label: 'Đại Hải Thủy',    element: 'thuy' }, // Nhâm Tuất – Quý Hợi
];

/** Nam Giap Tu gan nhat dung lam moc cho vong 60. */
const GIAP_TU_ANCHOR = 1984;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Can Chi cua mot nam AM LICH. Vi du 2024 -> "Giáp Thìn". */
export function canChiOfLunarYear(lunarYear: number): string {
  return `${CAN[mod(lunarYear + 6, 10)]} ${CHI[mod(lunarYear + 8, 12)]}`;
}

/** Nien menh Nap am cua mot nam AM LICH. */
export function napAmOfLunarYear(lunarYear: number): {
  label: string;
  element: NguHanh;
} {
  const cycle = mod(lunarYear - GIAP_TU_ANCHOR, 60);
  return NAP_AM[Math.floor(cycle / 2)];
}

export interface ColorGuidance {
  /** Hanh sinh ra menh. Mau nay duoc coi la tot nhat. */
  tuongSinh: NguHanh;
  /** Chinh hanh cua menh. Mau nay duoc coi la hop. */
  banMenh: NguHanh;
  /** Hanh khac menh. Mau nay nen han che. */
  hanChe: NguHanh;
}

export function colorGuidanceFor(element: NguHanh): ColorGuidance {
  return {
    tuongSinh: DUOC_SINH_BOI[element],
    banMenh: element,
    hanChe: BI_KHAC_BOI[element],
  };
}

export interface MenhResult {
  lunar: LunarDate;
  canChi: string;
  element: NguHanh;
  elementLabel: string;
  colors: ColorGuidance;
}

/**
 * Phan tich ngay sinh duong lich (dinh dang 'YYYY-MM-DD') ra nien menh.
 * Tra ve null neu chuoi khong hop le hoac nam ngoai khoang thuat toan tin cay.
 */
export function analyzeBirthDate(isoDate: string): MenhResult | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;

  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  // Thuat toan tin cay trong khoang nay; ngoai ra tu choi thay vi tra so sai.
  if (yy < 1900 || yy > 2199) return null;

  // Chan ngay khong ton tai kieu 31/02
  const probe = new Date(Date.UTC(yy, mm - 1, dd));
  if (
    probe.getUTCFullYear() !== yy ||
    probe.getUTCMonth() !== mm - 1 ||
    probe.getUTCDate() !== dd
  ) {
    return null;
  }

  const lunar = convertSolarToLunar(dd, mm, yy);
  const napAm = napAmOfLunarYear(lunar.year);

  return {
    lunar,
    canChi: canChiOfLunarYear(lunar.year),
    element: napAm.element,
    elementLabel: napAm.label,
    colors: colorGuidanceFor(napAm.element),
  };
}

/**
 * Cau giai thich ngan hien cho nguoi dung. Co y dung tu "duoc cho la" va
 * "tham khao" — khong khang dinh, khong hua hen.
 */
export function explainMenh(r: MenhResult): string {
  const g = r.colors;
  return (
    `Năm âm lịch ${r.lunar.year} (${r.canChi}), niên mệnh ${r.elementLabel} — ` +
    `hành ${NGU_HANH_LABEL[r.element]}. Theo quan niệm ngũ hành, ` +
    `màu thuộc hành ${NGU_HANH_LABEL[g.tuongSinh]} được cho là tương sinh, ` +
    `màu thuộc hành ${NGU_HANH_LABEL[g.banMenh]} là bản mệnh, ` +
    `màu thuộc hành ${NGU_HANH_LABEL[g.hanChe]} nên hạn chế. ` +
    `Đây chỉ là gợi ý màu sắc mang tính tham khảo trong phối đồ.`
  );
}
