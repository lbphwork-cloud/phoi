/**
 * Edge Function: fetch-product
 * BAC 1 cua chuoi lay du lieu san pham.
 *
 * NHIEM VU
 *   1. Nhan mot link Shopee/TikTok.
 *   2. Kiem tra ten mien nam trong danh sach cho phep.
 *   3. Neu la link rut gon: theo chuyen huong de tim ten mien DICH THUC, roi
 *      kiem tra lai. Day la cho chan open redirect — kiem tra chuoi nguoi dung
 *      nhap vao la KHONG du, vi shp.ee co the tro di bat ky dau.
 *   4. Doc the Open Graph (og:title, og:image, og:description) tu HTML.
 *
 * VI SAO DOC THE OPEN GRAPH KHONG PHAI LA CAO DU LIEU
 *   Day la metadata ma san CHU DONG cong bo de link cua ho hien dep khi duoc
 *   chia se len Facebook/Zalo. Ham nay lam dung viec ma mot bot xem truoc link
 *   lam, khong goi API noi bo, khong vuot CAPTCHA, khong doc DOM sau khi chay
 *   JavaScript.
 *
 * HAN CHE DA BIET
 *   Edge Function chay tu trung tam du lieu, ma Shopee chan IP trung tam du lieu
 *   rat gat. Bac nay se that bai kha thuong xuyen. Do la ly do co Bac 2
 *   (Local Helper chay tren may ca nhan, IP nha mang that). That bai o day
 *   khong phai loi — no la duong di da tinh truoc.
 *
 * TRIEN KHAI
 *   npx supabase functions deploy fetch-product --no-verify-jwt=false
 */

// Ten mien GOC duoc phep. Moi ten mien con cua chung cung duoc phep.
// Phai khop voi is_allowed_affiliate_host() trong SQL, ALLOWED_ROOT_DOMAINS
// trong src/lib/affiliate.ts, va helper.py. npm run verify:helper doi chieu ca
// bon noi.
const ALLOWED_ROOT_DOMAINS = ['shopee.vn', 'shp.ee', 'shope.ee', 'tiktok.com'];
const SHORTENER_ROOT_DOMAINS = ['shp.ee', 'shope.ee'];
const SHORTENER_EXACT_HOSTS = ['s.shopee.vn', 'vt.tiktok.com', 'vm.tiktok.com'];

/** Dau cham truoc domain la phan quan trong: khong co no thi "evil-shp.ee" cung khop. */
const isUnderDomain = (host: string, domain: string): boolean =>
  host === domain || host.endsWith('.' + domain);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Giong ham url_host() trong SQL va urlHost() trong TypeScript. */
function urlHost(raw: string): string | null {
  if (!raw) return null;
  let h = raw.trim().toLowerCase();
  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  h = h.replace(/^[^/@]*@/, '');
  h = h.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  h = h.replace(/^www\./, '');
  return h === '' ? null : h;
}

const isAllowed = (h: string | null) =>
  h !== null && ALLOWED_ROOT_DOMAINS.some((d) => isUnderDomain(h, d));

const isShortener = (h: string | null) =>
  h !== null &&
  (SHORTENER_EXACT_HOSTS.includes(h) ||
    SHORTENER_ROOT_DOMAINS.some((d) => isUnderDomain(h, d)));

function platformOf(h: string | null): 'shopee' | 'tiktok' | null {
  if (!h) return null;
  if (isUnderDomain(h, 'shopee.vn')) return 'shopee';
  if (isUnderDomain(h, 'shp.ee') || isUnderDomain(h, 'shope.ee')) return 'shopee';
  if (isUnderDomain(h, 'tiktok.com')) return 'tiktok';
  return null;
}

/**
 * HAI User-Agent cho HAI buoc khac nhau. Day khong phai tuy chon — do thuc te
 * do bang link that:
 *
 *   Buoc resolve link rut gon (vn.shp.ee):
 *       UA crawler  -> HTTP 403  (Shopee chan crawler o tang link rut gon)
 *       UA trinh duyet -> HTTP 200, chuyen huong dung
 *
 *   Buoc doc the OG tren URL san pham day du:
 *       UA trinh duyet -> tra ve vo SPA rong, GIONG Y NGUYEN trang chu,
 *                         khong co the OG nao, khong co ca ma san pham
 *       UA crawler     -> tra ve HTML co day du og:title va og:image
 *
 * Nen phai dung UA_BROWSER de di theo chuyen huong, roi doi sang UA_CRAWLER de
 * doc the OG. Lam nguoc lai thi that bai o ca hai buoc.
 *
 * Dung UA crawler o buoc hai la trung thuc: dung viec ma mot bot xem truoc link
 * lam — doc metadata ma san chu dong cong bo de duoc chia se.
 */
const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const UA_CRAWLER =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

/** Theo chuyen huong tung buoc de biet ten mien dich thuc. */
async function resolveRedirects(
  url: string,
  maxHops = 5,
): Promise<{ finalUrl: string; host: string | null; hops: number }> {
  let current = url;

  for (let hop = 0; hop < maxHops; hop++) {
    const host = urlHost(current);

    // Kiem tra o TUNG buoc, khong chi buoc cuoi. Mot chuyen huong trung gian
    // ra ngoai la du de tu choi.
    if (!isAllowed(host)) {
      return { finalUrl: current, host, hops: hop };
    }
    if (!isShortener(host)) {
      return { finalUrl: current, host, hops: hop };
    }

    let res: Response;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': UA_BROWSER, 'Accept-Language': 'vi-VN,vi;q=0.9' },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { finalUrl: current, host, hops: hop };
    }

    const next = res.headers.get('location');
    if (!next) return { finalUrl: current, host, hops: hop };

    current = next.startsWith('http') ? next : new URL(next, current).toString();
  }

  return { finalUrl: current, host: urlHost(current), hops: maxHops };
}

/**
 * Duong dan cua trang chan bot.
 *
 * Shopee KHONG tra 403 ma CHUYEN HUONG sang /verify/traffic/error. Trang do tra
 * HTTP 200 va co the og:title — nhung la tieu de TRANG CHU. Neu chi kiem tra
 * res.ok roi doc the OG thi se tra ve "Shopee Viet Nam | Mua va Ban..." lam ten
 * san pham. Day tung la mot bug that o Local Helper, phat hien khi chay thu link
 * that cua nguoi dung.
 */
const BOT_CHECK_PATHS = [
  '/verify/traffic',
  '/verify/captcha',
  '/captcha',
  '/challenge',
  '/cdn-cgi/challenge',
];

const isBotCheckUrl = (u: string): boolean => {
  if (!u) return false;
  const path = u.toLowerCase().replace(/^[a-z]+:\/\/[^/]*/, '').split('?')[0];
  return BOT_CHECK_PATHS.some((m) => path.includes(m));
};

/**
 * Tieu de trang chu cua san.
 *
 * PHAI so khop DAU CHUOI, va phai kiem tra SAU khi bo hau to. Moi tieu de san
 * pham cua Shopee deu KET THUC bang "| Shopee Viet Nam" — dung includes() thi
 * se tu choi dung MOI san pham that. Day cung tung la mot bug that.
 */
const GENERIC_TITLE_PREFIXES = [
  'shopee viet nam',
  'shopee vietnam',
  'mua sam online',
  'tiktok - lam quen',
  'tiktok shop',
];

const MIN_PRODUCT_NAME_LEN = 8;

/** Bo dau tieng Viet. NFD tach dau ra nhung khong xoa — phai loc them. */
const stripAccents = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

/** Bo hau to ' | Shopee Viet Nam' / ' | TikTok Shop' o cuoi tieu de. */
const stripMarketplaceSuffix = (t: string): string =>
  t.replace(/\s*\|\s*(Shopee[^|]*|TikTok[^|]*)$/, '').trim();

const isGenericTitle = (title: string | undefined): boolean => {
  if (!title) return true;
  const flat = stripAccents(stripMarketplaceSuffix(title)).trim();
  if (flat.length < MIN_PRODUCT_NAME_LEN) return true;
  return GENERIC_TITLE_PREFIXES.some((g) => flat.startsWith(g));
};

/** Doc cac the meta Open Graph tu HTML. */
function parseOpenGraph(html: string): Record<string, string> {
  const out: Record<string, string> = {};

  // Chi doc phan <head> de khong quet ca trang, va de khong bat cac the meta
  // nam trong noi dung do nguoi ban tu nhap.
  const headEnd = html.indexOf('</head>');
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 200_000);

  // property="og:x" content="y" — thu tu thuoc tinh co the dao, nen thu ca hai chieu
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](og:[^"']+|product:[^"']+|twitter:[^"']+)["'][^>]+content=["']([^"']*)["']/gi,
    /<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](og:[^"']+|product:[^"']+|twitter:[^"']+)["']/gi,
  ];

  for (const [i, re] of patterns.entries()) {
    for (const m of head.matchAll(re)) {
      const key = i === 0 ? m[1] : m[2];
      const val = i === 0 ? m[2] : m[1];
      if (key && val && !out[key]) out[key] = decodeEntities(val.trim());
    }
  }

  // Du phong: the <title> neu khong co og:title
  if (!out['og:title']) {
    const t = /<title[^>]*>([^<]*)<\/title>/i.exec(head);
    if (t) out['og:title'] = decodeEntities(t[1].trim());
  }

  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

/**
 * Doc gia tu chuoi tieng Viet. Tra ve null khi khong chac.
 *
 * CO Y THAN TRONG: de bai yeu cau "khong duoc tu bia gia". Doan sai mot con so
 * gia con te hon la de trong cho nguoi dung tu dien. Nen chi nhan cac dang ro
 * rang, va tu choi khoang gia ("100.000 - 200.000") vi khong biet lay so nao.
 */
/*
  =============================================================================
  GOM NHIEU ANH SAN PHAM, khong chi mot

  VI SAO CAN NHIEU HON MOT
    Anh duy nhat lay duoc tu the chia se (og:image) la anh bia do nguoi ban
    chon — thuong la anh ghep co chu quang cao, hoac anh nguoi mau chup xa.
    Ca hai deu la anh TE NHAT de lam mau cho AI dung lai mon do.

    Cho nguoi dang chon giua vai anh thi ho chon duoc anh chup ro mon do nhat,
    va anh do vua lam anh hien tren website vua lam anh mau cho AI.

  LAY O DAU RA
    1. Cac the og:image / twitter:image (co trang khai bao nhieu the).
    2. Duong dan anh nam ngay trong HTML tro toi CDN anh cua chinh san do.
       Trang san pham nao cung nhung san danh sach anh trong mot khoi JSON;
       khong can hieu cau truc JSON do, chi can nhat ra cac duong dan anh.

  CHI NHAN CDN CUA SAN. Quet ca trang lay moi duong dan .jpg se vo phai icon,
  banner quang cao, anh dai dien nguoi ban. Gioi han vao dung CDN anh san pham
  la cach re nhat de khong phai loc rac ve sau.

  KHONG HUA DU BA ANH. Co link chi co dung mot anh, va do la su that cua link
  do chu khong phai loi. Ham tra ve nhung gi doc duoc.
  =============================================================================
*/
const CDN_ANH = [
  'down-vn.img.susercontent.com',
  'cf.shopee.vn',
  'ibyteimg.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
];

function gomAnh(html: string, og: Record<string, string>, toiDa = 6): string[] {
  const ra: string[] = [];
  const them = (u: string | undefined) => {
    if (!u) return;
    const sach = u.trim().replace(/&amp;/g, '&');
    if (!sach.startsWith('https://')) return;
    if (ra.length >= toiDa) return;
    // So khong phan biet duoi anh: cung mot anh o hai kich thuoc van la mot anh
    // trung — nhung khong doan xa hon the, vi moi san dat ten mot kieu.
    if (!ra.includes(sach)) ra.push(sach);
  };

  them(og['og:image']);
  them(og['twitter:image']);

  for (const m of html.matchAll(/https:\/\/[^"'\s\\<>]+/g)) {
    if (ra.length >= toiDa) break;
    const u = m[0];
    if (!CDN_ANH.some((d) => u.includes(d))) continue;
    // Bo cac duong dan khong phai anh tinh (video, sprite, icon nho).
    if (/\.(mp4|webm|m3u8|svg)(\?|$)/i.test(u)) continue;
    them(u);
  }

  return ra;
}

function parsePriceVnd(text: string | undefined): number | null {
  if (!text) return null;

  /*
    KHOANG GIA THI LAY SO NHO NHAT, khong bo qua nua.

    Ban truoc gap "100.000₫ - 200.000₫" la tra ve null, voi ly do "khong doan
    bua". Ly do do dung ve nguyen tac nhung sai ve ket qua: phan lon trang san
    pham tren san deu hien mot khoang gia (vi nhieu size, nhieu mau), nen o gia
    gan nhu luon trong va nguoi dang phai tu go tay tung mon.

    Lay so NHO NHAT chu khong phai so lon hay trung binh, vi do la con so ma
    nguoi mua nhin thay dau tien tren san va la con so ho so sanh. Giao dien
    ghi ro day la "gia tu", de khong ai hieu nham la gia chot.

    Van bo qua khi CA HAI DAU deu khong doc duoc — mot khoang gia hong thi
    khong co gi de lay.
  */
  const dsSo = [...text.matchAll(/(\d[\d.,]{2,})\s*(?:₫|đ\b|vnd\b|VND\b)/gi)]
    .map((m) => Number(m[1].replace(/[.,]/g, '')))
    // Gioi han hop ly cho pham vi san pham cua website (150k - 700k, cho bien rong)
    .filter((n) => Number.isFinite(n) && n >= 10_000 && n <= 100_000_000);

  if (dsSo.length === 0) {
    // Con so KHONG kem ky hieu tien te: chi chap nhan khi ca chuoi la mot so,
    // vi day la truong hop product:price:amount tra ve "320000".
    const tron = text.trim().replace(/[.,]/g, '');
    const n = Number(tron);
    if (/^\d+$/.test(tron) && Number.isFinite(n) && n >= 10_000 && n <= 100_000_000) return n;
    return null;
  }

  return Math.min(...dsSo);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ ok: false, error: 'Chỉ nhận POST.' }, 405);

  let url: string;
  try {
    const body = await req.json();
    url = String(body?.url ?? '');
  } catch {
    return json({ ok: false, error: 'Body không phải JSON hợp lệ.' }, 400);
  }

  if (!url) return json({ ok: false, error: 'Thiếu tham số url.' }, 400);

  const rawHost = urlHost(url);
  if (!isAllowed(rawHost)) {
    return json(
      { ok: false, error: `Chỉ nhận link Shopee hoặc TikTok. Tên miền "${rawHost}" bị từ chối.` },
      400,
    );
  }

  // --- Theo chuyen huong ---------------------------------------------------
  const resolved = await resolveRedirects(url);

  if (!isAllowed(resolved.host)) {
    return json(
      {
        ok: false,
        error:
          `Link rút gọn chuyển hướng ra ngoài Shopee/TikTok (đến "${resolved.host}"). ` +
          'Từ chối để tránh link đánh lừa người dùng.',
      },
      400,
    );
  }

  if (isShortener(resolved.host)) {
    return json({
      ok: false,
      error: 'Không theo hết được chuỗi chuyển hướng của link rút gọn. Thử nhập link đầy đủ.',
    });
  }

  // --- Doc the Open Graph -------------------------------------------------
  let html: string;
  try {
    const res = await fetch(resolved.finalUrl, {
      headers: {
        'User-Agent': UA_CRAWLER,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'vi-VN,vi;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return json({
        ok: false,
        error:
          `Sàn trả về mã ${res.status}. Thường là do chặn IP trung tâm dữ liệu — ` +
          'đây là lúc Bậc 2 (Local Helper trên máy bạn) phát huy tác dụng.',
      });
    }

    // Bi day sang trang chan bot: HTTP van la 200 nen res.ok khong bat duoc
    if (isBotCheckUrl(res.url)) {
      return json({
        ok: false,
        error:
          'Sàn chuyển hướng sang trang chống bot. Thường là do chặn IP trung tâm ' +
          'dữ liệu — đây là lúc Bậc 2 (Local Helper trên máy bạn) phát huy tác dụng.',
      });
    }

    html = await res.text();
  } catch (e) {
    return json({
      ok: false,
      error: `Không tải được trang: ${(e as Error).message}. Chuyển sang Bậc 2.`,
    });
  }

  const og = parseOpenGraph(html);
  const rawTitle = og['og:title'] ?? og['twitter:title'] ?? '';

  if (!rawTitle) {
    return json({
      ok: false,
      error:
        'Trang tải được nhưng không có thẻ Open Graph. Với Shopee, đây thường là ' +
        'dấu hiệu sàn trả về vỏ SPA rỗng thay vì nội dung sản phẩm — toàn bộ nội ' +
        'dung do JavaScript render. Chuyển sang Bậc 2 (Local Helper chạy trình ' +
        'duyệt thật) hoặc nhập tay.',
    });
  }

  if (isGenericTitle(rawTitle)) {
    return json({
      ok: false,
      error:
        'Đọc được thẻ Open Graph nhưng là của TRANG CHỦ, không phải trang sản phẩm. ' +
        'Thường là do bị đẩy về trang chủ hoặc trang chặn bot. Chuyển sang Bậc 2 ' +
        'hoặc nhập tay.',
    });
  }

  const name = stripMarketplaceSuffix(rawTitle);

  // Gia co the nam o og:description hoac product:price:amount
  const priceVnd =
    parsePriceVnd(og['product:price:amount']) ??
    parsePriceVnd(og['og:description']) ??
    parsePriceVnd(og['og:title']);

  const anhList = gomAnh(html, og);

  return json({
    ok: true,
    result: {
      name: name.slice(0, 200),
      price_vnd: priceVnd,
      image_url: anhList[0] ?? null,
      /** Cac anh doc duoc, de nguoi dang chon mot. Co the it hon ba. */
      image_urls: anhList,
      platform: platformOf(resolved.host),
      resolved_url: resolved.finalUrl,
      resolved_host: resolved.host,
      source: 'og',
      // Giu lai the tho de doi chieu khi ket qua trong nghi ngo
      raw: og,
    },
  });
});
