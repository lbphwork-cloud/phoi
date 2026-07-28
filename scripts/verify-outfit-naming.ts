/**
 * Kiem chung bo dat ten va viet mo ta bang quy tac.
 *
 * Cac ten hang o day la ten THAT tren san — nhoi day tu khoa, co ngoac vuong,
 * co gach ngang, co ca chu VIET HOA giua cau. Do la dieu kien thuc te ma bo
 * rut gon phai chiu duoc.
 */
import {
  cotLoiTenHang, datTenTheoQuyTac, vietMoTaTheoQuyTac,
  thieuGiDeDatTen, thieuGiDeVietMoTa, bangMau,
} from '../src/lib/outfitNaming';

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

console.log('\n=== 1. Rut goi ten hang tren san ===');
{
  const that = '[ Phiên Bản Nâng Cấp Cleanfit ] Áo Thun NOWHERE From Relaxfit Tôn dáng '
    + 'KHÔNG ôm body  VẢI EM PÉ DÀNH CHO NGƯỜI LỚN  - Thời trang  đơn giản';
  const r = cotLoiTenHang(that);
  check('bo cum trong ngoac vuong', !r.includes('['), r);
  check('cat o dau gach ngang', !r.includes('Thời trang'), r);
  check('giu toi da 4 tu', r.split(' ').length <= 4, `"${r}"`);
  check('van con phan nhan dien duoc mon do', /áo|thun/i.test(r), `"${r}"`);

  check('bo tu "nam"', !cotLoiTenHang('Quần jogger nam kaki').includes('nam'),
    cotLoiTenHang('Quần jogger nam kaki'));
  check('ten ngan thi giu nguyen', cotLoiTenHang('Giày sneaker trắng') === 'Giày sneaker trắng');
}

console.log('\n=== 2. Dat ten set do ===');
{
  const base = {
    styleLabel: 'Smart casual', occasionLabel: 'Đi làm',
    colorLabels: ['Trắng', 'Đen'], items: [],
  };
  check('day du -> ten day du', datTenTheoQuyTac(base) === 'Smart casual trắng đen — đi làm',
    datTenTheoQuyTac(base) ?? '(null)');
  check('khong co mau', datTenTheoQuyTac({ ...base, colorLabels: [] })
    === 'Smart casual — đi làm');
  check('khong co dip', datTenTheoQuyTac({ ...base, occasionLabel: '' })
    === 'Smart casual trắng đen');
  check('toi da 2 mau', !datTenTheoQuyTac({ ...base, colorLabels: ['Trắng','Đen','Be','Navy'] })!
    .includes('navy'));
  check('chua chon phong cach -> null', datTenTheoQuyTac({ ...base, styleLabel: '' }) === null);
  check('bao dung ly do', thieuGiDeDatTen({ ...base, styleLabel: '' }).length === 1);
  check('du dieu kien thi khong bao thieu', thieuGiDeDatTen(base).length === 0);
}

console.log('\n=== 3. Viet mo ta ===');
{
  const input = {
    styleLabel: 'Tối giản', occasionLabel: 'Đi chơi cuối tuần',
    colorLabels: ['Trắng', 'Đen'],
    items: [
      { roleLabel: 'Áo', name: 'Áo thun nam cổ tròn basic', colorLabel: 'Trắng' },
      { roleLabel: 'Quần', name: 'Quần jogger kaki', colorLabel: 'Đen' },
      { roleLabel: 'Giày', name: 'Giày sneaker trắng đế cao su', colorLabel: 'Trắng' },
    ],
  };
  const r = vietMoTaTheoQuyTac(input)!;
  console.log('       ' + r);
  check('co liet ke cac mon', r.startsWith('Set gồm'));
  check('dung "và" truoc mon cuoi', r.includes(' và '));
  check('co noi dip dung', r.includes('đi chơi cuối tuần'));
  check('co bang mau', r.includes('Bảng màu'));
  check('khong bia tinh tu ve chat lieu',
    !/bền|cao cấp|thoải mái|êm|mềm mại|sang trọng/i.test(r));

  // "Giay sneaker trang" + nhan mau "Trang" tung ra "giay sneaker trang de trang":
  // ten hang da co mau roi, nhan mau van bi noi them vao sau.
  check('khong noi mau hai lan trong cung mot mon', !/trắng[^,.]*trắng/.test(r), r);
  // Cat cung 4 tu de lai duoi cau lung lung: "...trang de" (cut tu "de cao su").
  check('khong de lai tu cut o cuoi', !/\bđế[,.]/.test(r), r);

  check('mot mon thi khong viet -> null',
    vietMoTaTheoQuyTac({ ...input, items: input.items.slice(0, 1) }) === null);
  check('bao dung ly do',
    thieuGiDeVietMoTa({ ...input, items: input.items.slice(0, 1) }).length === 1);
}

/*
  MAU CUA SET CHUA CHON THI GOM TU CAC MON.

  Khong co buoc nay thi dien mau cho ca bon mon xong, bam "Dat ten tu dong" van
  ra dung cai ten khong co mau nhu truoc — va khong noi vi sao.
*/
console.log('\n=== 4. Bang mau gom tu cac mon ===');
{
  const items = [
    { roleLabel: 'Áo', name: 'Áo sơ mi', colorLabel: 'Trắng' },
    { roleLabel: 'Quần', name: 'Quần tây', colorLabel: 'Đen' },
    { roleLabel: 'Giày', name: 'Giày lười', colorLabel: 'Đen' },
  ];
  const nen = { styleLabel: 'Smart casual', occasionLabel: 'Đi làm', items };

  check('mau cua set duoc uu tien tuyet doi',
    bangMau({ ...nen, colorLabels: ['Be'] }).join(',') === 'Be');
  check('chua chon thi gom tu cac mon',
    bangMau({ ...nen, colorLabels: [] }).join(',') === 'Trắng,Đen');
  check('khong lap mau trung', bangMau({ ...nen, colorLabels: [] }).length === 3 - 1);
  check('khong mon nao co mau thi rong',
    bangMau({ ...nen, colorLabels: [], items: items.map((i) => ({ ...i, colorLabel: undefined })) })
      .length === 0);

  const ten = datTenTheoQuyTac({ ...nen, colorLabels: [] });
  check('ten lay mau tu cac mon', ten === 'Smart casual trắng đen — đi làm', ten ?? 'null');

  const moTa = vietMoTaTheoQuyTac({ ...nen, colorLabels: [] })!;
  check('mo ta cung lay bang mau do', moTa.includes('Bảng màu: trắng, đen.'), moTa);
}

console.log(`\n>>> ${pass} PASS, ${fail} FAIL`);
if (fail) process.exitCode = 1;
