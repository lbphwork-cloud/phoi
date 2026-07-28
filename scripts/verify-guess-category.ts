/**
 * Kiem chung bo doan loai hang tu ten san pham.
 *
 * VI SAO BO NAY CAN MOT BO KIEM RIENG
 *   No tung sai 4 tren 9 ten that, va sai hoan toan im lang: nguoi dung chi
 *   thay o "Loai" hien mot gia tri nao do va tuong may doan dung. Cai gia phai
 *   tra nam o cuoi day chuyen — loai quyet dinh vai tro trong set, vai tro di
 *   thang vao cau lenh tao anh, nen mot doi giay bi goi la ao se lam AI dung ra
 *   mot cai ao.
 *
 *   Loi cu: luat viet khong dau `ao ` khop ca ben trong "cao ", "thao ".
 *
 * TEN O DAY LA TEN THAT tren san Viet Nam — nhoi tu khoa, co ngoac, co ca chu
 * tieng Anh chen giua. Do la dieu kien thuc te ma bo doan phai chiu duoc, chu
 * khong phai nhung cai ten sach se do nguoi viet kiem thu bia ra.
 */
import { guessCategory, roleFromCategory } from '../src/lib/guessCategory';

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

/** [ten san pham, loai dung] */
const CA: Array<[string, string]> = [
  // --- Nhung ten TUNG LAM SAI ban cu ---------------------------------------
  ['Quần Âu Nam Đai Chun Ẩn HAPPYORSAD Cạp Cao Ống Đứng Chống Nhăn Tôn Chân Be', 'quan'],
  ['Quần jeans nam ống suông cao cấp', 'quan'],
  ['Quần short thể thao nam co giãn', 'quan'],
  ['Giày sneaker nam đế cao su', 'giay'],
  ['Giày thể thao nam đế cao', 'giay'],
  ['Túi đeo chéo nam chống thấm cao cấp', 'tui'],
  ['Mũ lưỡi trai nam vải cao cấp', 'mu'],

  // --- Ten that dang nam trong database ------------------------------------
  ['Áo sơ mi oxford trắng dài tay', 'ao'],
  ['Áo thun cotton trơn đen form regular', 'ao'],
  ['Áo khoác bomber nylon đen', 'ao'],
  ['Áo hoodie nỉ bông xám đậm', 'ao'],
  ['Áo cardigan len mỏng nâu nhạt', 'ao'],
  ['Áo Polo Len Xếp Ly 𝐂𝐎𝐎𝐋𝐂𝐑𝐄𝐖 Tay Ngắn Form Regular Fit Cao Cấp', 'ao'],
  ['Quần âu vải tây đen ống suông', 'quan'],
  ['Quần jogger nỉ xám đậm', 'quan'],
  ['Quần Tây Nam Xếp Ly GIRAN QT0004 Form Rộng', 'quan'],
  ['Giày slip-on canvas đen', 'giay'],
  ['Giày loafer da lộn nâu', 'giay'],
  ['Giày sandal quai ngang đen', 'giay'],
  ['Balo laptop vải chống nước đen', 'tui'],
  ['Túi tote canvas trơn be', 'tui'],
  ['Đồng hồ mặt tròn dây da nâu', 'dong_ho'],
  ['Kính râm gọng vuông đen', 'kinh'],
  ['Mũ bucket vải kem', 'mu'],
  ['Dây lưng da đen khóa kim', 'phu_kien'],
  ['Tất cổ ngắn cotton trắng (set 3 đôi)', 'phu_kien'],

  // --- Ten viet KHONG DAU, ly do luat khong dau ton tai ---------------------
  ['Quan au nam ong suong', 'quan'],
  ['Ao thun nam form rong', 'ao'],
  ['Giay sneaker nam', 'giay'],

  // --- Ten tieng Anh --------------------------------------------------------
  ['Beige Trouser Pants HOS - Menswear', 'quan'],
  ['Oversized Cotton T-Shirt', 'ao'],
];

console.log('\n=== 1. Doan dung loai ===');
for (const [ten, dung] of CA) {
  const ra = guessCategory(ten);
  check(`${dung.padEnd(8)} <- ${ten.slice(0, 52)}`, ra === dung, ra === dung ? '' : `doan ra "${ra}"`);
}

/*
  TU KHOA NAM SOM HON THI THANG.

  Ten tren san hay liet ke tu khoa cheo o phan duoi: mot cai quan ghi kem "de
  phoi voi ao thun". Loai hang that luon dung o dau ten.
*/
console.log('\n=== 2. Tu khoa nam som hon thi thang ===');
{
  check('quan co nhac "ao" o duoi van la quan',
    guessCategory('Quần jeans nam ống suông dễ phối với áo thun') === 'quan');
  check('ao co nhac "quan" o duoi van la ao',
    guessCategory('Áo sơ mi trắng dài tay mặc với quần tây') === 'ao');
  check('giay co nhac "ao" o duoi van la giay',
    guessCategory('Giày sneaker trắng hợp mọi kiểu áo') === 'giay');
}

console.log('\n=== 3. Vai tro suy ra tu loai ===');
{
  check('ao -> top', roleFromCategory('ao') === 'top');
  check('quan -> bottom', roleFromCategory('quan') === 'bottom');
  check('giay -> shoes', roleFromCategory('giay') === 'shoes');
  check('khong ro -> accessory', roleFromCategory('khong-co-loai-nay') === 'accessory');
}

console.log(`\n>>> ${pass} PASS, ${fail} FAIL`);
if (fail) process.exitCode = 1;
