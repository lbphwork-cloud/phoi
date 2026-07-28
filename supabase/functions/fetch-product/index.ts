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

/**
 * Ma dinh danh cua mot tam anh, bo het duoi va bo kich thuoc.
 *
 * Shopee tro cung MOT tam anh bang nhieu duong dan khac nhau:
 *     .../file/vn-11134207-81ztc-mo3iwq9vjv9c0e
 *     .../file/vn-11134207-81ztc-mo3iwq9vjv9c0e.webp
 *     .../file/vn-11134207-81ztc-mo3iwq9vjv9c0e@resize_w640_nl.webp
 *
 * Ban truoc coi day la ba anh khac nhau, nen khoi chon anh hien ra sau tam
 * anh ma thuc te chi la mot — chu website dem duoc va goi dung ten: "lay rat
 * nhieu anh ma bi trung".
 */
function maAnh(u: string): string {
  const cuoi = u.split('/').pop() ?? u;
  return cuoi.split('@')[0].replace(/\.(webp|jpe?g|png|avif)$/i, '');
}

/*
  =============================================================================
  GOM ANH SAN PHAM — VA LOAI ANH KHONG PHAI CUA SAN PHAM

  VAN DE THU HAI, do bang chinh link cua chu website: trong so cac anh gom
  duoc co ca ANH DAI DIEN CUA SHOP va mot anh nen dung chung cua Shopee.

  CACH PHAN BIET, do tren HTML that cua hai trang san pham:

      trang quan:  anh san pham xuat hien 20 lan
                   anh shop / anh dung chung xuat hien 2 lan
      trang ao:    sau anh san pham xuat hien 17-51 lan
                   anh shop / anh dung chung xuat hien 2 lan

  Ly do khoang cach lon nhu vay: anh trong thu vien san pham duoc nhac lai o
  moi bien the kich thuoc (srcset), o the preload, o anh nho ben duoi. Anh dai
  dien shop chi xuat hien mot cho.

  Nen luat la: DEM SO LAN MA ANH DO XUAT HIEN TRONG HTML, giu lai nhung anh
  duoc nhac tu ba lan tro len. Nguong ba chu khong phai muoi: de con cho cac
  trang co it bien the hon.

  GIOI HAN THAT SU, noi ro chu khong giau: HTML ma san tra ve cho bot xem
  truoc link chi chua mot phan thu vien anh. Trang quan cua chu website chi co
  DUNG MOT anh san pham trong do. Nhung anh nhin thay bang mat khi mo trang la
  do JavaScript tai ve sau — muon lay du thi phai qua Local Helper (trinh duyet
  that tren may). Do la gioi han cua duong doc nhanh, khong phai loi cua ham.
  =============================================================================
*/
function gomAnh(html: string, og: Record<string, string>, toiDa = 6): string[] {
  /** Ma anh -> so lan xuat hien trong HTML. */
  const dem = new Map<string, number>();
  /** Ma anh -> duong dan sach nhat gap duoc (khong duoi, khong kich thuoc). */
  const duong = new Map<string, string>();

  for (const m of html.matchAll(/https:\/\/[^"'\s\\<>]+/g)) {
    const u = m[0];
    if (!CDN_ANH.some((d) => u.includes(d))) continue;
    if (/\.(mp4|webm|m3u8|svg)(\?|$)/i.test(u)) continue;

    const ma = maAnh(u);
    if (!ma) continue;
    dem.set(ma, (dem.get(ma) ?? 0) + 1);

    // Giu ban KHONG co kich thuoc: no la anh goc, to nhat, va la ban dung lam
    // mau cho AI tot nhat. Ban @resize_w640 chi de hien nhanh tren trang san.
    if (!u.includes('@') && !duong.has(ma)) duong.set(ma, u);
    else if (!duong.has(ma)) duong.set(ma, u.split('@')[0]);
  }

  const anhBia = og['og:image'] ?? og['twitter:image'] ?? '';
  const maBia = anhBia ? maAnh(anhBia) : '';

  const ra: string[] = [];
  const themVao = (ma: string) => {
    const u = duong.get(ma);
    if (u && !ra.includes(u) && ra.length < toiDa) ra.push(u);
  };

  // Anh bia luon dung dau — do la anh san CHU DONG cong bo cho tam san pham.
  if (maBia) themVao(maBia);

  // Con lai: chi giu anh duoc nhac tu ba lan tro len, xep theo so lan giam dan
  // (anh duoc nhac nhieu nhat gan nhu luon la anh chinh cua thu vien).
  [...dem.entries()]
    .filter(([ma, n]) => n >= 3 && ma !== maBia)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ma]) => themVao(ma));

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
