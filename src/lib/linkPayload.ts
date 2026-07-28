/**
 * Doc thong tin san pham NGAY TRONG chinh duong dan chia se.
 *
 * ===========================================================================
 * VI SAO CACH NAY TOT HON GOI MANG
 *
 * Duong dan "chia se" ma ung dung TikTok tao ra khong chi tro toi san pham —
 * no MANG THEO ten va anh san pham trong tham so `og_info`, duoi dang JSON da
 * ma hoa URL. TikTok nhet vao do de khi ban dan link len Messenger hay Zalo
 * thi cho do co san cai de hien, khong phai di tai trang ve.
 *
 * Cai do dung luon duoc:
 *
 *   1. KHONG GOI MANG MOT LAN NAO. Khong cho, khong that bai, khong ton han
 *      muc cua ham may chu.
 *   2. KHONG BI CHAN. TikTok chan may chu la rat gat — do chinh la ly do bac 1
 *      (doc the Open Graph) tra ve rong voi link TikTok. Du lieu nam san trong
 *      link thi khong co gi de chan.
 *   3. KHONG HONG KHI SAN DOI HTML. Bo doc HTML nao cung hong khi san doi giao
 *      dien. Tham so trong link la mot giao uoc on dinh hon nhieu.
 *
 * DIEU NAY KHONG THAY THE HAI BAC CU, no chen len TRUOC chung. Link khong co
 * `og_info` — vi du link rut gon vt.tiktok.com hay link go tay — thi van di
 * duong cu.
 *
 * KHONG CO GIA. `og_info` chi co ten va anh. Gia van phai lay tu hai bac sau
 * hoac nhap tay. Noi ro dieu do cho nguoi dung thay vi de ho tuong da xong.
 * ===========================================================================
 */

export interface LinkPayload {
  name: string | null;
  imageUrl: string | null;
  /** Cho biet du lieu lay tu dau, de giao dien noi dung su that voi nguoi dung. */
  source: 'tiktok-og_info' | 'shopee-og_info';
}

/**
 * Anh trong `og_info` la ban NHO — TikTok de san 260x260 cho o xem truoc khi
 * chia se. Dat lam anh san pham thi mo va vo net.
 *
 * Duong dan anh cua ByteDance co mot doan dieu khien kich thuoc ngay trong ten
 * tep: `~tplv-<ma>-resize-webp:260:260.webp`. Doi hai con so do la duoc anh to
 * hon tu chinh may chu cua ho — khong phai phong to mot anh nho, ma la yeu cau
 * mot ban khac.
 *
 * DA THU THAT bang mot link that truoc khi viet ham nay; xem
 * scripts/verify-link-payload.ts.
 *
 * Khong nhan dang duoc thi TRA VE NGUYEN BAN. Anh nho van hon khong co anh, va
 * mot duong dan tu che bien sai se thanh anh vo.
 */
export function upsizeByteDanceImage(url: string, size = 800): string {
  return url.replace(
    /(~tplv-[a-z0-9]+-resize-\w+):(\d+):(\d+)/i,
    (_m, prefix: string) => `${prefix}:${size}:${size}`,
  );
}

/** Giai ma JSON trong mot tham so, chiu duoc ca chuoi hong. */
function readJsonParam(params: URLSearchParams, key: string): Record<string, unknown> | null {
  const raw = params.get(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    // Tham so hong thi coi nhu khong co. Mot link van dung duoc qua hai bac sau.
    return null;
  }
}

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s === '' ? null : s;
};

/**
 * Doc thong tin san pham tu chinh duong dan. Tra ve null neu link khong mang
 * san du lieu nao — luc do nguoi goi di tiep hai bac cu.
 */
export function readPayloadFromUrl(url: string): LinkPayload | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();

  // --- TikTok ---------------------------------------------------------------
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const og = readJsonParam(u.searchParams, 'og_info');
    const name = str(og?.title);
    const image = str(og?.image);
    if (!name && !image) return null;
    return {
      name,
      imageUrl: image ? upsizeByteDanceImage(image) : null,
      source: 'tiktok-og_info',
    };
  }

  // --- Shopee ---------------------------------------------------------------
  // Link chia se cua Shopee dung ten tham so khac tuy tung ban ung dung, nen
  // thu lan luot may ten da thay thay vi doan mot cai.
  if (host === 'shopee.vn' || host.endsWith('.shopee.vn')) {
    for (const key of ['og_info', 'share_info', 'product_info']) {
      const og = readJsonParam(u.searchParams, key);
      const name = str(og?.title) ?? str(og?.name);
      const image = str(og?.image) ?? str(og?.image_url);
      if (name || image) {
        return { name, imageUrl: image, source: 'shopee-og_info' };
      }
    }
  }

  return null;
}
