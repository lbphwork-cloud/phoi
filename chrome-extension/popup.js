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
 *
 * ================================================================
 * HAI LOI THAT DA DUOC CHU WEBSITE CHI RA, VA CACH CHUA
 * ================================================================
 *
 * LOI 1 — GIA SAI HOAN TOAN.
 *   Trang quan kaki hien "325.000đ - 369.000đ" ma tien ich tra ve 15.000đ.
 *   Nguyen nhan: khi khong tim thay o gia, ban cu doc 2000 ky tu dau cua CA
 *   TRANG roi lay so NHO NHAT trong do. Trong 2000 ky tu ay co dong "Tặng
 *   Voucher 15.000đ" — va 15.000 nho hon 325.000.
 *
 *   Quy tac "lay so nho nhat" von dung cho MOT KHOANG GIA cua mot san pham
 *   (325.000 - 369.000 thi lay 325.000). Dem no ap len toan bo chu tren trang
 *   la sai ca ve ky thuat lan ve y nghia: no lay so nho nhat trong moi con so
 *   co ky hieu tien, ke ca phi ship, ma giam gia va gia san pham goi y.
 *
 * LOI 2 — LAY NHAM ANH NGUOI DUNG.
 *   Sau tam anh doc duoc thi co anh dai dien cua chinh chu website, anh mot
 *   nguoi la, va mot tam anh phong canh. Nguyen nhan: ban cu lay MOI the <img>
 *   tren trang tu 300px tro len roi xep theo dien tich. Anh nguoi mua dinh kem
 *   trong phan danh gia deu to hon 300px, va anh dai dien goc phai man hinh
 *   cung vay.
 *
 * CACH CHUA: HOI THANG SHOPEE, dung doan tu giao dien.
 *   Trang san pham Shopee co dia chi dang .../ten-san-pham-i.<shopid>.<itemid>.
 *   Tu hai con so do goi duoc API cua chinh Shopee. Goi tu TRONG trang nen no
 *   mang theo cookie va cung nguon — khong bi chan nhu goi tu may chu.
 *
 *   API tra ve gia va danh sach anh CUA SAN PHAM, khong lan anh danh gia. Doc
 *   duoc thi khong con phai doan gi nua.
 *
 *   Duong doc giao dien van giu lam du phong (cho TikTok, va cho khi API doi),
 *   nhung da duoc siet lai — xem chu thich o tung cho.
 */
async function readProductPage() {
  const ghiChu = [];

  // ------------------------------------------------------------------
  // DUONG 1: API cua chinh Shopee
  // ------------------------------------------------------------------
  const idFromUrl = location.pathname.match(/-i\.(\d+)\.(\d+)/);

  if (idFromUrl) {
    const [, shopId, itemId] = idFromUrl;
    try {
      const res = await fetch(
        `/api/v4/pdp/get_pc?item_id=${itemId}&shop_id=${shopId}`,
        { credentials: 'include', headers: { 'x-api-source': 'pc' } },
      );
      const j = await res.json();
      const it = j?.data?.item ?? j?.item ?? null;

      if (it) {
        /*
          Gia cua Shopee luu theo don vi 1/100.000 dong: 325.000d ghi la
          32500000000. Chia roi kiem lai trong khoang hop ly — neu Shopee doi
          don vi thi phep kiem nay bat duoc, con hon la hien mot con so sai.
        */
        const doiGia = (v) => {
          const n = Number(v) / 100000;
          return Number.isFinite(n) && n >= 1000 && n <= 100000000 ? Math.round(n) : null;
        };
        // Khoang gia thi lay so NHO NHAT — dung con so nguoi mua nhin thay dau
        // tien, va dung con so ma giao dien ghi la "gia tu".
        const gia = doiGia(it.price_min) ?? doiGia(it.price) ?? doiGia(it.price_max);

        const anhApi = (it.images ?? [])
          .filter(Boolean)
          .slice(0, 6)
          .map((h) => (/^https?:/.test(h) ? h : `https://down-vn.img.susercontent.com/file/${h}`));

        if (gia || anhApi.length) {
          ghiChu.push(`API Shopee: ${anhApi.length} ảnh, giá ${gia ?? 'không đọc được'}`);
          return {
            name: (it.name || document.title || '').slice(0, 200) || null,
            price_vnd: gia,
            image_url: anhApi[0] ?? null,
            image_urls: anhApi,
            url: location.href.split('#')[0],
            platform: 'shopee',
            source: 'extension-api',
            debug: ghiChu,
          };
        }
        ghiChu.push('API Shopee trả về nhưng không có giá lẫn ảnh.');
      } else {
        ghiChu.push('API Shopee không trả về dữ liệu sản phẩm.');
      }
    } catch (e) {
      ghiChu.push(`API Shopee lỗi: ${e.message}`);
    }
  }

  // ------------------------------------------------------------------
  // DUONG 2: doc giao dien (TikTok, hoac khi API khong dung duoc)
  // ------------------------------------------------------------------
  return docTuGiaoDien();

  /*
    HAM NAY PHAI NAM BEN TRONG readProductPage.

    chrome.scripting.executeScript chi chen DUNG MOT ham vao trang. Mot ham phu
    khai bao o cap cao trong file nay van chay tot trong popup, nhung trong ngu
    canh cua trang Shopee thi no khong ton tai — va loi chi hien ra luc bam nut,
    tren mot trang that. Long vao trong la cach duy nhat chac chan.
  */
  function docTuGiaoDien() {
  const meta = (key) =>
    document.querySelector(`meta[property="${key}"]`)?.content ||
    document.querySelector(`meta[name="${key}"]`)?.content ||
    null;


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

  /*
    O GIA PHAI LA MOT O CHI CO GIA, khong phai mot doan van co so tien trong do.

    Day la cho da tra ve 15.000d cho mot chiec quan 325.000d. Cach chua: chi
    nhan phan tu ma TOAN BO chu ben trong no la gia — "₫325.000" hoac
    "₫325.000 - ₫369.000". Dong "Tặng Voucher 15.000đ" co them chu nen bi loai,
    va do dung la dieu can.

    Chi xet phan tu la NUT LA (khong con phan tu con): the cha bao boc ca khoi
    cung khop mau khi ben trong no chi co gia, va lay the cha thi de dinh them
    chu cua cac the anh em.
  */
  const MAU_GIA = /^\s*[₫đ]?\s*[\d.,]{3,}\s*(?:[₫đ]|vnd)?\s*(?:[-–]\s*[₫đ]?\s*[\d.,]{3,}\s*(?:[₫đ]|vnd)?)?\s*$/i;

  const oGia = [...document.querySelectorAll('div, span, strong, b, p')]
    .filter((el) => {
      const t = el.textContent?.trim() ?? '';
      if (t.length > 40 || !MAU_GIA.test(t)) return false;
      if (!/[₫đ]|vnd/i.test(t)) return false;
      return !el.querySelector('div, span, strong, b, p');
    })
    .map((el) => el.textContent.trim());

  let price = null;
  for (const t of oGia) {
    price = parsePrice(t);
    if (price) { ghiChu.push(`Giá đọc từ ô "${t}"`); break; }
  }

  // The meta la duong cuoi. No dung khi co, chi la Shopee thuong khong dat.
  if (!price) {
    price = parsePrice(meta('product:price:amount'));
    if (price) ghiChu.push('Giá đọc từ thẻ meta.');
  }
  if (!price) ghiChu.push('Không tìm được ô nào chỉ chứa giá.');

  /*
    LAY NHIEU ANH, khong chi mot.

    Anh og:image la anh BIA do nguoi ban chon — hay la anh ghep co chu quang
    cao dan len, tuc la anh te nhat de lam mau cho AI. Tien ich chay TRONG
    trang that nen no thay ca thu vien anh da tai xong, thu ma may chu khong
    bao gio thay.

    Gom trung theo ma file (bo duoi va bo phan kich thuoc) — Shopee tro cung
    mot tam anh bang nhieu duong dan khac nhau.
  */
  const maAnh = (u) => (u.split('/').pop() || u).split('@')[0].replace(/\.(webp|jpe?g|png|avif)$/i, '');

  const images = [];
  const daCo = new Set();
  const themAnh = (u) => {
    if (!u || !/^https?:/.test(u)) return;
    const ma = maAnh(u);
    if (!ma || daCo.has(ma) || images.length >= 6) return;
    daCo.add(ma);
    images.push(u.split('@')[0]);
  };

  themAnh(meta('og:image'));
  themAnh(meta('twitter:image'));

  /*
    CHI LAY ANH TRONG KHU VUC SAN PHAM.

    Ban cu lay moi the <img> tu 300px tro len roi xep theo dien tich, va do la
    ly do ket qua co ca anh dai dien cua chu website lan anh phong canh cua mot
    nguoi mua. Anh nguoi mua dinh kem trong phan danh gia deu lon hon 300px, va
    xep theo dien tich thi chung con dung tren anh san pham that.

    Hai lop chan:

    1. CAT O PHAN DANH GIA. Moi thu tu do tro xuong — danh gia, san pham tuong
       tu, gian hang khac — deu khong phai anh cua san pham nay. Tim moc bang
       chu tren trang thay vi bang ten lop, vi ten lop cua Shopee la chuoi ky
       tu ngau nhien doi theo tung ban phat hanh.

    2. CHI NHAN ANH TU KHO ANH CUA SAN. Anh dai dien nguoi dung nam o duong dan
       khac, va anh tu trang khac chen vao thi khong phai anh san pham.
  */
  const moc = [...document.querySelectorAll('div, section, h2')]
    .find((el) => /^(đánh giá sản phẩm|product ratings|sản phẩm tương tự)/i
      .test((el.textContent ?? '').trim().slice(0, 40)));

  const truocDanhGia = (img) => {
    if (!moc) return true;
    // compareDocumentPosition: FOLLOWING = moc nam SAU tam anh trong tai lieu.
    return Boolean(img.compareDocumentPosition(moc) & Node.DOCUMENT_POSITION_FOLLOWING);
  };

  const laAnhSan = (u) =>
    /(susercontent\.com|shopee|tiktokcdn|ibyteimg)/i.test(u || '');

  const truocLoc = [...document.images].length;
  const anhUngVien = [...document.images]
    .filter((i) => i.naturalWidth >= 300 && i.naturalHeight >= 300)
    .filter((i) => laAnhSan(i.currentSrc || i.src))
    .filter(truocDanhGia)
    .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);

  ghiChu.push(
    `Ảnh: ${truocLoc} thẻ trên trang, còn ${anhUngVien.length} sau khi lọc`
    + (moc ? ' (đã cắt từ phần đánh giá trở xuống)' : ' (không thấy mốc phần đánh giá)'),
  );

  anhUngVien.forEach((i) => themAnh(i.currentSrc || i.src));

  let image = images[0] || null;
  if (image && !/^https?:/.test(image)) {
    image = new URL(image, location.href).toString();
  }

  const host = location.hostname.replace(/^www\./, '');

  return {
    name: name.slice(0, 200) || null,
    price_vnd: price,
    image_url: image,
    // Ca danh sach, de website hien khoi chon anh giong het khi lay tu may chu.
    image_urls: images,
    // location.href la URL THAT sau moi chuyen huong — khong phai link rut gon
    url: location.href.split('#')[0],
    platform: host.includes('shopee') ? 'shopee' : host.includes('tiktok') ? 'tiktok' : null,
    source: 'extension-dom',
    debug: ghiChu,
  };
  }
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

  /*
    NOI RO DOC BANG DUONG NAO VA THAY GI.

    Khong co dong nay thi khi ket qua sai, cach duy nhat de biet vi sao la chup
    man hinh gui cho toi — dung nhu lan truoc. Vai dong chan doan ngay tren
    popup tra loi duoc ngay: giay lay tu o nao, con bao nhieu anh sau khi loc,
    va API cua san co dung duoc khong.
  */
  const nguon = result.source === 'extension-api'
    ? 'Đọc bằng API của Shopee'
    : 'Đọc bằng cách quét giao diện';

  $('status').textContent =
    (result.price_vnd
      ? `${nguon}. Đã có tên, giá và ${result.image_urls?.length ?? 0} ảnh.`
      : `${nguon}. Có tên và ${result.image_urls?.length ?? 0} ảnh, chưa chắc giá nên để trống.`)
    + (result.debug?.length ? '\n\n' + result.debug.join('\n') : '');
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
