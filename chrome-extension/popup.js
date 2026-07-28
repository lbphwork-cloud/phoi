/**
 * PHOI — tien ich Chrome
 *
 * VI SAO CACH NAY LA CACH LAY DU LIEU ON DINH NHAT
 *   Ban dang tu mo trang san pham bang trinh duyet cua chinh ban. Khong co tin
 *   hieu tu dong hoa nao ca: dung IP nha ban, dung trinh duyet that, dung phien
 *   dang nhap that. Ty le thanh cong gan 100%, va khong co gi de sang phai chan.
 *
 * VI SAO TIEN ICH KHONG GIU BAT KY KHOA NAO
 *   No khong noi tori Supabase. No doc trang, roi mo trang tao bai cua PHOI kem
 *   du lieu trong phan hash cua URL. Trang web (noi ban da dang nhap san) nhan
 *   du lieu do va dien vao form.
 *
 *   Dat du lieu o HASH (#) chu khong phai query (?) la co y: phan hash khong
 *   duoc gui len may chu trong yeu cau HTTP, nen no khong nam trong log truy cap
 *   cua Cloudflare hay bat ky may chu trung gian nao.
 */

const $ = (id) => document.getElementById(id);
const DEFAULT_SITE = 'https://phoi.pages.dev';

/**
 * Ham nay duoc CHEN VAO TRANG va chay trong ngu canh cua trang do.
 * Phai la mot ham doc lap: khong dung duoc bien nao ben ngoai.
 */
function readProductPage() {
  const meta = (key) =>
    document.querySelector(`meta[property="${key}"]`)?.content ||
    document.querySelector(`meta[name="${key}"]`)?.content ||
    null;

  const text = (sel) => document.querySelector(sel)?.innerText?.trim() || null;

  // Doc gia. CO Y than trong: tu choi khoang gia thay vi doan lay so dau,
  // vi hien sai gia con te hon la de trong cho nguoi dung tu dien.
  /*
    KHOANG GIA THI LAY SO NHO NHAT, khong tu choi nua.

    Ban truoc gap "100.000₫ - 200.000₫" la tra ve null voi ly do "khong doan
    bua". Dung ve nguyen tac nhung sai ve ket qua: gan nhu moi trang san pham
    tren san deu hien mot khoang (nhieu size, nhieu mau), nen o gia luon trong
    va nguoi dung phai go tay tung mon.

    So NHO NHAT la con so nguoi mua nhin thay dau tien tren san va la con so ho
    so sanh. Giao dien ghi ro day la "gia tu".

    Phai giong het parsePriceVnd trong supabase/functions/fetch-product — hai
    duong doc cung mot trang ma ra hai con so khac nhau la loi kho tim nhat.
  */
  const parsePrice = (s) => {
    if (!s) return null;
    const ds = [...String(s).matchAll(/(\d[\d.,]{2,})\s*(?:₫|đ\b|vnd\b)/gi)]
      .map((m) => Number(m[1].replace(/[.,]/g, '')))
      .filter((n) => Number.isFinite(n) && n >= 10000 && n <= 100000000);
    if (ds.length) return Math.min(...ds);

    // Con so tran khong kem ky hieu: chi nhan khi ca chuoi la mot so, vi day
    // la truong hop the product:price:amount tra ve "320000".
    const tron = String(s).trim().replace(/[.,]/g, '');
    const n = Number(tron);
    return /^\d+$/.test(tron) && n >= 10000 && n <= 100000000 ? n : null;
  };

  let name = meta('og:title') || document.title || '';
  // Shopee/TikTok thuong noi thuong hieu vao sau ten
  name = name.replace(/\s*\|\s*(Shopee[^|]*|TikTok[^|]*)$/i, '').trim();

  // Thu cac vi tri hay chua gia, tu cu the tori chung chung
  const priceCandidates = [
    meta('product:price:amount'),
    text('[class*="price" i]'),
    text('[data-testid*="price" i]'),
    meta('og:description'),
    document.body?.innerText?.slice(0, 2000),
  ];

  let price = null;
  for (const c of priceCandidates) {
    price = parsePrice(c);
    if (price) break;
  }

  let image = meta('og:image') || meta('twitter:image');
  if (!image) {
    // Chon anh lon nhat trong trang lam anh san pham
    const imgs = [...document.images]
      .filter((i) => i.naturalWidth >= 200 && i.naturalHeight >= 200)
      .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
    image = imgs[0]?.src || null;
  }
  if (image && !/^https?:/.test(image)) {
    image = new URL(image, location.href).toString();
  }

  const host = location.hostname.replace(/^www\./, '');

  return {
    name: name.slice(0, 200) || null,
    price_vnd: price,
    image_url: image,
    // location.href la URL THAT sau moi chuyen huong — khong phai link rut gon
    url: location.href.split('#')[0],
    platform: host.includes('shopee') ? 'shopee' : host.includes('tiktok') ? 'tiktok' : null,
    source: 'extension',
  };
}

let scraped = null;

async function init() {
  const { site } = await chrome.storage.local.get('site');
  $('site').value = site || DEFAULT_SITE;

  $('site').addEventListener('change', () => {
    chrome.storage.local.set({ site: $('site').value.trim() });
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    $('status').textContent = 'Không đọc được tab hiện tại.';
    return;
  }

  const host = new URL(tab.url).hostname.replace(/^www\./, '');
  const supported = host.includes('shopee.vn') || host.includes('tiktok.com');

  if (!supported) {
    $('status').textContent =
      `Trang này (${host}) không phải Shopee hay TikTok.\n\n` +
      'Mở một trang sản phẩm trên shopee.vn hoặc tiktok.com rồi bấm lại.';
    return;
  }

  $('status').textContent = 'Đang đọc trang…';

  let result;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readProductPage,
    });
    result = res?.result;
  } catch (e) {
    $('status').textContent = `Không đọc được trang: ${e.message}`;
    return;
  }

  if (!result?.name) {
    $('status').textContent =
      'Đọc được trang nhưng không tìm thấy tên sản phẩm.\n\n' +
      'Có thể đây là trang danh sách chứ không phải trang một sản phẩm cụ thể.';
    return;
  }

  scraped = result;

  $('pimg').src = result.image_url || '';
  $('pname').textContent = result.name;
  $('pprice').textContent = result.price_vnd
    ? new Intl.NumberFormat('vi-VN').format(result.price_vnd) + 'đ'
    : 'Chưa đọc được giá — bạn tự điền sau';
  $('preview').style.display = 'block';

  $('send').disabled = false;
  $('status').textContent = result.price_vnd
    ? 'Đã đọc được tên, giá và ảnh.'
    : 'Đã đọc được tên và ảnh. Giá chưa chắc nên để trống — bạn tự điền trên PHỐI.';
}

$('send').addEventListener('click', async () => {
  if (!scraped) return;

  const site = ($('site').value.trim() || DEFAULT_SITE).replace(/\/+$/, '');

  // Dat du lieu o phan HASH: hash khong duoc gui len may chu nen khong nam
  // trong log truy cap cua bat ky may chu trung gian nao.
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(scraped))));
  const url = `${site}/tao-bai/#phoi=${payload}`;

  await chrome.tabs.create({ url });
  window.close();
});

$('copy').addEventListener('click', async () => {
  if (!scraped) {
    $('status').textContent = 'Chưa có dữ liệu để sao chép.';
    return;
  }
  await navigator.clipboard.writeText(JSON.stringify(scraped, null, 2));
  $('status').textContent = 'Đã sao chép JSON vào clipboard.';
});

init();
