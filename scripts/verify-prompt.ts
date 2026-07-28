/**
 * Kiem chung cau lenh tao anh.
 *
 * Hai thu de hong nhat va deu im lang:
 *   1. Ban tieng Anh (gui cho mo hinh) va ban tieng Viet (hien cho nguoi dung)
 *      noi hai dieu khac nhau. Nguoi dung tin ban tieng Viet, nen lech la noi
 *      doi voi ho.
 *   2. Goc nguoi mau doi theo tung lan tao, ma hai ban lai chon tu hai bang
 *      khac nhau — lech thu tu mot dong la sai het.
 */
import { buildImagePrompt, explainPromptVi, monChuaCoAnh, MODEL_ORIGINS } from '../src/lib/aiImage';

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const base = {
  outfitTitle: 'Smart casual trắng đen',
  styleLabel: 'Smart casual',
  occasionLabel: 'Đi làm',
  colorLabels: ['Trắng', 'Đen'],
  items: [
    { roleLabel: 'Áo', name: 'Áo polo trắng', colorLabel: 'Trắng' },
    { roleLabel: 'Quần', name: 'Quần chinos đen', colorLabel: 'Đen' },
  ],
  sceneId: 'trang',
  modelTypeId: 'can-doi',
  hasReferences: true,
  variation: 0,
};

console.log('\n=== 1. Co anh dinh kem ===');
{
  const en = buildImagePrompt(base);
  console.log(en.split('\n').slice(0, 6).map(l => '       ' + l).join('\n'));
  check('noi ro anh dinh kem la quan ao can ve lai', /CRITICAL: the attached images/.test(en));
  check('uu tien anh hon moi chi dan khac', /outranks every other instruction/.test(en));
  check('tung mon mot dong, ghi "theo hinh dinh kem"',
    (en.match(/^\* .*attached image$/gm) ?? []).length === 2);
  check('nen trang', /pure white seamless background/.test(en));
  check('khung doc 3:4', /vertical 3:4 frame/.test(en));
  check('bu giay vi set chua co — de AI tu chon',
    /\* footwear: your choice/.test(en));
  /*
    RANG BUOC MOI, VA LA CAI QUAN TRONG NHAT O DAY:
    TEN SAN PHAM KHONG DUOC XUAT HIEN TRONG CAU LENH.

    Ten hang tren san la mot chuoi tu khoa quang cao. Dua no vao cau lenh thi
    mo hinh doc chuoi do roi ve theo tri tuong tuong — ra mot mon do KHONG
    giong hang that nhung trong nhu that. Voi mot trang gan link mua hang, do
    la kieu sai nguy hiem nhat.
  */
  check('KHONG co ten san pham trong cau lenh',
    !en.includes('Áo polo trắng') && !en.includes('Quần chinos đen'), en.slice(0, 0));
  check('danh sach cam la danh sach, khong phai mot cau',
    (en.match(/^\* /gm) ?? []).length >= 10);
  for (const cam of ['text, lettering', 'watermark', 'brand logo', 'identifiable person',
                     '3D render', 'collage', 'split frame', 'more than one person']) {
    check(`cam: ${cam}`, en.toLowerCase().includes(cam.toLowerCase()));
  }
}

console.log('\n=== 2. Khong co anh dinh kem ===');
{
  const en = buildImagePrompt({ ...base, hasReferences: false });
  check('noi thang la khong co anh mau', /No reference images were supplied/.test(en));
  check('khong con cau CRITICAL', !/CRITICAL/.test(en));
  // Khong anh thi de AI tu chon, KHONG ta ten mon — xem chu thich o muc 1.
  check('de AI tu chon thay vi ta ten', (en.match(/your choice/g) ?? []).length >= 2);
  check('van khong lo ten san pham', !en.includes('Áo polo trắng'));
}

console.log('\n=== 3. Goc nguoi mau doi theo tung lan tao ===');
{
  const gocs = new Set<string>();
  for (let v = 0; v < MODEL_ORIGINS.length; v++) {
    const m = buildImagePrompt({ ...base, variation: v }).match(/Subject: one (.+?) man/);
    gocs.add(m![1]);
  }
  check('moi lan mot goc khac nhau', gocs.size === MODEL_ORIGINS.length,
    `${gocs.size}/${MODEL_ORIGINS.length} goc`);
  check('cung mot lan cho ra cung ket qua',
    buildImagePrompt({ ...base, variation: 3 }) === buildImagePrompt({ ...base, variation: 3 }));
}

console.log('\n=== 4. Ban tieng Viet phai khop ban tieng Anh ===');
{
  for (let v = 0; v < MODEL_ORIGINS.length; v++) {
    const en = buildImagePrompt({ ...base, variation: v });
    const vi = explainPromptVi({ ...base, variation: v }).join('\n');
    const enGoc = en.match(/Subject: one (.+?) man/)![1];
    const viGoc = vi.match(/một nam giới (.+?), khoảng/)![1];
    const khop: Record<string, string> = {
      'Southeast Asian': 'Đông Nam Á', 'East Asian': 'Đông Á', 'South Asian': 'Nam Á',
      'European': 'châu Âu', 'Latin American': 'Mỹ Latinh',
      'West African': 'Tây Phi', 'Middle Eastern': 'Trung Đông',
    };
    check(`lan ${v}: goc nguoi mau hai ban khop nhau`, khop[enGoc] === viGoc,
      `${enGoc} / ${viGoc}`);
  }

  const vi = explainPromptVi(base).join('\n');
  check('ban tieng Viet noi ro co anh dinh kem', /ĐÍNH KÈM/.test(vi));
  check('ban tieng Viet liet ke tung mon', /\* áo: đúng như ảnh đính kèm/.test(vi));
  check('ban tieng Viet khong lan tieng Anh',
    !/(sneakers|trousers|t-shirt|neutral tone)/i.test(vi), vi.slice(0, 0));
}

/*
  SET NUA CO ANH NUA KHONG — truong hop tung bi noi doi.

  Co chung `hasReferences` cua ca set lam mot set co hai mon co anh, hai mon
  khong van bi ghi ca bon la "theo anh dinh kem". Hai mon khong co anh thanh ra
  khong duoc ta gi, mo hinh tu bia, va nguoi doc cau lenh khong he biet.
*/
console.log('\n=== 5. Set nua co anh nua khong ===');
{
  const tron = {
    ...base,
    hasReferences: undefined,
    items: [
      { roleLabel: 'Áo', name: 'Áo polo trắng', colorLabel: 'Trắng', hasImage: true },
      { roleLabel: 'Quần', name: 'Quần chinos đen', colorLabel: 'Đen', hasImage: false },
    ],
  };
  const en = buildImagePrompt(tron);
  const vi = explainPromptVi(tron).join('\n');

  check('mon co anh: ghi theo anh dinh kem', /\* áo: exactly as shown in the attached image/.test(en));
  check('mon khong anh: de AI tu chon', /\* quần: your choice/.test(en));
  check('canh bao khong duoc chep anh sang mon khong co anh',
    /must NOT be copied from\s+the attached images/.test(en));
  check('ban tieng Viet noi ro ty le', /1\/2 món có ảnh đính kèm/.test(vi));
  check('ban tieng Viet danh dau mon chua co anh', /để AI tự chọn cho hợp bộ đồ/.test(vi));

  check('mon chua co anh liet ke dung', monChuaCoAnh(tron).join(',') === 'quần');
  check('tat ca co anh thi danh sach rong',
    monChuaCoAnh({ ...base, hasReferences: true }).length === 0);
  check('khong mon nao co anh thi liet ke het',
    monChuaCoAnh({ ...base, hasReferences: false }).length === base.items.length);

  // Co chung van phai lam viec nhu cu voi cac cho goi kieu cu.
  const cu = buildImagePrompt({ ...base, hasReferences: true });
  check('mon khong noi ro thi theo co chung cua set',
    (cu.match(/attached image$/gm) ?? []).length === 2);
}

console.log(`\n>>> ${pass} PASS, ${fail} FAIL`);
if (fail) process.exitCode = 1;
