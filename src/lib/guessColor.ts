/**
 * Doan mau san pham tu TEN san pham.
 *
 * VI SAO KHONG LAY THANG TU SAN
 *   Toi da doc ca 401 dong cua ham fetch-product: no chi doc duoc the Open
 *   Graph (og:title, og:image, og:description). Shopee va TikTok KHONG dat
 *   thuoc tinh mau vao the Open Graph — mau nam trong danh sach bien the, ma
 *   danh sach do chi xuat hien sau khi JavaScript cua trang do chay. Mot ham
 *   may chu doc HTML tho khong bao gio thay no.
 *
 *   Con phan tich mau chu dao tu chinh buc anh thi can mot bo giai ma JPEG/WEBP
 *   chay duoc trong Deno — thu khong co san, va keo theo mot thu vien nang cho
 *   mot viec phu.
 *
 *   Nhung nguoi ban tren san Viet Nam gan nhu luon viet mau vao ten: "Ao thun
 *   nam co tron mau be", "Quan au navy". Doc tu ten thi khong ton them mot
 *   luot goi mang nao, khong phu thuoc vao HTML cua san — thu doi thang nao
 *   cung doi — va chay ngay tren may nguoi dung.
 *
 * CHI LA GOI Y, KHONG PHAI QUYET DINH
 *   Ket qua duoc dung de TICH SAN cac o mau, nguoi dung van bo tich duoc. Doan
 *   sai mot mau thi mat mot cu bam de sua; khong doan gi thi mat bay cu bam de
 *   chon. Do la ly do nguong o day thien ve doan.
 */

/**
 * Tu khoa cho tung mau, viet thuong va DA BO DAU.
 *
 * Bo dau vi nguoi ban go rat tuy tien — "mau be", "mau bé", "BE", "Beige" deu
 * la mot thu. So sanh sau khi bo dau thi ca bon deu trung.
 *
 * Thu tu trong mang khong quan trong, nhung THU TU CUA CHINH DANH SACH NAY thi
 * co: mau nao co tu khoa DAI hon phai duoc xet truoc, neu khong "xanh navy" se
 * bi "xanh duong" nuot mat. Xem NHOM_DAI_TRUOC ben duoi.
 */
const TU_KHOA: Record<string, string[]> = {
  navy: ['navy', 'xanh navy', 'xanh than', 'xanh tim than'],
  'xanh-duong': ['xanh duong', 'xanh bien', 'xanh coban', 'blue', 'xanh nhat'],
  'xanh-la': ['xanh la', 'xanh reu', 'xanh luc', 'green', 'xanh mint', 'xanh co'],
  olive: ['olive', 'oliu', 'xanh olive', 'xanh reu nhat', 'army', 'xanh linh'],
  'xam-nhat': ['xam nhat', 'xam sang', 'ghi sang', 'xam bac', 'light grey', 'light gray'],
  'xam-dam': ['xam dam', 'xam khoi', 'xam chi', 'ghi dam', 'dark grey', 'dark gray'],
  'nau-nhat': ['nau nhat', 'nau sang', 'nau bo', 'camel', 'nau tay'],
  trang: ['trang', 'white', 'trang sua', 'trang tinh'],
  kem: ['kem', 'cream', 'off white', 'trang kem'],
  be: ['be', 'beige', 'mau be', 'nude'],
  den: ['den', 'black', 'den nham'],
  nau: ['nau', 'brown', 'nau socola', 'nau da', 'nau dam'],
  vang: ['vang', 'yellow', 'vang bo', 'mustard', 'vang chanh'],
  do: ['do', 'red', 'do do', 'do burgundy', 'do ruou'],
  cam: ['cam', 'orange', 'cam dat'],
  hong: ['hong', 'pink', 'hong pastel'],
  tim: ['tim', 'purple', 'tim than', 'tim lavender'],
};

/**
 * Danh sach PHANG cua tung cap (mau, tu khoa), sap theo do dai TU KHOA giam dan.
 *
 * VI SAO PHAI PHANG RA CHU KHONG SAP THEO NHOM
 *   Ban dau toi sap theo tu khoa dai nhat cua moi nhom mau. Sai: nhom "nau" co
 *   "nau socola" (10 ky tu) nen no dung truoc nhom "nau-nhat" (dai nhat 8), va
 *   "Dong ho day da nau nhat" ra mau "nau" thay vi "nau nhat".
 *
 *   Cai quyet dinh khong phai la nhom nao co tu dai nhat, ma la TU NAO khop
 *   truoc. Phang ra roi sap tung tu thi "nau nhat" (8) luon duoc thu truoc
 *   "nau" (3), bat ke chung thuoc nhom nao.
 *
 *   Da bat duoc loi nay bang mot bo kiem chung 14 ten hang that — xem
 *   scripts/verify-guess-color.ts.
 */
const CAP_DAI_TRUOC: Array<{ slug: string; key: string }> = Object.entries(TU_KHOA)
  .flatMap(([slug, keys]) => keys.map((key) => ({ slug, key })))
  .sort((a, b) => b.key.length - a.key.length);

/** Bo dau tieng Viet va dua ve chu thuong. */
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    // Bo cac dau thanh va dau mu da tach ra sau NFD
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Tra ve cac slug mau doan duoc tu ten (va mo ta) san pham.
 *
 * MAC DINH TOI DA HAI MAU. Mot mon do MAC TREN NGUOI hiem khi duoc mo ta bang
 * ba mau tro len; tim ra ba mau thi gan nhu chac chan hai trong so do la doan
 * nham tu mot chu khac — "vang" trong "vang anh", "do" trong "do bo".
 *
 * NHUNG KHI DOC "CAC MAU CON BAN TREN SAN" thi nguoc lai: mot cai ao ban nam
 * mau la binh thuong, va cat con ba mau la mat thong tin that. Do la ly do
 * `max` la tham so chu khong phai so viet cung — hai cach dung, hai nguong.
 */
export function guessColorSlugs(
  text: string,
  allowed?: string[],
  max = 2,
): string[] {
  // `hay` bi CAT DAN trong vong lap: moi lan mot tu khoa khop, doan chu da khop
  // bi xoa khoi chuoi. Khong lam vay thi "nau nhat" khop xong van con nguyen
  // chu "nau" cho mau "nau" khop tiep, va mot mon do ra hai mau nau.
  let hay = ` ${boDau(text)} `;
  const found: string[] = [];

  for (const { slug, key } of CAP_DAI_TRUOC) {
    if (found.length >= max) break;
    if (found.includes(slug)) continue;
    if (allowed && !allowed.includes(slug)) continue;

    // Tu khoa phai co RANG GIOI TU o hai dau. Khong co rang gioi thi "den"
    // khop trong "denim" va "do" khop trong "do bo" — ca hai truong hop nay
    // deu xay ra that voi hang thoi trang.
    const re = new RegExp(
      `(^|[^a-z0-9])(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([^a-z0-9]|$)`,
    );
    const m = re.exec(hay);
    if (!m) continue;

    found.push(slug);
    hay = hay.slice(0, m.index) + ' ' + hay.slice(m.index + m[0].length);
  }

  return found;
}
