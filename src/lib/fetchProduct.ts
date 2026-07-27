'use client';

/**
 * Lay thong tin san pham tu mot link, theo chuoi BA BAC tu dong roi xuong.
 *
 *   Bac 1 — Edge Function tren cloud doc the Open Graph.
 *           Nhanh (duoi 2 giay). Shopee co server-side rendering va tu phat the
 *           og:title / og:image / og:description cho bot mang xa hoi — day la
 *           co che khien dan link Shopee vao Zalo thi hien ra anh va ten. Doc
 *           metadata nay khong phai cao du lieu: no la thong tin san chu dong
 *           cong bo de duoc chia se.
 *           NHUNG: Edge Function chay tu trung tam du lieu, ma Shopee chan IP
 *           trung tam du lieu rat gat. Nen bac nay co the that bai.
 *
 *   Bac 2 — Local Helper tren may ca nhan.
 *           Website chi GHI mot dong vao bang fetch_jobs. May ca nhan tu poll
 *           va tu quyet dinh lam. Mo link bang trinh duyet that tren IP nha
 *           mang that, ty le thanh cong cao hon nhieu. Neu gap CAPTCHA thi
 *           cua so hien ra va NGUOI THAT tu bam — day khong phai vuot rao.
 *
 *   Bac 3 — Nhap tay.
 *           Luon co san. Khong phai duong lui tam bo: bai cua nguoi dung
 *           thuong se dung bac nay la chinh, vi khong co tai khoan affiliate
 *           thi khong co API nao ca.
 */

import { getSupabase } from './supabase/client';
import { checkAffiliateUrl } from './affiliate';
import type { FetchJobResult, Platform } from './supabase/types';

export type FetchTier = 1 | 2 | 3;

export interface FetchOutcome {
  ok: boolean;
  tier: FetchTier;
  data: FetchJobResult | null;
  /** Cau giai thich cho nguoi dung, luon co */
  message: string;
}

/** Bac 1: goi Edge Function doc the Open Graph. */
async function tryEdgeFunction(url: string): Promise<FetchOutcome> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, tier: 1, data: null, message: 'Chưa cấu hình Supabase.' };
  }

  try {
    const { data, error } = await sb.functions.invoke('fetch-product', {
      body: { url },
    });

    if (error) {
      return {
        ok: false, tier: 1, data: null,
        message:
          'Bậc 1 không lấy được (thường vì sàn chặn IP trung tâm dữ liệu). ' +
          'Chuyển sang Local Helper trên máy bạn.',
      };
    }

    const r = data as { ok: boolean; result?: FetchJobResult; error?: string };
    if (!r?.ok || !r.result?.name) {
      return {
        ok: false, tier: 1, data: null,
        message: r?.error ?? 'Bậc 1 không đọc được thông tin từ link.',
      };
    }

    return {
      ok: true, tier: 1, data: r.result,
      message: 'Lấy được từ thẻ Open Graph của sàn.',
    };
  } catch {
    return {
      ok: false, tier: 1, data: null,
      message: 'Chưa triển khai Edge Function fetch-product, hoặc gọi thất bại.',
    };
  }
}

/**
 * Bac 2: tao job cho Local Helper roi cho ket qua.
 *
 * Website KHONG goi vao may ca nhan. No chi ghi mot dong vao bang. May ca nhan
 * chu dong hoi. Neu Local Helper khong chay thi job nam cho, va ham nay het
 * thoi gian roi bao nguoi dung nhap tay.
 */
async function tryLocalHelper(
  url: string,
  userId: string,
  timeoutMs = 45_000,
  onTick?: (secondsLeft: number) => void,
): Promise<FetchOutcome> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, tier: 2, data: null, message: 'Chưa cấu hình Supabase.' };
  }

  const { data: job, error } = await sb
    .from('fetch_jobs')
    .insert({ requested_by: userId, source_url: url, tier: 2 })
    .select('id')
    .single();

  if (error || !job) {
    return {
      ok: false, tier: 2, data: null,
      message: `Không tạo được yêu cầu: ${error?.message ?? 'lỗi không rõ'}`,
    };
  }

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    onTick?.(Math.ceil((timeoutMs - (Date.now() - started)) / 1000));

    const { data: row } = await sb
      .from('fetch_jobs')
      .select('status, result, error')
      .eq('id', job.id)
      .maybeSingle();

    if (!row) continue;

    if (row.status === 'done') {
      return {
        ok: true, tier: 2,
        data: row.result as FetchJobResult,
        message: 'Local Helper trên máy bạn đã lấy được thông tin.',
      };
    }
    if (row.status === 'failed') {
      return {
        ok: false, tier: 2, data: null,
        message: `Local Helper không lấy được: ${row.error ?? 'không rõ lý do'}`,
      };
    }
  }

  // Het thoi gian cho. Danh dau job de khong bi treo mai.
  await sb.from('fetch_jobs').update({ status: 'cancelled' }).eq('id', job.id);

  return {
    ok: false, tier: 2, data: null,
    message:
      'Local Helper không phản hồi trong 45 giây. Có thể nó chưa chạy trên máy bạn ' +
      '(xem local-helper/README.md), hoặc trang sản phẩm đang hỏi CAPTCHA. ' +
      'Bạn nhập tay bên dưới nhé.',
  };
}

/**
 * Chay ca chuoi ba bac. Tra ve ket qua kem bac da dung, de giao dien noi ro
 * cho nguoi dung du lieu tori tu dau.
 */
export async function fetchProductFromUrl(
  url: string,
  userId: string | null,
  opts: { onProgress?: (msg: string) => void; skipTier1?: boolean } = {},
): Promise<FetchOutcome> {
  const { onProgress } = opts;

  // Kiem tra ten mien TRUOC khi goi mang. Khong gui yeu cau ra ngoai voi mot
  // link khong thuoc Shopee/TikTok.
  const linkCheck = checkAffiliateUrl(url);
  if (!linkCheck.ok) {
    return { ok: false, tier: 3, data: null, message: linkCheck.message };
  }

  if (!opts.skipTier1) {
    onProgress?.('Bậc 1: đang đọc thẻ Open Graph từ sàn…');
    const t1 = await tryEdgeFunction(url);
    if (t1.ok) return t1;
    onProgress?.(t1.message);
  }

  if (!userId) {
    return {
      ok: false, tier: 3, data: null,
      message: 'Cần đăng nhập để dùng Local Helper. Bạn nhập tay bên dưới nhé.',
    };
  }

  onProgress?.('Bậc 2: đã gửi yêu cầu tới Local Helper trên máy bạn, đang chờ…');
  const t2 = await tryLocalHelper(url, userId, 45_000, (s) =>
    onProgress?.(`Bậc 2: đang chờ Local Helper… còn ${s} giây`),
  );
  if (t2.ok) return t2;

  return { ...t2, tier: 3, message: t2.message };
}

/** Doan danh muc san pham tu ten, de dien san o chon cho nguoi dung. */
export function guessCategory(name: string): string {
  const n = name.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/áo|ao |shirt|tee|polo|hoodie|sweat|jacket|khoác|cardigan|somi|sơ mi/, 'ao'],
    [/quần|quan |pants|jean|chino|short|jogger|âu|tây/, 'quan'],
    [/giày|giay|sneaker|shoe|sandal|loafer|derby|boot|slip/, 'giay'],
    [/túi|tui |balo|backpack|bag|tote/, 'tui'],
    [/đồng hồ|dong ho|watch/, 'dong_ho'],
    [/kính|kinh |glasses|sunglass/, 'kinh'],
    [/mũ|mu |cap|hat|bucket|nón/, 'mu'],
  ];
  for (const [re, cat] of rules) if (re.test(n)) return cat;
  return 'phu_kien';
}

/** Doan vai tro trong set do tu danh muc. */
export function roleFromCategory(cat: string): string {
  const map: Record<string, string> = {
    ao: 'top', quan: 'bottom', giay: 'shoes', tui: 'bag',
    dong_ho: 'watch', kinh: 'glasses', mu: 'hat', phu_kien: 'accessory',
  };
  return map[cat] ?? 'accessory';
}

/** Doan nen tang tu link, de dien san. */
export function platformFromUrl(url: string): Platform | null {
  return checkAffiliateUrl(url).platform;
}

/**
 * Doan mau san pham tu ten.
 *
 * Nguoi ban tren Shopee gan nhu luon ghi mau trong ten san pham ("Ao thun nam
 * mau den", "Quan chinos be"), nen day la nguon du lieu san co ma truoc gio bo
 * khong. Doan duoc thi do cho nguoi dang mot lan chon.
 *
 * CO Y TRA VE null KHI KHONG CHAC. Dien sai mau con te hon de trong: mau la
 * dau vao cua ca bo loc lan goi y theo menh, nen mot mau sai lam lech ket qua
 * cua nguoi dung ma ho khong biet vi sao.
 *
 * Danh sach bam theo cot `slug` cua bang colors.
 */
const COLOR_HINTS: Array<[RegExp, string]> = [
  [/\btrắng\b|\btrang\b|\bwhite\b/i, 'trang'],
  [/\bđen\b|\bden\b|\bblack\b/i, 'den'],
  [/\bxám\b|\bxam\b|\bghi\b|\bgrey\b|\bgray\b/i, 'xam-nhat'],
  [/\bkem\b|\bcream\b|\boff.?white\b/i, 'kem'],
  [/\bbe\b|\bbeige\b/i, 'be'],
  [/\bnavy\b|xanh\s*navy|xanh\s*than/i, 'navy'],
  [/\bolive\b|\brêu\b|\breu\b/i, 'olive'],
  [/\bnâu\b|\bnau\b|\bbrown\b/i, 'nau-nhat'],
  [/xanh\s*dương|xanh\s*duong|\bblue\b/i, 'xanh-duong'],
  [/xanh\s*lá|xanh\s*la|\bgreen\b/i, 'xanh-la'],
  [/\bđỏ\b|\bdo\b|\bred\b/i, 'do'],
  [/\bvàng\b|\bvang\b|\byellow\b/i, 'vang'],
];

export function guessColorSlug(name: string): string | null {
  for (const [re, slug] of COLOR_HINTS) if (re.test(name)) return slug;
  return null;
}
