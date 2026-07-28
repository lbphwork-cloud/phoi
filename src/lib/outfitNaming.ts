/**
 * Dat ten va viet mo ta set do BANG QUY TAC, khong goi AI.
 *
 * ===========================================================================
 * VI SAO QUY TAC TRUOC, AI SAU
 *
 * Mot cai ten set do khong phai bai van. No chi can tra loi ba cau: phong cach
 * gi, mau gi, mac dip nao. Ba thu do NGUOI DUNG DA CHON RO RANG trong form —
 * chung nam san trong bien, khong phai suy ra tu dau ca.
 *
 * Goi mot mo hinh ngon ngu de ghep ba chuoi da biet lai voi nhau la:
 *   - Cham: mot vong goi mang, thuong 2-5 giay.
 *   - Ton tien, hoac ton han muc mien phi.
 *   - Can API key — ma phan lon nguoi dang bai se khong co.
 *   - Khong on dinh: cung mot dau vao co the ra hai cai ten khac nhau.
 *
 * Quy tac thi tuc thi, mien phi, chay duoc khi mat mang, va cho ra ket qua
 * doan truoc duoc. AI chi nen duoc goi khi quy tac KHONG lam noi.
 *
 * KHI NAO THI QUY TAC KHONG LAM NOI
 *   Ten: gan nhu luon lam duoc, mien co phong cach. Chi bo cuoc khi chua chon
 *   phong cach — luc do khong co gi de dat ten ca.
 *
 *   Mo ta: quy tac viet duoc mot doan DUNG va DU — no liet ke that nhung mon
 *   trong set va noi ro dip dung. Cai no khong lam duoc la giong nguoi viet.
 *   Nen quy tac lo phan "co mot ban nhap tu te ngay lap tuc", con AI de danh
 *   cho ai muon mot doan co giong dieu rieng.
 * ===========================================================================
 */

export interface NamingInput {
  styleLabel: string;
  occasionLabel: string;
  /** Ten mau tieng Viet cua ca set, vi du ['Trắng', 'Đen'] */
  colorLabels: string[];
  items: Array<{ roleLabel: string; name: string; colorLabel?: string }>;
}

/** Bo dau va ha chu thuong — dung de so trung, khong dung de hien. */
const thuong = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

/**
 * Rut goi cot loi cua mot ten hang tren san.
 *
 * Ten hang tren Shopee va TikTok duoc nhoi day tu khoa de len tim kiem:
 * "[ Phiên Bản Nâng Cấp ] Áo Thun NOWHERE From Relaxfit Tôn dáng KHÔNG ôm body
 * VẢI EM PÉ - Thời trang đơn giản, chất liệu cao cấp". Dat nguyen cai do vao
 * ten set do thi khong con la ten nua.
 *
 * Cat theo ba buoc: bo cac cum trong ngoac (thuong la nhan khuyen mai), cat o
 * dau cau dau tien, roi giu toi da bon tu.
 */
export function cotLoiTenHang(raw: string): string {
  let s = raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[-–—,|.]/)[0];

  s = s.replace(/\s+/g, ' ').trim();

  // Bo cac tu chi doi tuong, khong noi len mon do la gi
  const bo = new Set(['nam', 'nu', 'unisex', 'form', 'local', 'brand', 'chinh', 'hang']);
  const tu = s.split(' ').filter((t) => t && !bo.has(thuong(t)));
  const cat = tu.slice(0, 4);

  /*
    BO TU CUT O CUOI.

    Cat cung 4 tu de lai nhung duoi cau lung lung: "Giày sneaker trắng đế cao
    su" -> "giày sneaker trắng đế". Chu "đế" mot minh khong noi len gi va doc
    ra nhu mot cau bi cat ngang.

    Day la nhung tu MO DAU mot cum bo nghia — chung luon phai co tu dung sau.
    Dung o cuoi thi bo di.
  */
  const treo = new Set(['de', 'co', 'tay', 'form', 'chat', 'vai', 'kieu', 'loai', 'phoi', 'voi']);
  while (cat.length > 2 && treo.has(thuong(cat[cat.length - 1]))) cat.pop();

  return cat.join(' ');
}

/**
 * Dat ten set do bang quy tac. Tra ve null khi khong du du lieu de dat mot cai
 * ten co nghia — luc do nguoi goi moi nen nghi den AI.
 *
 * Mau ten: "<Phong cach> <mau> — <dip>"
 *   "Smart casual trắng đen — đi làm"
 *   "Streetwear olive — đi chơi cuối tuần"
 *
 * Khong nhoi ten mon vao: mot cai ten co bon mon liet ke ra la mot danh sach,
 * khong phai mot cai ten. Cac mon da hien ngay ben duoi trong chinh bai.
 */
export function datTenTheoQuyTac(input: NamingInput): string | null {
  const style = input.styleLabel.trim();
  if (!style) return null;

  // Toi da hai mau. Ba mau tro len thi cai ten dai hon phan noi dung cua no.
  const mau = input.colorLabels.slice(0, 2).map((c) => c.toLowerCase());
  const dip = input.occasionLabel.trim().toLowerCase();

  const dau = mau.length ? `${style} ${mau.join(' ')}` : style;
  return dip ? `${dau} — ${dip}` : dau;
}

/**
 * Viet mo ta bang quy tac. Tra ve null khi con qua it thong tin de noi duoc
 * dieu gi that — mot doan chung chung con te hon o trong.
 *
 * Doan viet ra CHI NOI NHUNG GI CO TRONG DU LIEU. Khong mot tinh tu nao ve
 * chat lieu, do ben hay cam giac mac — day la mot trang gan link tiep thi, va
 * mot loi khen khong ai kiem chung duoc thi khong nen tu dong sinh ra.
 */
export function vietMoTaTheoQuyTac(input: NamingInput): string | null {
  const co = input.items.filter((i) => i.name.trim());
  if (co.length < 2) return null;

  const ten = co.map((i) => {
    const loi = cotLoiTenHang(i.name).toLowerCase();
    if (!i.colorLabel) return loi;

    // KHONG NOI MAU HAI LAN. Nguoi ban thuong da viet mau vao ngay trong ten
    // ("Giày sneaker trắng"), nen noi them nhan mau vao sau se ra "giày
    // sneaker trắng đế trắng" — doc ra la mot loi.
    const daCo = thuong(loi).includes(thuong(i.colorLabel));
    return daCo ? loi : `${loi} ${i.colorLabel.toLowerCase()}`;
  });

  const cau1 = `Set gồm ${ten.slice(0, -1).join(', ')} và ${ten[ten.length - 1]}.`;

  const dip = input.occasionLabel.trim().toLowerCase();
  const style = input.styleLabel.trim().toLowerCase();
  const cau2 = dip && style
    ? `Kiểu ${style}, hợp khi ${dip}.`
    : dip ? `Hợp khi ${dip}.` : style ? `Kiểu ${style}.` : '';

  const mau = input.colorLabels.slice(0, 3).map((c) => c.toLowerCase());
  const cau3 = mau.length ? `Bảng màu: ${mau.join(', ')}.` : '';

  return [cau1, cau2, cau3].filter(Boolean).join(' ');
}

/**
 * Con thieu gi de quy tac lam viec duoc. Tra ve mang rong nghia la du.
 *
 * Tach ra thanh ham rieng de giao dien noi duoc LY DO thay vi chi lam mo cai
 * nut — mot cai nut bi mo ma khong noi vi sao la mot cai nut hong.
 */
export function thieuGiDeDatTen(input: NamingInput): string[] {
  const thieu: string[] = [];
  if (!input.styleLabel.trim()) thieu.push('Chưa chọn phong cách.');
  return thieu;
}

export function thieuGiDeVietMoTa(input: NamingInput): string[] {
  const thieu: string[] = [];
  const co = input.items.filter((i) => i.name.trim()).length;
  if (co < 2) thieu.push('Cần ít nhất 2 món đã có tên.');
  return thieu;
}
