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
 */
export const SIZE_SCALE: Record<string, string> = {
  'rat-nho': '0.8',
  nho: '0.9',
  vua: '1',
  lon: '1.15',
  'rat-lon': '1.35',
};

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
  display: { font: 'be-vietnam', size: 'vua', weight: 'manh', color: 'theo-giao-dien', case: 'nhu-go' },
  heading: { font: 'be-vietnam', size: 'vua', weight: 'manh', color: 'theo-giao-dien', case: 'nhu-go' },
  body: { font: 'be-vietnam', size: 'vua', weight: 'thuong', color: 'theo-giao-dien', case: 'nhu-go' },
  button: { font: 'be-vietnam', size: 'vua', weight: 'dam', color: 'theo-giao-dien', case: 'in-hoa' },
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
    lines.push(`--type-${role}-scale: ${SIZE_SCALE[size] ?? SIZE_SCALE.vua};`);
    lines.push(`--type-${role}-weight: ${WEIGHT[weight] ?? WEIGHT.thuong};`);
    lines.push(`--type-${role}-case: ${CASE[textCase] ?? CASE['nhu-go']};`);

    // Mau rong = de nguyen mau cua he thong giao dien, tuc la van tu doi theo
    // che do sang/toi. `inherit` o day chinh la duong thoat do.
    const hex = TEXT_COLOR[color] ?? '';
    lines.push(`--type-${role}-color: ${hex || 'inherit'};`);
  }

  return `:root{${lines.join('')}}`;
}
