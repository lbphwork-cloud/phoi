/**
 * Kiem chung bo doan mau san pham.
 *
 * Cac ten hang o day viet theo dung cach nguoi ban tren Shopee va TikTok Shop
 * that su dat ten — co dau, khong dau, VIET HOA HET, mau nam giua cau. Do la
 * dieu kien thuc te ma ham phai chiu duoc.
 *
 * Hai truong hop la cai bay co y, va ca hai deu tung lam ham sai:
 *   "Ao khoac denim"  -> khong duoc ra mau "den"     (nam trong chu "denim")
 *   "day da nau nhat" -> phai ra "nau-nhat", khong phai "nau"
 */
import { guessColorSlugs } from '../src/lib/guessColor';
const cases: Array<[string, string[]]> = [
  ['Áo thun nam cổ tròn màu be trơn basic', ['be']],
  ['Quần âu nam xanh navy công sở', ['navy']],
  ['Áo khoác denim nam wash nhẹ', []],
  ['Giày sneaker trắng đế cao su', ['trang']],
  ['Áo sơ mi nam xám nhạt dài tay', ['xam-nhat']],
  ['Quần jogger olive nam', ['olive']],
  ['Áo polo nam màu đen phối trắng', ['den', 'trang']],
  ['Túi đeo chéo nâu da bò', ['nau']],
  ['ÁO HOODIE NAM XÁM ĐẬM FORM RỘNG', ['xam-dam']],
  ['Quan au mau ghi sang', ['xam-nhat']],
  ['Áo len cổ lọ màu kem', ['kem']],
  ['Đồng hồ dây da nâu nhạt', ['nau-nhat']],
  ['Quần short thể thao xanh dương', ['xanh-duong']],
  ['Mũ lưỡi trai đỏ đô', ['do']],
];
let pass = 0, fail = 0;
for (const [ten, mong] of cases) {
  const got = guessColorSlugs(ten);
  const ok = JSON.stringify(got.slice().sort()) === JSON.stringify(mong.slice().sort());
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + ten + ' -> [' + got.join(', ') + ']'
    + (ok ? '' : '  (mong doi: [' + mong.join(', ') + '])'));
  ok ? pass++ : fail++;
}
console.log(`\n>>> ${pass} PASS, ${fail} FAIL`);

if (fail) process.exitCode = 1;
