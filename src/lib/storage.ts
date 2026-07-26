'use client';

/**
 * Upload anh len Supabase Storage.
 *
 * Gom vao mot cho vi truoc day logic nay bi lap o hai noi (OutfitEditor va
 * trang admin san pham), va vi no chua mot quy uoc de sai: duong dan PHAI bat
 * dau bang user id.
 *
 * Policy trong 0004_storage.sql chi cho phep ghi khi
 *     (storage.foldername(name))[1] = auth.uid()::text
 * nghia la thu muc dau tien cua duong dan phai la user id cua chinh nguoi ghi.
 * Dat sai thu muc thi database tu choi, va thong bao loi cua Supabase khong noi
 * ro nguyen nhan — rat mat thoi gian de tim ra.
 *
 * Doi sang Cloudflare R2 sau nay: chi phai sua DUY NHAT file nay. Do la ly do
 * tach ra thanh mot lop rieng thay vi goi truc tiep sb.storage o moi noi.
 */

import { getSupabase } from './supabase/client';
import { IMAGE_LIMITS, validateImageFile } from './format';

export type Bucket = 'outfit-images' | 'product-images' | 'avatars';

const LIMIT_OF: Record<Bucket, number> = {
  'outfit-images': IMAGE_LIMITS.outfit,
  'product-images': IMAGE_LIMITS.product,
  avatars: IMAGE_LIMITS.avatar,
};

/**
 * Sinh duong dan luu file.
 *
 * Ham thuan tuy o cap module (khong nam trong component) la co y: no goi
 * Date.now() va Math.random(), hai ham "khong thuan". Neu de trong than mot
 * component thi bo lint cua React 19 se bao loi — va bao dung, vi goi ham
 * khong thuan trong luc render lam ket qua thay doi giua cac lan render.
 */
export function storagePath(userId: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/${stamp}-${rand}.${ext}`;
}

export interface UploadResult {
  ok: boolean;
  url: string | null;
  message: string;
}

/**
 * Kiem tra roi upload. Tra ve dia chi cong khai cua anh.
 *
 * Kiem tra dinh dang va dung luong o day chi de bao loi som va de chiu. Gioi
 * han THAT nam o cap bucket (file_size_limit + allowed_mime_types trong
 * 0004_storage.sql) — nen nguoi dung khong the vuot qua bang cach goi thang API.
 */
export async function uploadImage(
  bucket: Bucket,
  userId: string,
  file: File,
): Promise<UploadResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, url: null, message: 'Chưa cấu hình Supabase.' };

  const v = validateImageFile(file, LIMIT_OF[bucket]);
  if (!v.ok) return { ok: false, url: null, message: v.message };

  const path = storagePath(userId, file.name);

  const { error } = await sb.storage.from(bucket).upload(path, file, {
    // Anh khong bao gio doi noi dung o cung duong dan (ten file co dau thoi
    // gian), nen cache mot nam la an toan va tiet kiem bang thong.
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    return {
      ok: false,
      url: null,
      message:
        error.message.includes('exceeded the maximum allowed size')
          ? `Ảnh vượt giới hạn của bucket ${bucket}.`
          : error.message.includes('mime type')
            ? 'Định dạng ảnh không được bucket cho phép.'
            : `Không upload được ảnh: ${error.message}`,
    };
  }

  return {
    ok: true,
    url: sb.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    message: 'Đã tải ảnh lên.',
  };
}
