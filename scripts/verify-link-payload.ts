/**
 * Kiem chung bo doc thong tin san pham tu chinh duong dan.
 *
 * Link TikTok o day la LINK THAT chu website gui, chi cat bot cac tham so theo
 * doi khong lien quan. Giu nguyen dang goc — ke ca dau cach ma hoa thanh "+",
 * dau ngoac vuong trong ten, va duong dan anh co dau "\/" bi thoat hai lan —
 * vi do la nhung cho de lam bo giai ma hong.
 *
 * Kich thuoc anh: da kiem bang cach TAI THAT ve tu may chu ByteDance truoc khi
 * viet ham. 260x260 ra 8.938 byte, 800x800 ra 52.244 byte, ca hai HTTP 200 va
 * deu la anh WebP hop le. Doi hai con so trong duong dan la duoc ban to hon
 * that, khong phai phong to mot anh nho.
 */

import { readPayloadFromUrl, upsizeByteDanceImage } from '../src/lib/linkPayload';

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
}

const LINK_TIKTOK_THAT =
  'https://www.tiktok.com/view/product/1731403111875315791?_d=emg5d22776h3fj&_svg=1' +
  '&og_info=%7B%22title%22%3A%22%5B+Phi%C3%AAn+B%E1%BA%A3n+N%C3%A2ng+C%E1%BA%A5p+Cleanfit+%5D' +
  '+%C3%81o+Thun+NOWHERE+From+Relaxfit%22%2C%22image%22%3A%22https%3A%5C%2F%5C%2F' +
  'p16-oec-sg.ibyteimg.com%5C%2Ftos-alisg-i-aphluv4xwc-sg%5C%2F' +
  '97163a794b6b40c88f38e51c2dc851f7~tplv-aphluv4xwc-resize-webp%3A260%3A260.webp%22%7D' +
  '&tt_from=copy';

console.log('\n=== 1. Link chia se TikTok that ===');
{
  const r = readPayloadFromUrl(LINK_TIKTOK_THAT);
  check('doc duoc du lieu tu link', r !== null);
  check('lay dung ten san pham',
    r?.name === '[ Phiên Bản Nâng Cấp Cleanfit ] Áo Thun NOWHERE From Relaxfit',
    r?.name ?? '(rong)');
  check('lay duoc duong dan anh', (r?.imageUrl ?? '').startsWith('https://p16-oec-sg.ibyteimg.com/'));
  check('anh da duoc nang len 800x800', (r?.imageUrl ?? '').includes(':800:800'),
    r?.imageUrl?.slice(-40) ?? '');
  check('ghi dung nguon', r?.source === 'tiktok-og_info');
}

console.log('\n=== 2. Nang kich thuoc anh ByteDance ===');
{
  const nho = 'https://x.com/a~tplv-abc123-resize-webp:260:260.webp?t=1';
  check('doi ca hai con so', upsizeByteDanceImage(nho).includes('resize-webp:800:800'));
  check('giu nguyen phan tham so phia sau', upsizeByteDanceImage(nho).endsWith('.webp?t=1'));

  // Duong dan khong theo mau ByteDance thi phai TRA VE NGUYEN BAN. Tu che bien
  // mot duong dan khong nhan ra se tao ra anh vo — te hon anh nho.
  const la = 'https://cf.shopee.vn/file/abcdef';
  check('duong dan la thi giu nguyen', upsizeByteDanceImage(la) === la);
}

console.log('\n=== 3. Cac link KHONG mang san du lieu ===');
{
  check('link rut gon vt.tiktok.com', readPayloadFromUrl('https://vt.tiktok.com/ZS8Ab/') === null);
  check('link Shopee thuong',
    readPayloadFromUrl('https://shopee.vn/product-i.123.456') === null);
  check('chuoi khong phai URL', readPayloadFromUrl('day khong phai link') === null);
  check('og_info hong cu phap',
    readPayloadFromUrl('https://www.tiktok.com/view/product/1?og_info=%7Bhong') === null);
  check('ten mien la khong duoc doc',
    readPayloadFromUrl('https://tiktok.com.evil.net/x?og_info=%7B%22title%22%3A%22a%22%7D') === null);
}

console.log(`\n>>> ${pass} PASS, ${fail} FAIL`);
if (fail) process.exitCode = 1;
