'use client';

/**
 * Nut chon anh, nhin ra nut.
 *
 * VI SAO KHONG DUNG <input type="file"> TRAN
 *   O nhap file mac dinh cua trinh duyet hien ra la mot nut xam nho xiu kem
 *   dong chu "No file chosen" — no khong giong bat ky nut nao khac tren trang,
 *   va tren dien thoai thi vung bam nho tori muc bam truot. Nguoi dung nhin vao
 *   khong doan duoc do la cho tai anh len.
 *
 *   O day o nhap that duoc AN DI va boc trong mot <label>. Bam vao label la
 *   trinh duyet mo hop chon file y het — khong can JavaScript, khong mat kha
 *   nang dung ban phim, khong mat trinh doc man hinh. Chi doi cai vo.
 *
 * VAN GIU <input> THAT thay vi dung ref + click() bang JavaScript: cach do bo
 * mat lien ket nhan-o-nhap ma trinh doc man hinh dua vao, va mot so trinh duyet
 * chan click() khi khong phai do nguoi dung truc tiep bam.
 */

import { useId } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

export function UploadButton({
  onPick,
  label = 'Chọn ảnh từ máy',
  busy = false,
  busyLabel = 'Đang tải lên…',
  disabled = false,
  hint,
  maxBytes,
  className = '',
}: {
  onPick: (file: File) => void;
  label?: string;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  /** Ghi chu nho duoi nut. De trong thi tu viet cau ve dinh dang va dung luong. */
  hint?: string;
  /** Gioi han dung luong, tinh bang byte. Lay tu IMAGE_LIMITS cua ben goi. */
  maxBytes?: number;
  className?: string;
}) {
  const id = useId();
  const off = disabled || busy;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={`btn btn-sm ${off ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
      >
        {busy ? busyLabel : label}
      </label>
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        disabled={off}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          // Xoa gia tri de chon LAI CUNG MOT FILE van kich hoat onChange. Khong
          // xoa thi nguoi dung sua anh roi chon lai dung file do se khong thay
          // gi xay ra.
          e.target.value = '';
        }}
      />
      <p className="hint">
        {hint ??
          `JPG, PNG, WebP hoặc AVIF${
            maxBytes ? `. Tối đa ${Math.round(maxBytes / (1024 * 1024))} MB` : ''
          }.`}
      </p>
    </div>
  );
}
