/**
 * Kiem tra link affiliate o phia client.
 *
 * DAY KHONG PHAI LOP BAO VE. Lop bao ve that nam trong trigger
 * validate_affiliate_link() o supabase/migrations/0003_functions.sql — vi
 * nguoi dung co the goi thang REST API cua Supabase, bo qua hoan toan giao
 * dien nay. Muc dich cua file nay chi la bao loi som cho nguoi dung go link.
 *
 * Ba danh sach duoi day PHAI khop voi ba noi khac: ham SQL cung ten,
 * supabase/functions/fetch-product/index.ts, va local-helper/helper.py.
 * `npm run verify:helper` doi chieu ca bon noi va bao loi neu lech.
 */

export type Platform = 'shopee' | 'tiktok';

/**
 * Ten mien GOC duoc phep. Moi ten mien con cua chung cung duoc phep.
 *
 * VI SAO KHOP THEO TEN MIEN GOC, KHONG PHAI DANH SACH CUNG
 *   Ban dau day la danh sach cung liet ke tung ten mien. Nhung link that cua
 *   nguoi dung dung `vn.shp.ee` — mot ten mien khong co trong danh sach do, nen
 *   he thong tu choi chinh link that. Shopee con nhieu bien the theo quoc gia
 *   (`th.shp.ee`, `id.shp.ee`, ...) va co the them bat cu luc nao.
 *
 *   Khop theo ten mien goc bao het cac bien the do ma van an toan: chi Shopee
 *   moi tao duoc ten mien con cua shp.ee.
 */
export const ALLOWED_ROOT_DOMAINS: readonly string[] = [
  'shopee.vn',
  'shp.ee',
  'shope.ee',
  'tiktok.com',
];

/** Ten mien goc ma MOI ten mien con deu la link rut gon. */
export const SHORTENER_ROOT_DOMAINS: readonly string[] = ['shp.ee', 'shope.ee'];

/** Ten mien rut gon cu the, khong suy ra tu ten mien goc duoc. */
export const SHORTENER_EXACT_HOSTS: readonly string[] = [
  's.shopee.vn',
  'vt.tiktok.com',
  'vm.tiktok.com',
];

/**
 * host thuoc domain hay khong: bang chinh no, hoac la ten mien con cua no.
 *
 * Dau cham truoc domain la phan quan trong nhat. Khong co no thi
 * "evil-shp.ee" se duoc coi la thuoc "shp.ee".
 */
export function isUnderDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

/**
 * Lay ten mien tu url. Khop voi ham url_host() trong SQL.
 *
 * Xu ly ba ky thuat che ten mien thuong gap:
 *   https://shopee.vn@evil.com/x   -> evil.com   (khong phai shopee.vn)
 *   https://shopee.vn.evil.com/x   -> shopee.vn.evil.com
 *   https://evil.com/?u=shopee.vn  -> evil.com
 */
export function urlHost(raw: string): string | null {
  if (!raw) return null;
  let h = raw.trim().toLowerCase();

  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  // Bo phan user:pass@ — moi thu truoc dau @ dau tien khong phai ten mien
  h = h.replace(/^[^/@]*@/, '');
  h = h.split('/')[0].split('?')[0].split('#')[0];
  h = h.split(':')[0];
  h = h.replace(/^www\./, '');

  return h === '' ? null : h;
}

export const isAllowedHost = (host: string | null): boolean =>
  host !== null && ALLOWED_ROOT_DOMAINS.some((d) => isUnderDomain(host, d));

export const isShortenerHost = (host: string | null): boolean =>
  host !== null &&
  (SHORTENER_EXACT_HOSTS.includes(host) ||
    SHORTENER_ROOT_DOMAINS.some((d) => isUnderDomain(host, d)));

/** Suy ra nen tang tu ten mien. null neu khong nhan ra. */
export function platformOfHost(host: string | null): Platform | null {
  if (!host) return null;
  if (isUnderDomain(host, 'shopee.vn')) return 'shopee';
  if (isUnderDomain(host, 'shp.ee') || isUnderDomain(host, 'shope.ee')) return 'shopee';
  if (isUnderDomain(host, 'tiktok.com')) return 'tiktok';
  return null;
}

export interface LinkCheck {
  ok: boolean;
  host: string | null;
  platform: Platform | null;
  /** true neu con la link rut gon, can resolve o phia server truoc khi dang */
  needsResolve: boolean;
  message: string;
}

export function checkAffiliateUrl(raw: string, expected?: Platform): LinkCheck {
  const host = urlHost(raw);

  if (!host) {
    return {
      ok: false, host, platform: null, needsResolve: false,
      message: 'Chưa nhập link, hoặc link không đọc được.',
    };
  }

  if (!/^https?:\/\//i.test(raw.trim())) {
    return {
      ok: false, host, platform: null, needsResolve: false,
      message: 'Link phải bắt đầu bằng https://',
    };
  }

  if (!isAllowedHost(host)) {
    return {
      ok: false, host, platform: null, needsResolve: false,
      message: `Chỉ nhận link Shopee hoặc TikTok. Tên miền "${host}" không được phép.`,
    };
  }

  const platform = platformOfHost(host);

  if (expected && platform !== expected) {
    return {
      ok: false, host, platform, needsResolve: false,
      message: `Link này là của ${platform === 'shopee' ? 'Shopee' : 'TikTok'}, không phải ${expected === 'shopee' ? 'Shopee' : 'TikTok'}.`,
    };
  }

  const needsResolve = isShortenerHost(host);

  return {
    ok: true,
    host,
    platform,
    needsResolve,
    message: needsResolve
      ? 'Link rút gọn hợp lệ. Hệ thống sẽ kiểm tra đích đến thật trước khi bài được đăng.'
      : 'Link hợp lệ.',
  };
}

/**
 * Thuoc tinh bat buoc cho moi the <a> tro ra san thuong mai dien tu.
 *   - sponsored: cong bo day la link co the sinh hoa hong (thong le minh bach)
 *   - nofollow : khong truyen uy tin SEO sang san
 *   - noopener : chan trang dich truy cap window.opener cua minh
 *   - noreferrer: khong ro ri duong dan noi bo qua header Referer
 */
export const AFFILIATE_LINK_ATTRS = {
  target: '_blank',
  rel: 'sponsored nofollow noopener noreferrer',
} as const;
