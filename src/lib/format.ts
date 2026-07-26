/** Cac ham dinh dang dung chung. Tat ca theo quy uoc Viet Nam. */

/** 189000 -> "189.000đ" */
export function formatVnd(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'Chưa có giá';
  return new Intl.NumberFormat('vi-VN').format(v) + 'đ';
}

/** 1134000 -> "1,1 triệu" — dung cho nhan gon tren the outfit */
export function formatVndShort(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m.toFixed(m < 10 ? 1 : 0).replace('.', ',')} triệu`;
  }
  return `${Math.round(v / 1000)}k`;
}

/** "2026-07-26T10:00:00Z" -> "26/07/2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

/** Khoang thoi gian tuong doi: "3 ngày trước" */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';

  const diffSec = Math.round((Date.now() - then) / 1000);
  const units: Array<[number, string]> = [
    [60, 'giây'], [3600, 'phút'], [86400, 'giờ'],
    [86400 * 30, 'ngày'], [86400 * 365, 'tháng'],
  ];

  if (diffSec < 60) return 'vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} ngày trước`;
  if (diffSec < 86400 * 365) return `${Math.floor(diffSec / (86400 * 30))} tháng trước`;
  void units;
  return `${Math.floor(diffSec / (86400 * 365))} năm trước`;
}

/**
 * Gia lay tu link san pham cu di rat nhanh (khong co API de dong bo).
 * Ham nay tao cau canh bao ve do tuoi cua gia.
 */
export function priceFreshnessNote(checkedAt: string | null | undefined): string {
  if (!checkedAt) return 'Chưa rõ thời điểm kiểm tra giá';
  const days = Math.floor((Date.now() - Date.parse(checkedAt)) / 86400000);
  if (Number.isNaN(days)) return 'Chưa rõ thời điểm kiểm tra giá';
  if (days <= 1) return 'Giá kiểm tra hôm nay';
  if (days <= 7) return `Giá kiểm tra ${days} ngày trước`;
  if (days <= 30) return `Giá kiểm tra ${days} ngày trước — có thể đã thay đổi`;
  return 'Giá đã cũ hơn một tháng — vui lòng kiểm tra lại trên sàn';
}

/** Bo dau tieng Viet va tao slug. Khop voi ham slugify_vi() trong SQL. */
export function slugifyVi(input: string): string {
  const from = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
  const to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

  let s = (input ?? '').toLowerCase();
  s = [...s].map((ch) => {
    const i = from.indexOf(ch);
    return i >= 0 ? to[i] : ch;
  }).join('');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'outfit';
}

/** Kiem tra file anh truoc khi upload. Gioi han that nam o cap bucket Supabase. */
export function validateImageFile(
  file: File,
  maxBytes: number,
): { ok: boolean; message: string } {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  if (!allowed.includes(file.type)) {
    return {
      ok: false,
      message: `Chỉ nhận ảnh JPG, PNG, WebP hoặc AVIF. File của bạn là ${file.type || 'không rõ định dạng'}.`,
    };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `Ảnh ${(file.size / 1048576).toFixed(1)} MB, vượt giới hạn ${(maxBytes / 1048576).toFixed(0)} MB.`,
    };
  }
  return { ok: true, message: 'Ảnh hợp lệ.' };
}

export const IMAGE_LIMITS = {
  outfit: 5 * 1024 * 1024,
  product: 2 * 1024 * 1024,
  avatar: 1 * 1024 * 1024,
} as const;
