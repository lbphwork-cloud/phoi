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
  const treo = new Set([
    'de', 'co', 'tay', 'form', 'chat', 'vai', 'kieu', 'loai', 'phoi', 'voi',
    // Them tu thuc te: "Ao Polo Len Xep Ly" cat con 4 tu ra "Ao Polo Len Xep"
    // — chu "xep" mot minh khong noi len gi. Tuong tu "cap cao", "ong suong".
    'xep', 'cap', 'ong', 'dai', 'ngan', 'om', 'dang', 'ban', 'set',
  ]);
  while (cat.length > 2 && treo.has(thuong(cat[cat.length - 1]))) cat.pop();

  return cat.join(' ');
}

/**
 * Bang mau dung de dat ten va viet mo ta.
 *
 * LAY MAU CUA CA SET TRUOC; CHUA CHON THI GOM TU CAC MON.
 *   Mau chu dao la thu nguoi dang chon co y, nen no luon thang. Nhung rat
 *   nhieu bai chua chon — va luc do van co day du thong tin de doan: mau cua
 *   tung mon deu da duoc dien.
 *
 *   Khong co buoc nay thi vua dien mau cho bon mon xong, bam "Dat ten tu dong"
 *   van ra dung cai ten khong co mau nhu truoc, va khong noi vi sao.
 *
 * CHI DE SINH CHU, KHONG GHI VAO DATABASE. Doan tu cac mon la mot phong doan
 * tot cho mot cai ten; no khong du chac de am tham quyet dinh set do nay co
 * hop menh voi ai hay khong. Muon dua vao du lieu that thi bam nut "Lay mau tu
 * cac mon" o khoi mau chu dao — mot hanh dong co y thuc, nhin thay duoc.
 */
export function bangMau(input: NamingInput): string[] {
  if (input.colorLabels.length) return input.colorLabels;

  const gom: string[] = [];
  for (const it of input.items) {
    const m = it.colorLabel?.trim();
    // So sanh da bo dau: 'Trắng' va 'trắng' la mot mau, khong phai hai.
    if (m && !gom.some((x) => thuong(x) === thuong(m))) gom.push(m);
  }
  return gom;
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
/**
 * Mon DE NHAN RA NHAT trong set, de dat lam chu chinh cua cai ten.
 *
 * Uu tien ao, roi den quan. Do la thu mat nhin thay dau tien trong mot buc anh
 * thoi trang, va cung la thu nguoi ta nho khi ke lai mot bo do.
 */
function monChuDao(input: NamingInput): { loi: string; mau?: string } | null {
  const uuTien = ['áo', 'quần'];
  for (const vai of uuTien) {
    const it = input.items.find(
      (x) => x.name.trim() && thuong(x.roleLabel).includes(thuong(vai)),
    );
    if (it) return { loi: cotLoiTenHang(it.name), mau: it.colorLabel };
  }
  return null;
}

/**
 * Dat ten set do bang quy tac.
 *
 * MAU TEN CU QUA NGAN, va chu website noi thang: "ten qua ngan".
 *   "Smart casual trắng đen — đi làm"
 *   "Streetwear olive — đi chơi cuối tuần"
 *   Ba cai ten cua ba bo do khac han nhau van co the giong het nhau, vi chung
 *   chi mang phong cach va mau. Doc mot danh sach nhu vay khong phan biet duoc
 *   bai nao voi bai nao.
 *
 * MAU TEN MOI dat MON CHU DAO len truoc, roi den mau, roi den dip:
 *   "Sơ mi oxford trắng phối quần tây — đi làm"
 *   "Áo polo len xám phối quần âu be — đi làm"
 *   "Hoodie nỉ xám — đi chơi cuối tuần"
 *
 *   Ten mon lay tu cot loi cua ten hang tren san (bo tu khoa quang cao), nen
 *   no la chu THAT ve bo do chu khong phai chu trang tri.
 *
 * VAN LUI VE MAU CU khi chua co mon nao co ten — luc do phong cach va mau la
 * tat ca nhung gi biet, va mot cai ten ngan van hon mot o trong.
 */
export function datTenTheoQuyTac(input: NamingInput): string | null {
  const style = input.styleLabel.trim();
  if (!style) return null;

  const dip = input.occasionLabel.trim().toLowerCase();
  const dinhKem = (dau: string) => (dip ? `${dau} — ${dip}` : dau);

  const chinh = monChuDao(input);
  if (!chinh || !chinh.loi) {
    // Chua co mon nao: quay ve mau ten cu.
    const mau = bangMau(input).slice(0, 2).map((c) => c.toLowerCase());
    return dinhKem(mau.length ? `${style} ${mau.join(' ')}` : style);
  }

  // Mau cua chinh mon do neu ten mon chua noi ra. Khong noi mau hai lan.
  const mauChinh = chinh.mau && !thuong(chinh.loi).includes(thuong(chinh.mau))
    ? chinh.mau.toLowerCase()
    : '';

  // Mon thu hai chi de ghep, khong can mau — hai mau trong mot cai ten la du.
  const phu = input.items.find(
    (x) => x.name.trim() && thuong(x.roleLabel).includes('quan')
      && cotLoiTenHang(x.name) !== chinh.loi,
  );

  const dau = hoaDau([chinh.loi, mauChinh].filter(Boolean).join(' '));
  const ghep = phu && chinh.loi !== cotLoiTenHang(phu.name)
    ? `${dau} phối ${cotLoiTenHang(phu.name).toLowerCase()}`
    : dau;

  // Cat cho ten khong dai qua o nhap (120 ky tu) va khong dai qua mot dong.
  const ten = dinhKem(ghep);
  return ten.length <= 80 ? ten : dinhKem(dau);
}

/** Viet hoa chu cai dau. Ten set do la mot cai ten, khong phai mot cau. */
const hoaDau = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

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

  const mau = bangMau(input).slice(0, 3).map((c) => c.toLowerCase());
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
