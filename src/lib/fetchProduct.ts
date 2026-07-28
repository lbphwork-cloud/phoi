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
import { guessColorSlugs } from './guessColor';
import { readPayloadFromUrl } from './linkPayload';

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

    /*
      NOI RO KHI KHONG CO GIA, thay vi de o gia trong va im lang.

      Da do tren link that cua chu website: HTML ma Shopee tra ve cho bot xem
      truoc link KHONG HE CHUA GIA — o do chi co ten, mot anh, va mot cau
      quang cao chung ("... gia tot. Mua hang qua mang uy tin..."). API san
      pham cua Shopee thi tra 403 voi may chu.

      Nghia la duong doc nhanh KHONG BAO GIO lay duoc gia Shopee, du sua cach
      doc the nao. Khong noi ra thi nguoi dung se bam di bam lai va tuong may
      hong — chu website da bao "gia khong duoc lay" dung nhu vay.
    */
    const co = r.result;
    const thieu: string[] = [];
    if (!co.price_vnd) thieu.push('giá');
    if (!co.image_urls?.length && !co.image_url) thieu.push('ảnh');

    return {
      ok: true, tier: 1, data: co,
      message: thieu.length === 0
        ? `Lấy được tên, giá và ${co.image_urls?.length ?? 1} ảnh từ sàn.`
        : `Lấy được tên${co.image_urls?.length ? ` và ${co.image_urls.length} ảnh` : ''}. `
          + `Sàn không công bố ${thieu.join(' và ')} cho đường đọc nhanh — `
          + 'nhập tay, hoặc chạy Local Helper trên máy để đọc bằng trình duyệt thật.',
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

  /*
    BAC 0 — DOC NGAY TRONG CHINH DUONG DAN, KHONG GOI MANG.

    Duong dan chia se cua TikTok mang san ten va anh san pham trong tham so
    `og_info`. Doc thang tu do thi khong cho, khong bi chan, va khong hong khi
    san doi HTML.

    DAY LA DUONG DUY NHAT HOAT DONG VOI TIKTOK. Bac 1 goi tu may chu Supabase,
    ma TikTok chan may chu la rat gat — nen bac 1 gan nhu luon tra ve rong voi
    link TikTok. Chu website bao "link tiktok chua lay duoc thong tin", va do
    la mo ta dung.

    KHONG CO GIA trong `og_info`. Neu chi lay duoc ten va anh thi VAN di tiep
    bac 1 de tim gia — nhung phan da lay duoc thi giu lai, khong vut di.
  */
  const trongLink = readPayloadFromUrl(url);
  if (trongLink && (trongLink.name || trongLink.imageUrl)) {
    onProgress?.('Đọc được tên và ảnh ngay trong đường dẫn, không cần gọi sàn.');
    return {
      ok: true,
      tier: 1,
      data: {
        name: trongLink.name ?? '',
        price_vnd: null,
        image_url: trongLink.imageUrl,
        platform: linkCheck.platform,
      },
      message:
        'Lấy được tên và ảnh ngay trong đường dẫn chia sẻ. ' +
        'Đường dẫn không mang theo giá — bạn nhập giá bằng tay nhé.',
    };
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

/*
  Doan loai hang va vai tro da chuyen sang src/lib/guessCategory.ts — tach ra
  de bo kiem chung chay duoc ma khong keo theo thu vien Supabase. Van xuat lai
  o day cho cac cho dang goi.
*/
export { guessCategory, roleFromCategory } from './guessCategory';

/** Doan nen tang tu link, de dien san. */
export function platformFromUrl(url: string): Platform | null {
  return checkAffiliateUrl(url).platform;
}

/**
 * Doan mau san pham tu ten.
 *
 * RUOT DA CHUYEN SANG src/lib/guessColor.ts. Ban cu o day la mot danh sach 12
 * bieu thuc, va no co ba loi that:
 *
 *   1. "nau" tra ve 'nau-nhat'. Mot cai quan nau dam bi ghi thanh nau nhat.
 *   2. Moi sac xam deu ve 'xam-nhat'; khong co duong nao ra 'xam-dam'.
 *   3. Thieu han cam, hong, tim — ba trong 17 mau khong bao gio doan duoc.
 *
 * Ban moi xet tu khoa DAI truoc va xoa doan da khop di, nen "nau nhat" khong
 * con bi "nau" nuot. Co bo kiem chung rieng chay trong `npm run verify:lib`.
 *
 * VAN TRA VE null KHI KHONG CHAC. Dien sai mau con te hon de trong: mau la dau
 * vao cua ca bo loc lan goi y theo menh, nen mot mau sai lam lech ket qua cua
 * nguoi dung ma ho khong biet vi sao.
 */
export function guessColorSlug(name: string): string | null {
  return guessColorSlugs(name)[0] ?? null;
}
