/**
 * Kiem chung module ngu hanh bang ngay that.
 *
 * Chay: node scripts/verify-nguhanh.ts
 *
 * Phep thu quan trong nhat la nhom 2: nguoi sinh thang 1 duong lich thuong
 * thuoc nam am lich TRUOC do, nen menh khac han. Neu chi lay nam sinh duong
 * lich thi khoang 1/12 nguoi dung se bi tinh sai menh.
 */

import {
  analyzeBirthDate,
  canChiOfLunarYear,
  napAmOfLunarYear,
  colorGuidanceFor,
  NGU_HANH_LABEL,
  type NguHanh,
} from '../src/lib/nguhanh';
import { convertSolarToLunar } from '../src/lib/nguhanh/lunar';

let failed = 0;
let passed = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++;
  else failed++;
}

// ---------------------------------------------------------------------------
console.log('\n=== 1. Ngay mung 1 Tet (moc kiem chung am lich) ===');

// Cac ngay Tet Nguyen dan duong lich da biet cua Viet Nam
const TET: Array<[number, number, number]> = [
  [27, 1, 1990],
  [31, 1, 1995],
  [28, 1, 1998],
  [5, 2, 2000],
  [14, 2, 2010],
  [25, 1, 2020],
  [10, 2, 2024],
  [29, 1, 2025],
  [17, 2, 2026],
];

for (const [d, m, y] of TET) {
  const l = convertSolarToLunar(d, m, y);
  check(
    `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} la mung 1 Tet`,
    l.day === 1 && l.month === 1 && l.year === y,
    `-> am lich ${l.day}/${l.month}/${l.year}`,
  );
}

// ---------------------------------------------------------------------------
console.log('\n=== 2. Sinh thang 1 duong lich thuoc nam am lich truoc ===');

// Tet 1998 la 28/01. Nen 20/01/1998 van thuoc nam am lich 1997 (Dinh Suu).
const before = analyzeBirthDate('1998-01-20');
check(
  '20/01/1998 -> nam am lich 1997, Dinh Suu, Gian Ha Thuy (Thuy)',
  before?.lunar.year === 1997 &&
    before?.canChi === 'Đinh Sửu' &&
    before?.elementLabel === 'Giản Hạ Thủy' &&
    before?.element === 'thuy',
  `-> ${before?.lunar.year} ${before?.canChi} ${before?.elementLabel}`,
);

// 05/02/1998 la sau Tet, thuoc nam am lich 1998 (Mau Dan).
const after = analyzeBirthDate('1998-02-05');
check(
  '05/02/1998 -> nam am lich 1998, Mau Dan, Thanh Dau Tho (Tho)',
  after?.lunar.year === 1998 &&
    after?.canChi === 'Mậu Dần' &&
    after?.elementLabel === 'Thành Đầu Thổ' &&
    after?.element === 'tho',
  `-> ${after?.lunar.year} ${after?.canChi} ${after?.elementLabel}`,
);

check(
  'hai nguoi cach nhau 16 ngay co menh KHAC nhau',
  before?.element !== after?.element,
  `${before?.element} vs ${after?.element}`,
);

// ---------------------------------------------------------------------------
console.log('\n=== 3. Can Chi va Nap am cua nam am lich ===');

const CANCHI_CASES: Array<[number, string]> = [
  [1984, 'Giáp Tý'],
  [1990, 'Canh Ngọ'],
  [1995, 'Ất Hợi'],
  [1997, 'Đinh Sửu'],
  [1998, 'Mậu Dần'],
  [2000, 'Canh Thìn'],
  [2024, 'Giáp Thìn'],
  [2025, 'Ất Tỵ'],
  [2026, 'Bính Ngọ'],
  [2043, 'Quý Hợi'],
];
for (const [y, expected] of CANCHI_CASES) {
  const got = canChiOfLunarYear(y);
  check(`${y} -> ${expected}`, got === expected, got === expected ? '' : `-> ${got}`);
}

const NAPAM_CASES: Array<[number, string, NguHanh]> = [
  [1984, 'Hải Trung Kim', 'kim'],
  [1990, 'Lộ Bàng Thổ', 'tho'],
  [1995, 'Sơn Đầu Hỏa', 'hoa'],
  [1998, 'Thành Đầu Thổ', 'tho'],
  [2000, 'Bạch Lạp Kim', 'kim'],
  [2024, 'Phú Đăng Hỏa', 'hoa'],
  [2025, 'Phú Đăng Hỏa', 'hoa'], // Giap Thin - At Ty cung mot cap
  [2026, 'Thiên Hà Thủy', 'thuy'],
];
for (const [y, label, el] of NAPAM_CASES) {
  const got = napAmOfLunarYear(y);
  check(
    `${y} -> ${label} (${NGU_HANH_LABEL[el]})`,
    got.label === label && got.element === el,
    got.label === label ? '' : `-> ${got.label} (${got.element})`,
  );
}

// ---------------------------------------------------------------------------
console.log('\n=== 4. Vong 60 nam phai phu kin va lap lai dung ===');

const elements = new Set<NguHanh>();
const labels = new Set<string>();
for (let y = 1984; y < 1984 + 60; y++) {
  const na = napAmOfLunarYear(y);
  elements.add(na.element);
  labels.add(na.label);
}
check('60 nam phu du 5 hanh', elements.size === 5, `co ${elements.size}`);
check('60 nam co dung 30 ten nap am', labels.size === 30, `co ${labels.size}`);

// Moi hanh phai xuat hien dung 12 lan trong 60 nam
const tally: Record<string, number> = {};
for (let y = 1984; y < 1984 + 60; y++) {
  const e = napAmOfLunarYear(y).element;
  tally[e] = (tally[e] ?? 0) + 1;
}
check(
  'moi hanh xuat hien dung 12 lan trong 60 nam',
  Object.values(tally).every((n) => n === 12),
  JSON.stringify(tally),
);

check(
  'lap lai sau dung 60 nam',
  napAmOfLunarYear(1984).label === napAmOfLunarYear(2044).label &&
    napAmOfLunarYear(1984).label === napAmOfLunarYear(1924).label,
  `1924/1984/2044 = ${napAmOfLunarYear(1924).label}`,
);

// ---------------------------------------------------------------------------
console.log('\n=== 5. Quan he tuong sinh / tuong khac ===');

const ALL: NguHanh[] = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

// Khong hanh nao tu sinh ra minh hoac tu khac minh
let selfRef = false;
for (const e of ALL) {
  const g = colorGuidanceFor(e);
  if (g.tuongSinh === e || g.hanChe === e) selfRef = true;
  if (g.banMenh !== e) selfRef = true;
}
check('khong hanh nao tu sinh / tu khac chinh minh', !selfRef);

// tuongSinh va hanChe phai la hoan vi (moi hanh xuat hien dung 1 lan)
const sinhSet = new Set(ALL.map((e) => colorGuidanceFor(e).tuongSinh));
const khacSet = new Set(ALL.map((e) => colorGuidanceFor(e).hanChe));
check('anh xa tuong sinh la hoan vi', sinhSet.size === 5, `${sinhSet.size} gia tri`);
check('anh xa tuong khac la hoan vi', khacSet.size === 5, `${khacSet.size} gia tri`);

// Doi chieu voi bang chuan
const EXPECT: Record<NguHanh, { tuongSinh: NguHanh; hanChe: NguHanh }> = {
  kim: { tuongSinh: 'tho', hanChe: 'hoa' },
  moc: { tuongSinh: 'thuy', hanChe: 'kim' },
  thuy: { tuongSinh: 'kim', hanChe: 'tho' },
  hoa: { tuongSinh: 'moc', hanChe: 'thuy' },
  tho: { tuongSinh: 'hoa', hanChe: 'moc' },
};
for (const e of ALL) {
  const g = colorGuidanceFor(e);
  const x = EXPECT[e];
  check(
    `${NGU_HANH_LABEL[e]}: tuong sinh ${NGU_HANH_LABEL[x.tuongSinh]}, han che ${NGU_HANH_LABEL[x.hanChe]}`,
    g.tuongSinh === x.tuongSinh && g.hanChe === x.hanChe,
    `-> sinh ${g.tuongSinh}, che ${g.hanChe}`,
  );
}

// ---------------------------------------------------------------------------
console.log('\n=== 6. Tinh nhat quan tren 40 nam lien tuc ===');

// Ngay am lich phai tang dan 1 don vi, hoac quay ve 1 khi sang thang moi.
// Thang am lich phai co 29 hoac 30 ngay. Day la phep thu bat duoc gan nhu moi
// loi thuat toan ma khong can bang tra ben ngoai.
let seqOk = true;
let monthLenOk = true;
const monthLengths = new Set<number>();
let prev = convertSolarToLunar(1, 1, 1990);

const d0 = Date.UTC(1990, 0, 1);
const DAY = 86400000;
const totalDays = Math.round((Date.UTC(2030, 0, 1) - d0) / DAY);

for (let i = 1; i <= totalDays; i++) {
  const t = new Date(d0 + i * DAY);
  const cur = convertSolarToLunar(t.getUTCDate(), t.getUTCMonth() + 1, t.getUTCFullYear());

  if (cur.day === prev.day + 1) {
    // Ngay ke tiep trong cung thang am lich — dung nhu mong doi.
  } else if (cur.day === 1) {
    // Sang thang moi: do dai thang vua ket thuc phai la 29 hoac 30 ngay.
    monthLengths.add(prev.day);
    if (prev.day !== 29 && prev.day !== 30) monthLenOk = false;
  } else {
    seqOk = false;
    console.log(
      `        nhay bat thuong tai ${t.toISOString().slice(0, 10)}: ` +
        `${prev.day}/${prev.month} -> ${cur.day}/${cur.month}`,
    );
    break;
  }
  prev = cur;
}

check(`ngay am lich lien tuc suot ${totalDays} ngay (1990-2030)`, seqOk);
check(
  'moi thang am lich chi dai 29 hoac 30 ngay',
  monthLenOk,
  `do dai gap: ${[...monthLengths].sort().join(', ')}`,
);

// ---------------------------------------------------------------------------
console.log('\n=== 7. Do ben cua ham phan tich ===');

check('tu choi chuoi rong', analyzeBirthDate('') === null);
check('tu choi dinh dang sai', analyzeBirthDate('20/01/1998') === null);
check('tu choi ngay khong ton tai 31/02', analyzeBirthDate('1998-02-31') === null);
check('tu choi thang 13', analyzeBirthDate('1998-13-01') === null);
check('tu choi nam ngoai khoang tin cay', analyzeBirthDate('1850-01-01') === null);
check('nhan ngay hop le co khoang trang', analyzeBirthDate('  1998-02-05  ') !== null);

// Doi tuong dich cua website: nam 20-30 tuoi nam 2026 -> sinh 1996..2006.
// Moi ngay trong khoang do phai ra ket qua hop le.
let allValid = true;
const elementSpread: Record<string, number> = {};
for (let y = 1996; y <= 2006; y++) {
  for (let m = 1; m <= 12; m++) {
    const r = analyzeBirthDate(`${y}-${String(m).padStart(2, '0')}-15`);
    if (!r || !ALL.includes(r.element)) {
      allValid = false;
      break;
    }
    elementSpread[r.element] = (elementSpread[r.element] ?? 0) + 1;
  }
}
check('moi ngay sinh 1996-2006 deu ra menh hop le', allValid);
check(
  'ca 5 hanh deu xuat hien trong nhom tuoi muc tieu',
  Object.keys(elementSpread).length === 5,
  JSON.stringify(elementSpread),
);

// ---------------------------------------------------------------------------
console.log('\n=== 8. Vi du hien thi ===');
for (const iso of ['1996-07-15', '1998-01-20', '1999-11-03', '2001-04-22', '2004-09-08']) {
  const r = analyzeBirthDate(iso)!;
  const g = r.colors;
  console.log(
    `  ${iso}  ->  am lich ${String(r.lunar.day).padStart(2)}/${String(r.lunar.month).padStart(2)}/${r.lunar.year}  ` +
      `${r.canChi.padEnd(9)} ${r.elementLabel.padEnd(16)} ` +
      `menh ${NGU_HANH_LABEL[r.element].padEnd(5)} ` +
      `sinh:${NGU_HANH_LABEL[g.tuongSinh].padEnd(5)} che:${NGU_HANH_LABEL[g.hanChe]}`,
  );
}

console.log(
  `\n>>> ${passed} PASS, ${failed} FAIL` + (failed ? ' — CO LOI\n' : ' — TAT CA PASS\n'),
);
process.exit(failed ? 1 : 0);
