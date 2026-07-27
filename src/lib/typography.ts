'use client';

/**
 * Kieu chu toan website, do quan tri vien chon.
 *
 * BON VAI TRO, KHONG PHAI BON MUOI BAY O
 *   Chu website muon chinh font, co, mau cho "tat ca cac phan text". Hieu theo
 *   nghia den la 47 o noi dung nhan 5 thuoc tinh = gan 240 nut — mot trang
 *   quan tri khong ai dung noi, va mot website moi cho mot kieu chu.
 *
 *   Thay vao do, chu tren toan site duoc quy ve BON VAI TRO. Doi vai tro nao
 *   thi moi cho dung vai tro do doi theo, moi trang cung luc. It nut hon,
 *   va quan trong hon: khong tao ra duoc mot trang khong dong bo.
 *
 * CACH NO CHAY TOI CSS
 *   Cac lua chon duoc do thanh bien CSS tren :root bang mot the <style> sinh
 *   luc chay. globals.css doc cac bien do. Nho vay khong component nao phai
 *   biet gi ve he thong nay — ke ca cac component chua viet.
 *
 * MAC DINH LA GIA TRI DANG CHAY HIEN TAI
 *   Moi gia tri mac dinh o day bang dung voi so da viet cung trong globals.css
 *   truoc khi co tinh nang nay. Khong ai bam gi thi website khong doi mot ly
 *   nao — day la dieu kien de mot tinh nang tuy chinh khong tro thanh mot dot
 *   thay doi giao dien ngoai y muon.
 */

/** Cac font da kiem tra that la CO bo chu tieng Viet. Xem chu thich o layout.tsx. */
export const FONT_STACK: Record<string, string> = {
  'be-vietnam': 'var(--font-be-vietnam), ui-sans-serif, system-ui, sans-serif',
  inter: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  manrope: 'var(--font-manrope), ui-sans-serif, system-ui, sans-serif',
  montserrat: 'var(--font-montserrat), ui-sans-serif, system-ui, sans-serif',
  playfair: 'var(--font-playfair), ui-serif, Georgia, serif',
  garamond: 'var(--font-garamond), ui-serif, Georgia, serif',
  oswald: 'var(--font-oswald), ui-sans-serif, system-ui, sans-serif',
};

export const FONT_LABEL: Record<string, string> = {
  'be-vietnam': 'Be Vietnam Pro (mặc định)',
  inter: 'Inter — sạch, trung tính',
  manrope: 'Manrope — hình học, hiện đại',
  montserrat: 'Montserrat — rộng, dứt khoát',
  playfair: 'Playfair Display — serif tương phản cao',
  garamond: 'EB Garamond — serif cổ điển',
  oswald: 'Oswald — hẹp, mạnh',
};

/**
 * He so co chu, nhan vao co goc.
 *
 * DUNG HE SO CHU KHONG PHAI SO PIXEL. Co chu goc dat bang clamp() nen no da tu
 * co gian theo be ngang man hinh; gan mot so pixel cung se pha mat dieu do va
 * tieu de se tran ra ngoai tren dien thoai.
 *
 * NAM MUC NAY GIU LAI CHI DE DOC GIA TRI CU. Chung tung la lua chon duy nhat,
 * va dai cua chung qua hep — "Rat lon" moi chi 1,35 lan, khong du de lam mot
 * tieu de that su lon. Gio nguoi dung go thang so phan tram; bang nay chi con
 * viec dich cac gia tri da luu truoc do.
 */
export const SIZE_SCALE: Record<string, string> = {
  'rat-nho': '0.8',
  nho: '0.9',
  vua: '1',
  lon: '1.15',
  'rat-lon': '1.35',
};

/** Chan tren va chan duoi cua co chu, tinh theo phan tram. */
export const SIZE_MIN = 50;
export const SIZE_MAX = 400;

/**
 * Doi mot gia tri co chu thanh he so nhan.
 *
 * NHAN CA HAI DANG:
 *   - so phan tram do nguoi dung go: "180" -> 1.8
 *   - ten muc cu da luu trong database: "rat-lon" -> 1.35
 *
 * Tra ve null khi khong doc duoc, de ben goi biet la "chua dat" chu khong phai
 * "dat bang 1" — hai truong hop nay khac nhau: chua dat thi de tang duoi quyet
 * dinh, con dat bang 1 la co y giu nguyen co goc.
 *
 * KEP TRONG KHOANG cho phep: mot con so go nham (vi du 4000) khong duoc phep
 * lam vo bo cuc ca trang.
 */
export function resolveSize(raw: string): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;

  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.min(SIZE_MAX, Math.max(SIZE_MIN, n)) / 100);
  }
  return SIZE_SCALE[v] ?? null;
}

export const WEIGHT: Record<string, string> = {
  manh: '300',
  thuong: '400',
  vua: '500',
  dam: '600',
  'rat-dam': '700',
};

/**
 * Mau chu.
 *
 * 'theo-giao-dien' la mac dinh va la lua chon DUY NHAT tu doi theo che do sang
 * / toi. Cac mau con lai la mau co dinh: chon mau trang thi o che do sang se
 * khong doc duoc chu nao. Cau canh bao nay duoc viet thang vao goi y cua o
 * chon trong trang quan tri, khong giau trong ma nguon.
 */
export const TEXT_COLOR: Record<string, string> = {
  'theo-giao-dien': '',
  den: '#14120f',
  xam: '#5c574f',
  'xam-nhat': '#918a7e',
  nau: '#6b4f3a',
  trang: '#ffffff',
};

export const CASE: Record<string, string> = {
  'nhu-go': 'none',
  'in-hoa': 'uppercase',
};

/** Bon vai tro chu tren toan site. */
export const ROLES = ['display', 'heading', 'body', 'button'] as const;
export type TypeRole = (typeof ROLES)[number];

export const ROLE_LABEL: Record<TypeRole, string> = {
  display: 'Tiêu đề lớn',
  heading: 'Tiêu đề nhỏ',
  body: 'Chữ thường',
  button: 'Nút bấm',
};

/** Gia tri mac dinh — bang dung voi globals.css truoc khi co tinh nang nay. */
const DEFAULTS: Record<TypeRole, { font: string; size: string; weight: string; color: string; case: string }> = {
  display: { font: 'be-vietnam', size: '100', weight: 'manh', color: 'theo-giao-dien', case: 'nhu-go' },
  heading: { font: 'be-vietnam', size: '100', weight: 'manh', color: 'theo-giao-dien', case: 'nhu-go' },
  body: { font: 'be-vietnam', size: '100', weight: 'thuong', color: 'theo-giao-dien', case: 'nhu-go' },
  button: { font: 'be-vietnam', size: '100', weight: 'dam', color: 'theo-giao-dien', case: 'in-hoa' },
};

/**
 * Sinh phan CSS cho :root tu cac lua chon.
 *
 * Tra ve CHUOI CSS chu khong phai doi tuong style: cac bien nay phai nam o cap
 * :root de moi quy tac trong globals.css doc duoc, va React khong dat duoc
 * bien CSS len :root bang thuoc tinh style.
 */
export function typographyCss(t: (key: string, fallback: string) => string): string {
  const lines: string[] = [];

  for (const role of ROLES) {
    const d = DEFAULTS[role];
    const font = t(`type.${role}.font`, d.font);
    const size = t(`type.${role}.size`, d.size);
    const weight = t(`type.${role}.weight`, d.weight);
    const color = t(`type.${role}.color`, d.color);
    const textCase = t(`type.${role}.case`, d.case);

    lines.push(`--type-${role}-font: ${FONT_STACK[font] ?? FONT_STACK['be-vietnam']};`);
    lines.push(`--type-${role}-scale: ${resolveSize(size) ?? '1'};`);
    lines.push(`--type-${role}-weight: ${WEIGHT[weight] ?? WEIGHT.thuong};`);
    lines.push(`--type-${role}-case: ${CASE[textCase] ?? CASE['nhu-go']};`);

    // Mau rong = de nguyen mau cua he thong giao dien, tuc la van tu doi theo
    // che do sang/toi. `inherit` o day chinh la duong thoat do.
    const hex = TEXT_COLOR[color] ?? '';
    lines.push(`--type-${role}-color: ${hex || 'inherit'};`);
  }

  return `:root{${lines.join('')}}`;
}

// ---------------------------------------------------------------------------
// GHI DE KIEU CHU CHO TUNG O
//
// Bon vai tro o tren la NEN CHUNG cho ca website. Phan duoi day la lop ghi de:
// mot o chu cu the co the tu quyet font, co, do dam, nghieng va mau cua rieng
// no, bat ke vai tro noi gi.
//
// VI SAO CAN CA HAI TANG
//   Chi co vai tro thi khong pha cach duoc o cho can. Chi co ghi de tung o thi
//   doi font toan site tro thanh bon muoi thao tac, va chi can quen mot o la
//   trang mat dong bo. Hai tang giai quyet ca hai: mac dinh theo vai tro, ghi
//   de khi co ly do.
//
// MOT DONG DU LIEU CHO CA CUM, KHONG PHAI NAM DONG
//   Tach nam dong thi 47 o se de ra 235 dong trong bang noi dung — dung cai me
//   cung ma chu website vua phai loi qua de tim muc "Kieu chu". Ca cum duoc ma
//   hoa vao mot chuoi ngan: "font=playfair;size=lon;weight=dam;italic=1".
//
//   Dinh dang tu dat chu khong dung JSON: gia tri nay nam trong mot cot text ma
//   con nguoi co the doc va sua thang trong SQL editor. JSON co dau ngoac kep
//   va dau phay lam viec do kho hon han ma khong duoc them gi.
// ---------------------------------------------------------------------------

export interface FieldStyle {
  font?: string;
  size?: string;
  weight?: string;
  color?: string;
  italic?: boolean;
  /** 'nhu-go' | 'in-hoa'. Vai tro chung cung co thuoc tinh nay; day la ghi de. */
  case?: string;
}

/** Doc chuoi ma hoa. Chuoi rong, sai dinh dang, hay khoa la deu ra {} — mot o
 *  kieu chu hong khong duoc phep lam mat chu tren trang. */
export function parseFieldStyle(raw: string): FieldStyle {
  const out: FieldStyle = {};
  if (!raw || !raw.trim()) return out;

  for (const part of raw.split(';')) {
    const [k, v] = part.split('=').map((x) => x?.trim());
    if (!k || !v) continue;
    if (k === 'font' && FONT_STACK[v]) out.font = v;
    else if (k === 'size' && resolveSize(v) !== null) out.size = v;
    else if (k === 'weight' && WEIGHT[v]) out.weight = v;
    else if (k === 'color' && v in TEXT_COLOR) out.color = v;
    else if (k === 'italic') out.italic = v === '1';
    else if (k === 'case' && CASE[v]) out.case = v;
  }
  return out;
}

export function encodeFieldStyle(s: FieldStyle): string {
  const parts: string[] = [];
  if (s.font) parts.push(`font=${s.font}`);
  if (s.size) parts.push(`size=${s.size}`);
  if (s.weight) parts.push(`weight=${s.weight}`);
  if (s.color) parts.push(`color=${s.color}`);
  if (s.italic) parts.push('italic=1');
  if (s.case) parts.push(`case=${s.case}`);
  return parts.join(';');
}

/**
 * Doi cum ghi de thanh thuoc tinh style cua React.
 *
 * Thuoc tinh nao khong duoc dat thi KHONG XUAT HIEN trong ket qua — de nguyen
 * cho quy tac CSS cua vai tro chay. Dat `undefined` cung khong duoc: React van
 * ghi de va xoa mat gia tri thua ke.
 *
 * Co chu dung `em` chu khong phai he so tren mot so tuyet doi: `em` nhan vao co
 * chu ma phan tu do dang co san, nen mot tieu de lon va mot dong chu nho cung
 * chon "Lon" se to len cung mot ty le, moi cai theo diem xuat phat cua no.
 */
export function fieldStyleCss(s: FieldStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (s.font && FONT_STACK[s.font]) css.fontFamily = FONT_STACK[s.font];
  /*
    LOI DA SUA: `em` TRONG font-size TINH THEO CO CHU CUA PHAN TU CHA.

    Ban truoc doan nay dat `fontSize: '1.35em'` thang len chinh the <h1>. Vi
    `em` trong thuoc tinh font-size khong tinh theo co chu cua chinh phan tu do
    ma tinh theo CHA cua no, ket qua la 1,35 x 16px = 21,6px — trong khi tieu de
    goc la 72px. Chon "Rat lon" lam chu NHO DI hon ba lan.

    Cach chua: cum kieu chu duoc dat len mot the <span> BEN TRONG phan tu, chu
    khong len chinh phan tu. Luc do cha cua span chinh la the mang lop .display,
    nen `em` tinh dung theo co chu that cua tieu de. Xem chu thich o cac cho goi
    trong src/app/page.tsx.
  */
  const scale = s.size ? resolveSize(s.size) : null;
  if (scale) css.fontSize = `${scale}em`;
  if (s.weight && WEIGHT[s.weight]) css.fontWeight = Number(WEIGHT[s.weight]);
  if (s.color && TEXT_COLOR[s.color]) css.color = TEXT_COLOR[s.color];
  if (s.italic) css.fontStyle = 'italic';
  if (s.case && CASE[s.case]) {
    css.textTransform = CASE[s.case] as React.CSSProperties['textTransform'];
  }
  return css;
}

/**
 * Do sang cam nhan duoc cua mot mau, theo cong thuc WCAG.
 *
 * Dung de canh bao khi chu gan nhu chim vao nen. KHONG chan nguoi dung: co
 * nhung luc chu mo la co y (chu chim tren anh toi mau chang han), va mot phep
 * do khong biet phia sau la anh gi.
 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Ty le tuong phan giua hai mau. 1 = giong het, 21 = den tren trang. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Cau canh bao khi mau chu kho doc tren nen giay cua website, hoac null.
 *
 * Chi do voi nen SANG (#faf9f6). Nen toi khong do vi chu tren anh thi nen la
 * buc anh chu khong phai mau nen — do voi mau nen se ra ket qua sai.
 */
export function contrastWarning(colorKey: string): string | null {
  const hex = TEXT_COLOR[colorKey];
  if (!hex) return null;

  const ratio = contrastRatio(hex, '#faf9f6');
  if (ratio >= 4.5) return null;
  if (ratio >= 3) {
    return 'Màu này hơi nhạt trên nền sáng — chữ nhỏ sẽ khó đọc.';
  }
  return 'Màu này gần như chìm vào nền sáng. Chỉ dùng khi chữ nằm trên ảnh tối.';
}
