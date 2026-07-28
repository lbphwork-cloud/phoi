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
/*
  =============================================================================
  NEN ANH NGAY TRONG TRINH DUYET TRUOC KHI TAI LEN

  VAN DE
    Anh chup tu dien thoai bay gio nang 4-8MB va rong 4000px. Nguoi xem tren
    dien thoai tai ve nguyen tam do de hien trong mot khung rong 400px — cham,
    ton dung luong 3G cua ho, va ton dung luong luu tru cua website.

  LAM O DAU
    Trong trinh duyet, TRUOC khi gui. Lam o may chu thi anh nang van phai di
    het duong mang mot lan roi moi duoc nen — tuc la khong tiet kiem duoc gi
    cho nguoi tai len.

  CON SO
    Canh dai toi da 1600px: du net cho khung anh lon nhat tren man hinh may
    tinh (khoang 800px o do phan giai gap doi), va van du de phong to xem chi
    tiet vai.

    Chat luong 0.88 voi WebP: o muc nay mat thuong khong phan biet duoc voi
    ban goc tren anh quan ao — vung chuyen mau muot, khong thay o vuong. Ha
    xuong 0.7 thi bat dau thay vien ram o nhung mang mau phang nhu nen trang.

  KHONG NEN KHI ANH DA NHO. Nen lai mot tam anh 200KB chi lam no xau di ma
  khong tiet kiem duoc bao nhieu — moi lan nen lai la mot lan mat chi tiet.

  KHONG NEN ANH PNG TRONG SUOT. Chuyen sang WebP van giu duoc trong suot,
  nhung logo va anh tach nen thi nguoi dung tai len co y muon giu nguyen.
  =============================================================================
*/
const CANH_TOI_DA = 1600;
const CHAT_LUONG = 0.88;
/** Duoi nguong nay thi khong nen — xem chu thich tren. */
const KHONG_NEN_DUOI = 400 * 1024;

async function nenAnh(file: File): Promise<File> {
  if (file.size <= KHONG_NEN_DUOI) return file;
  if (file.type === 'image/png') return file;
  if (typeof createImageBitmap !== 'function') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const tyLe = Math.min(1, CANH_TOI_DA / Math.max(bitmap.width, bitmap.height));

    // Anh da nho hon canh toi da va van nang: van nen lai (giam chat luong),
    // nhung khong phong to. Phong to mot tam anh khong bao gio lam no dep hon.
    const w = Math.round(bitmap.width * tyLe);
    const h = Math.round(bitmap.height * tyLe);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/webp', CHAT_LUONG),
    );
    if (!blob) return file;

    // Neu ban nen KHONG nho hon ban goc thi giu ban goc. Chuyen doi luon co
    // truong hop lam file phinh ra — anh da nen ky tu truoc chang han.
    if (blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    // Trinh duyet khong lam duoc thi tai len ban goc. Mot buc anh nang van hon
    // mot thong bao loi.
    return file;
  }
}

export async function uploadImage(
  bucket: Bucket,
  userId: string,
  goc: File,
): Promise<UploadResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, url: null, message: 'Chưa cấu hình Supabase.' };

  /*
    KIEM TRA BAN GOC TRUOC KHI NEN.

    Nen truoc roi moi kiem thi mot tep 50MB sai dinh dang van duoc doc vao bo
    nho de nen — va do la cach lam trinh duyet dung hinh. Kiem tra la thu re,
    phai lam truoc.
  */
  const v = validateImageFile(goc, LIMIT_OF[bucket]);
  if (!v.ok) return { ok: false, url: null, message: v.message };

  const file = await nenAnh(goc);
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
