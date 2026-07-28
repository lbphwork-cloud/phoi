/**
 * Doan LOAI HANG va VAI TRO tu ten san pham.
 *
 * TACH RA FILE RIENG de bo kiem chung chay duoc ma khong keo theo ca thu vien
 * Supabase — giong cach guessColor.ts da lam. Mot ham thuan tuy chi nhan chuoi
 * va tra ve chuoi thi khong co ly do gi phai nam canh doan goi mang.
 */

/*
  =============================================================================
  DOAN LOAI HANG TU TEN SAN PHAM

  BAN CU SAI 4 TREN 9 TEN THAT, va sai theo mot kieu rat de bo qua.

    Luat viet khong dau la `ao ` — chu a, chu o, dau cach — dat ra de bat nhung
    ten go thieu dau. Nhung mot chuoi tran nhu vay khop ca BEN TRONG chu khac:

        "Quan Au Nam ... Cap CAO Ong Dung"      -> "cao " chua "ao "
        "Giay sneaker nam de CAO su"            -> "cao " chua "ao "
        "Quan short the THAO nam"               -> "thao " chua "ao "

    Va vi luat "ao" dung dau danh sach, no khop truoc moi luat khac. Mot doi
    giay bi goi la ao.

    Hau qua khong dung o cai nhan: loai quyet dinh VAI TRO trong set, ma vai
    tro di thang vao cau lenh tao anh. Doi giay bi goi la ao thi AI dung ra
    mot cai ao.

  HAI THAY DOI, MOI CAI CHUA MOT NUA VAN DE

    1. TU PHAI DUNG TACH RA. Cac tu khong dau duoc boc trong bien gioi chu
       (`(?<![\p{L}\d])tu(?![\p{L}\d])`), nen "cao" khong con chua "ao".
       Dung `\p{L}` chu khong dung `\b`: `\b` cua JavaScript coi chu co dau
       tieng Viet la ky tu khong phai chu, nen "Áo" se bi cat ngay giua.

    2. TU NAO XUAT HIEN SOM HON TRONG TEN THI THANG, thay vi luat nao dung
       truoc trong danh sach thi thang. Nguoi ban tren san luon dat loai hang
       len dau ten: "Quan Au Nam...", "Giay sneaker...". Chu "ao" trong mot
       ten quan, neu co, hau nhu luon nam o phan duoi — phan liet ke tu khoa
       ("de phoi voi ao thun...").

  Co bo kiem chung chay tren CHINH ten that trong database, xem
  scripts/verify-guess-category.ts.
  =============================================================================
*/

/** Cac tu khoa cua tung loai. Tu khong dau duoc boc bien gioi chu khi ghep. */
const CATEGORY_KEYWORDS: Array<{ cat: string; co: string[]; khong: string[] }> = [
  { cat: 'ao',
    co: ['áo', 'sơ mi', 'khoác'],
    khong: ['ao', 'shirt', 'tee', 'polo', 'hoodie', 'sweater', 'sweatshirt', 'jacket',
            'cardigan', 'somi', 'blazer', 'vest'] },
  { cat: 'quan',
    co: ['quần', 'âu', 'tây'],
    khong: ['quan', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'chino', 'chinos',
            'short', 'shorts', 'jogger', 'joggers', 'denim'] },
  { cat: 'giay',
    co: ['giày', 'dép'],
    khong: ['giay', 'sneaker', 'sneakers', 'shoe', 'shoes', 'sandal', 'sandals',
            'loafer', 'loafers', 'derby', 'boot', 'boots', 'slip'] },
  { cat: 'tui',
    co: ['túi', 'balo'],
    khong: ['tui', 'backpack', 'bag', 'tote'] },
  { cat: 'dong_ho',
    co: ['đồng hồ'],
    khong: ['dong ho', 'watch'] },
  { cat: 'kinh',
    co: ['kính'],
    khong: ['kinh', 'glasses', 'sunglasses', 'eyewear'] },
  { cat: 'mu',
    co: ['mũ', 'nón'],
    khong: ['mu', 'cap', 'hat', 'bucket', 'beanie'] },
];

/** Vi tri xuat hien dau tien cua mot tu trong chuoi, hoac -1. */
function viTriTu(n: string, tu: string, boiBienGioi: boolean): number {
  if (!boiBienGioi) return n.indexOf(tu);

  // \p{L} nhan ca chu co dau tieng Viet; \b cua JavaScript thi khong.
  const re = new RegExp(`(?<![\\p{L}\\d])${tu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d])`, 'u');
  return n.search(re);
}

/** Doan danh muc san pham tu ten, de dien san o chon cho nguoi dung. */
export function guessCategory(name: string): string {
  const n = name.toLowerCase();

  let tot: { cat: string; at: number } | null = null;

  for (const { cat, co, khong } of CATEGORY_KEYWORDS) {
    let som = -1;
    // Tu CO DAU khong can bien gioi: "áo" khong nam lot trong tu tieng Viet nao
    // khac. Tu KHONG DAU thi bat buoc — do chinh la cho ban cu vo.
    for (const tu of co) {
      const i = viTriTu(n, tu, false);
      if (i >= 0 && (som < 0 || i < som)) som = i;
    }
    for (const tu of khong) {
      const i = viTriTu(n, tu, true);
      if (i >= 0 && (som < 0 || i < som)) som = i;
    }
    if (som >= 0 && (!tot || som < tot.at)) tot = { cat, at: som };
  }

  return tot?.cat ?? 'phu_kien';
}

/** Doan vai tro trong set do tu danh muc. */
export function roleFromCategory(cat: string): string {
  const map: Record<string, string> = {
    ao: 'top', quan: 'bottom', giay: 'shoes', tui: 'bag',
    dong_ho: 'watch', kinh: 'glasses', mu: 'hat', phu_kien: 'accessory',
  };
  return map[cat] ?? 'accessory';
}

