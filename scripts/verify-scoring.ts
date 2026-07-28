/**
 * Kiem chung bo cham diem goi y va lop kiem tra link affiliate.
 *
 * Hai phep thu dang chu y nhat:
 *   - Nhom 1: bat bien "so thich cao hon menh" cua de bai muc 4. Kiem tra bang
 *     HANH VI (so sanh diem hai outfit) chu khong phai bang cach doc trong so,
 *     nen neu ai doi trong so sau nay ma pha vo bat bien thi test se do.
 *   - Nhom 5: doi chieu danh sach ten mien ben TypeScript voi ben SQL. Hai noi
 *     nay de bi sua lech nhau, gay ra loi kho hieu: form bao hop le nhung
 *     database tu choi.
 */

import { readFileSync } from 'node:fs';
import {
  scoreOutfit,
  rankOutfits,
  emptyUserContext,
  derivePreferencesFromFeedback,
  laHopMenh,
  demMauHopMenh,
  bacHopMenh,
  BAC_HOP_CA_BO,
  BAC_HOP_MOT_MON,
  type UserContext,
  type ScorableOutfit,
  type ColorElementMap,
} from '../src/lib/scoring';
import {
  urlHost,
  checkAffiliateUrl,
  isAllowedHost,
  isShortenerHost,
  isUnderDomain,
  ALLOWED_ROOT_DOMAINS,
  SHORTENER_ROOT_DOMAINS,
  SHORTENER_EXACT_HOSTS,
  platformOfHost,
} from '../src/lib/affiliate';
import type { NguHanh } from '../src/lib/nguhanh';

let failed = 0;
let passed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++;
  else failed++;
};

// Ban do mau -> hanh, khop voi 0005_seed_taxonomy.sql
const COLOR_ELEMENTS: ColorElementMap = {
  trang: 'kim', kem: 'tho', be: 'tho', 'xam-nhat': 'kim', 'xam-dam': 'kim',
  den: 'thuy', navy: 'thuy', 'xanh-duong': 'thuy', 'xanh-la': 'moc', olive: 'moc',
  nau: 'tho', 'nau-nhat': 'tho', vang: 'tho', do: 'hoa', cam: 'hoa',
  hong: 'hoa', tim: 'hoa',
};

const outfit = (
  id: string,
  styleSlug: string | null,
  colorSlugs: string[],
  totalPriceVnd: number | null = 500_000,
): ScorableOutfit => ({
  id, styleSlug, colorSlugs, totalPriceVnd, occasionSlug: null, publishedAt: null,
});

// ---------------------------------------------------------------------------
console.log('\n=== 1. BAT BIEN: so thich cao hon menh ===');

// Nguoi menh Kim: tuong sinh = Tho (kem/be/nau/vang), han che = Hoa (do/cam/hong/tim)
const kimUser: UserContext = {
  ...emptyUserContext(),
  preferredStyles: ['toi-gian'],
  priceMinVnd: 150_000,
  priceMaxVnd: 700_000,
  element: 'kim',
  elementEnabled: true,
};

// A: dung phong cach nhung toan mau NEN HAN CHE theo menh
const A = scoreOutfit(outfit('a', 'toi-gian', ['do', 'cam']), kimUser, COLOR_ELEMENTS);
// B: sai phong cach nhung toan mau TUONG SINH theo menh
const B = scoreOutfit(outfit('b', 'streetwear', ['kem', 'be']), kimUser, COLOR_ELEMENTS);

check(
  'dung phong cach + mau xau menh  >  sai phong cach + mau tot menh',
  A.total > B.total,
  `A=${A.total} vs B=${B.total}`,
);

// Phan hoi "khong thich mau" phai manh hon moi diem cong cua menh
const dislikeUser: UserContext = { ...kimUser, dislikedColors: ['kem'] };
const C = scoreOutfit(outfit('c', 'toi-gian', ['kem']), dislikeUser, COLOR_ELEMENTS);
const D = scoreOutfit(outfit('d', 'toi-gian', ['trang']), dislikeUser, COLOR_ELEMENTS);
check(
  'mau da bo tru diem manh hon diem cong tuong sinh',
  C.total < D.total,
  `bo-kem=${C.total} vs trang=${D.total}`,
);

// Do lon dong gop cua menh, do truc tiep
const withMenh = scoreOutfit(outfit('e', null, ['kem', 'be', 'nau']), kimUser, COLOR_ELEMENTS);
const noMenh = scoreOutfit(
  outfit('e', null, ['kem', 'be', 'nau']),
  { ...kimUser, elementEnabled: false },
  COLOR_ELEMENTS,
);
const menhDelta = withMenh.total - noMenh.total;
const styleDelta =
  scoreOutfit(outfit('f', 'toi-gian', []), kimUser, COLOR_ELEMENTS).total -
  scoreOutfit(outfit('f', 'streetwear', []), kimUser, COLOR_ELEMENTS).total;
check(
  'tong diem menh toi da < diem mot lan khop phong cach',
  menhDelta < styleDelta && menhDelta > 0,
  `menh=+${menhDelta}, phong cach=+${styleDelta}`,
);

// ---------------------------------------------------------------------------
console.log('\n=== 2. Nguoi dung tat goi y theo menh ===');

const off: UserContext = { ...kimUser, elementEnabled: false };
const good = scoreOutfit(outfit('g', null, ['kem', 'be']), off, COLOR_ELEMENTS);
const bad = scoreOutfit(outfit('h', null, ['do', 'cam']), off, COLOR_ELEMENTS);
check('tat menh -> mau tuong sinh va mau han che diem BANG NHAU',
      good.total === bad.total, `${good.total} vs ${bad.total}`);
check('tat menh -> khong con dong diem nao noi ve menh',
      !good.parts.some((p) => p.label.includes('mệnh')),
      good.parts.map((p) => p.label).join(' | ') || '(khong co)');

const noBirthday: UserContext = { ...kimUser, element: null };
const nb = scoreOutfit(outfit('i', null, ['kem']), noBirthday, COLOR_ELEMENTS);
check('chua nhap ngay sinh -> khong tinh menh',
      !nb.parts.some((p) => p.label.includes('mệnh')));

// ---------------------------------------------------------------------------
console.log('\n=== 3. Bon nut phan hoi ===');

const ctx3: UserContext = {
  ...emptyUserContext(),
  hiddenOutfitIds: ['hide-me'],
  dislikedPairingOutfitIds: ['bad-pair'],
  dislikedStyles: ['streetwear'],
  dislikedColors: ['do'],
};

const ranked = rankOutfits(
  [
    outfit('hide-me', 'toi-gian', ['trang']),
    outfit('bad-pair', 'toi-gian', ['trang']),
    outfit('normal', 'toi-gian', ['trang']),
    outfit('bad-style', 'streetwear', ['trang']),
    outfit('bad-color', 'toi-gian', ['do']),
  ],
  ctx3,
  COLOR_ELEMENTS,
);

check('"an outfit" -> bi LOAI khoi ket qua, khong chi tru diem',
      !ranked.some((o) => o.id === 'hide-me'), `con ${ranked.length} outfit`);
check('"khong thich cach phoi" -> tut xuong duoi cung',
      ranked[ranked.length - 1].id === 'bad-pair',
      `cuoi bang la ${ranked[ranked.length - 1].id}`);
check('"khong thich phong cach" xep duoi outfit thuong',
      ranked.findIndex((o) => o.id === 'bad-style') >
        ranked.findIndex((o) => o.id === 'normal'));
check('"khong thich mau" xep duoi outfit thuong',
      ranked.findIndex((o) => o.id === 'bad-color') >
        ranked.findIndex((o) => o.id === 'normal'));

// ---------------------------------------------------------------------------
console.log('\n=== 4. Suy ra so thich tu lich su phan hoi ===');

const derived = derivePreferencesFromFeedback([
  { kind: 'dislike_color', target_value: 'do', outfit_id: 'o1' },
  { kind: 'dislike_color', target_value: 'do', outfit_id: 'o2' },
  { kind: 'dislike_color', target_value: 'cam', outfit_id: 'o3' }, // moi 1 lan
  { kind: 'dislike_style', target_value: 'streetwear', outfit_id: 'o4' },
  { kind: 'dislike_style', target_value: 'streetwear', outfit_id: 'o5' },
  { kind: 'hide_outfit', target_value: null, outfit_id: 'o6' },
  { kind: 'hide_outfit', target_value: null, outfit_id: 'o6' }, // trung
  { kind: 'dislike_pairing', target_value: null, outfit_id: 'o7' },
]);

check('bo mau sau 2 lan, chua bo sau 1 lan',
      derived.dislikedColors.includes('do') && !derived.dislikedColors.includes('cam'),
      JSON.stringify(derived.dislikedColors));
check('bo phong cach sau 2 lan',
      derived.dislikedStyles.length === 1 && derived.dislikedStyles[0] === 'streetwear');
check('outfit bi an khong bi trung lap',
      derived.hiddenOutfitIds.length === 1, JSON.stringify(derived.hiddenOutfitIds));
check('ghi nhan khong thich cach phoi',
      derived.dislikedPairingOutfitIds[0] === 'o7');

// Thu tu sap xep phai on dinh (khong phu thuoc thu tu dau vao)
const items = [outfit('z', null, []), outfit('a', null, []), outfit('m', null, [])];
const r1 = rankOutfits(items, emptyUserContext(), COLOR_ELEMENTS).map((o) => o.id);
const r2 = rankOutfits([...items].reverse(), emptyUserContext(), COLOR_ELEMENTS).map((o) => o.id);
check('thu tu on dinh khi bang diem', JSON.stringify(r1) === JSON.stringify(r2),
      `${r1.join(',')} vs ${r2.join(',')}`);

// ---------------------------------------------------------------------------
console.log('\n=== 5. Kiem tra link affiliate (phia client) ===');

const HOST_CASES: Array<[string, string | null]> = [
  ['https://WWW.Shopee.VN:443/abc?x=1#y', 'shopee.vn'],
  ['https://shopee.vn@evil.example.com/x', 'evil.example.com'],
  ['https://shopee.vn.evil.example.com/x', 'shopee.vn.evil.example.com'],
  ['https://evil.example.com/?u=https://shopee.vn', 'evil.example.com'],
  ['https://shp.ee/abc', 'shp.ee'],
  ['https://vt.tiktok.com/ZS123/', 'vt.tiktok.com'],
  ['', null],
];
for (const [raw, expected] of HOST_CASES) {
  const got = urlHost(raw);
  check(`urlHost(${raw.slice(0, 42) || "''"}) -> ${expected}`, got === expected,
        got === expected ? '' : `-> ${got}`);
}

const LINK_CASES: Array<[string, boolean, string]> = [
  ['https://shopee.vn/san-pham-i.1.2', true, 'link shopee day du'],
  ['https://shp.ee/abc123', true, 'link rut gon shopee'],
  ['https://www.tiktok.com/@x/video/1', true, 'link tiktok'],
  ['https://evil.example.com/abc', false, 'ten mien la'],
  ['https://shopee.vn@evil.example.com/x', false, 'che ten mien kieu user@host'],
  ['shopee.vn/abc', false, 'thieu https://'],
  ['', false, 'chuoi rong'],
];
for (const [raw, shouldPass, label] of LINK_CASES) {
  const r = checkAffiliateUrl(raw);
  check(`${shouldPass ? 'NHAN' : 'TU CHOI'}: ${label}`, r.ok === shouldPass, r.message);
}

check('link rut gon bi danh dau can resolve',
      checkAffiliateUrl('https://shp.ee/abc').needsResolve === true);
check('link day du khong can resolve',
      checkAffiliateUrl('https://shopee.vn/a-i.1.2').needsResolve === false);
check('phat hien sai nen tang',
      checkAffiliateUrl('https://shopee.vn/a', 'tiktok').ok === false);
check('platformOfHost nhan dien dung',
      platformOfHost('shp.ee') === 'shopee' && platformOfHost('vt.tiktok.com') === 'tiktok');

// ---------------------------------------------------------------------------
console.log('\n=== 6. Khop ten mien theo ten mien goc ===');

// Hai link THAT cua nguoi dung dung `vn.shp.ee`. He thong ban dau dung danh sach
// ten mien CUNG va da tu choi chinh link that do. Cac phep thu duoi day khoa lai
// hanh vi dung sau khi doi sang khop theo ten mien goc.
const DOMAIN_CASES: Array<[string, boolean, string]> = [
  ['vn.shp.ee', true, 'link that cua nguoi dung'],
  ['shp.ee', true, 'ten mien goc'],
  ['th.shp.ee', true, 'bien the quoc gia khac'],
  ['shopee.vn', true, ''],
  ['affiliate.shopee.vn', true, ''],
  ['shop.tiktok.com', true, ''],
  ['evil-shp.ee', false, 'thieu dau cham truoc shp.ee'],
  ['shp.ee.evil.com', false, 'shp.ee o dau chu khong o cuoi'],
  ['shopee.vn.evil.com', false, 'ten mien la gan them shopee.vn'],
  ['shopee.evil.com', false, "chuoi con 'shopee' nhung khong thuoc shopee.vn"],
  ['evil.com', false, ''],
];
for (const [host, expected, note] of DOMAIN_CASES) {
  check(
    `${expected ? 'NHAN' : 'TU CHOI'} ${host}${note ? ' — ' + note : ''}`,
    isAllowedHost(host) === expected,
  );
}

check('isUnderDomain doi hoi dau cham',
      isUnderDomain('vn.shp.ee', 'shp.ee') && !isUnderDomain('evil-shp.ee', 'shp.ee'));

check('vn.shp.ee duoc coi la link rut gon', isShortenerHost('vn.shp.ee'));
check('shopee.vn KHONG phai link rut gon', !isShortenerHost('shopee.vn'));

// Kiem tra qua duong checkAffiliateUrl, tuc la dung duong ma form goi
const realLink = checkAffiliateUrl('https://vn.shp.ee/PNqCvjDn');
check('checkAffiliateUrl nhan link that vn.shp.ee', realLink.ok, realLink.message);
check('link that duoc danh dau can resolve', realLink.needsResolve);
check('link that duoc nhan dien la Shopee', realLink.platform === 'shopee');

const resolvedProduct = checkAffiliateUrl(
  'https://shopee.vn/product/1388112438/49358623905',
);
check('URL san pham sau khi resolve van hop le', resolvedProduct.ok);
check('URL san pham khong con can resolve', !resolvedProduct.needsResolve);

// ---------------------------------------------------------------------------
console.log('\n=== 6b. TypeScript va SQL phai cung cau hinh ===');

const sql = readFileSync('supabase/migrations/0003_functions.sql', 'utf8');

/** Doc mang trong than mot ham SQL. */
const sqlArray = (fnName: string): string[] => {
  const start = sql.indexOf(`create or replace function ${fnName}`);
  if (start < 0) return [];
  const body = sql.slice(start, sql.indexOf('$$;', start));
  const m = /array\[([^\]]*)\]/.exec(body);
  return m ? [...m[1].matchAll(/'([a-z0-9.-]+)'/g)].map((x) => x[1]).sort() : [];
};

/** Doc danh sach trong menh de `p_host in (...)`. */
const sqlInList = (fnName: string): string[] => {
  const start = sql.indexOf(`create or replace function ${fnName}`);
  if (start < 0) return [];
  const body = sql.slice(start, sql.indexOf('$$;', start));
  const m = /p_host in \(([^)]*)\)/.exec(body);
  return m ? [...m[1].matchAll(/'([a-z0-9.-]+)'/g)].map((x) => x[1]).sort() : [];
};

const pairs: Array<[string, readonly string[], string[]]> = [
  ['ALLOWED_ROOT_DOMAINS', ALLOWED_ROOT_DOMAINS, sqlArray('is_allowed_affiliate_host')],
  ['SHORTENER_ROOT_DOMAINS', SHORTENER_ROOT_DOMAINS, sqlArray('is_shortener_host')],
  ['SHORTENER_EXACT_HOSTS', SHORTENER_EXACT_HOSTS, sqlInList('is_shortener_host')],
];

for (const [label, ts, fromSql] of pairs) {
  const a = [...ts].sort();
  const same = JSON.stringify(a) === JSON.stringify(fromSql);
  check(`${label} khop giua TypeScript va SQL`, same,
        same ? `${a.length} ten mien` : `TS ${JSON.stringify(a)} vs SQL ${JSON.stringify(fromSql)}`);
}

check('moi ten mien goc rut gon deu nam trong danh sach cho phep',
      SHORTENER_ROOT_DOMAINS.every((d) => ALLOWED_ROOT_DOMAINS.includes(d)));

check('moi ten mien rut gon cu the deu duoc phep',
      SHORTENER_EXACT_HOSTS.every((h) => isAllowedHost(h)));

check('moi ten mien goc deu suy ra duoc nen tang',
      ALLOWED_ROOT_DOMAINS.every((d) => platformOfHost(d) !== null));

// ---------------------------------------------------------------------------
console.log('\n=== 6b. Luat hop menh BA BAC ===');

/*
  Menh Kim: ban menh Kim (trang, xam), tuong sinh Tho (kem, be, nau, vang).
  Han che Hoa (do, cam, hong, tim).
*/
const bac = (cs: string[]) => bacHopMenh(cs, COLOR_ELEMENTS, 'kim' as NguHanh);

check('ca ao lan quan hop  ->  bac 2', bac(['trang', 'kem']) === BAC_HOP_CA_BO);
check('mot mon hop  ->  bac 1', bac(['trang', 'den']) === BAC_HOP_MOT_MON,
      'trang hop Kim, den thuoc Thuy');
check('khong mon nao hop  ->  bac 0', bac(['do', 'cam']) === 0);

/*
  Mot mau hop VAN LA HOP.

  Day la luat chu website sua lai sau khi thu: khoa cung o hai mau thi rat kho
  phoi do, va nguoi ta co the chi thich dung mot mon trong bo. Phep kiem nay
  giu cho khong ai vo tinh dat lai nguong cu.
*/
check('mot mau hop  ->  van tinh la hop menh',
      laHopMenh(['trang', 'den'], COLOR_ELEMENTS, 'kim' as NguHanh));
check('khong mau nao hop  ->  khong hop',
      !laHopMenh(['do', 'cam'], COLOR_ELEMENTS, 'kim' as NguHanh));

check('dem dung so mau hop',
      demMauHopMenh(['trang', 'kem', 'do'], COLOR_ELEMENTS, 'kim' as NguHanh) === 2,
      'trang (Kim) + kem (Tho) hop, do (Hoa) khong');

const motMau = scoreOutfit(outfit('m1', null, ['trang', 'den']), kimUser, COLOR_ELEMENTS);
const haiMau = scoreOutfit(outfit('m2', null, ['trang', 'kem']), kimUser, COLOR_ELEMENTS);
const diemMenh = (s: typeof motMau) =>
  s.parts.find((p) => /hợp mệnh$/.test(p.label))?.points ?? 0;

check('mot mau hop  ->  VAN duoc cong diem menh', diemMenh(motMau) > 0,
      `+${diemMenh(motMau)}`);
check('hai mau hop  ->  duoc cong nhieu hon', diemMenh(haiMau) > diemMenh(motMau),
      `+${diemMenh(haiMau)} > +${diemMenh(motMau)}`);
check('bai hai mau hop xep tren bai mot mau hop', haiMau.total > motMau.total,
      `${haiMau.total} > ${motMau.total}`);

// --- Nut "uu tien hop menh len dau" ---------------------------------------
//
// Bai hop menh phai len dau NGAY CA KHI bai kia dung phong cach yeu thich —
// nut co chu "uu tien" ma khong day len dau duoc thi no khong lam gi ca.
const dsXep = rankOutfits(
  [outfit('mot-mon', 'toi-gian', ['trang', 'den']),   // dung phong cach, bac 1
   outfit('ca-bo', 'streetwear', ['trang', 'kem'])],  // sai phong cach, bac 2
  kimUser, COLOR_ELEMENTS, 0, true,
);
check('bat uu tien  ->  bai hop ca bo len dau du sai phong cach',
      dsXep[0].id === 'ca-bo', `dau danh sach: ${dsXep[0].id}`);

const dsThuong = rankOutfits(
  [outfit('mot-mon', 'toi-gian', ['trang', 'den']),
   outfit('ca-bo', 'streetwear', ['trang', 'kem'])],
  kimUser, COLOR_ELEMENTS, 0, false,
);
check('tat uu tien  ->  so thich phong cach van thang',
      dsThuong[0].id === 'mot-mon', `dau danh sach: ${dsThuong[0].id}`);

// --- Bai nguoi that xep tren bai dung san (muc 4) --------------------------
//
// Day la mac dinh chay nen, nen kiem o che do BINH THUONG (nut uu tien menh
// TAT). Khi nut duoc bat thi menh len truoc — xem cac phep kiem ngay ben duoi.
const dsThat = rankOutfits(
  [{ ...outfit('dung-san', 'toi-gian', ['trang', 'kem']), isSeed: true },
   { ...outfit('nguoi-that', 'streetwear', ['do', 'cam']), isSeed: false }],
  kimUser, COLOR_ELEMENTS, 0, false,
);
check('bai nguoi that len tren bai dung san',
      dsThat[0].id === 'nguoi-that', `dau danh sach: ${dsThat[0].id}`);
check('bai dung san xuong duoi', dsThat[1].id === 'dung-san');

/*
  BAM NUT THI NUT PHAI THANG.

  Loi that: bai nguoi that bi ghim o dau nen bam "uu tien hop menh" khong day
  duoc gi len — bon o dau y nguyen, va nut nhin nhu khong chay. Phep kiem nay
  dung lai dung canh do: bai nguoi that KHONG hop menh, bai dung san hop ca bo.
*/
const dsGianh = rankOutfits(
  [{ ...outfit('that-khong-hop', null, ['do', 'cam']), isSeed: false },
   { ...outfit('san-hop-ca-bo', null, ['trang', 'kem']), isSeed: true }],
  kimUser, COLOR_ELEMENTS, 0, true,
);
check('bat uu tien menh  ->  bai hop menh len tren ca bai nguoi that',
      dsGianh[0].id === 'san-hop-ca-bo', `dau danh sach: ${dsGianh[0].id}`);

const dsGianhTat = rankOutfits(
  [{ ...outfit('that-khong-hop', null, ['do', 'cam']), isSeed: false },
   { ...outfit('san-hop-ca-bo', null, ['trang', 'kem']), isSeed: true }],
  kimUser, COLOR_ELEMENTS, 0, false,
);
check('tat uu tien menh  ->  bai nguoi that lai len tren',
      dsGianhTat[0].id === 'that-khong-hop', `dau danh sach: ${dsGianhTat[0].id}`);

// Cung mot bac hop menh thi bai nguoi that van phai dung tren.
const dsCungBac = rankOutfits(
  [{ ...outfit('san-hop', null, ['trang', 'kem']), isSeed: true },
   { ...outfit('that-hop', null, ['trang', 'kem']), isSeed: false }],
  kimUser, COLOR_ELEMENTS, 0, true,
);
check('cung bac hop menh  ->  bai nguoi that van tren',
      dsCungBac[0].id === 'that-hop', `dau danh sach: ${dsCungBac[0].id}`);

// ---------------------------------------------------------------------------
console.log('\n=== 7. Vi du giai thich diem cho nguoi dung ===');

const demoUser: UserContext = {
  ...emptyUserContext(),
  preferredStyles: ['toi-gian'],
  preferredColors: ['trang', 'den'],
  priceMinVnd: 150_000,
  priceMaxVnd: 2_000_000,
  element: 'kim' as NguHanh,
  elementEnabled: true,
};
const demo = scoreOutfit(
  { id: 'demo', styleSlug: 'toi-gian', occasionSlug: 'cuoi-tuan',
    colorSlugs: ['trang', 'den', 'kem'], totalPriceVnd: 1_134_000, publishedAt: null },
  demoUser, COLOR_ELEMENTS,
);
console.log(`  Tong: ${demo.total} diem`);
for (const p of demo.parts) {
  console.log(`    ${p.points > 0 ? '+' : ''}${String(p.points).padStart(4)}  ${p.label}`);
}

console.log(
  `\n>>> ${passed} PASS, ${failed} FAIL` + (failed ? ' — CO LOI\n' : ' — TAT CA PASS\n'),
);
process.exit(failed ? 1 : 0);
