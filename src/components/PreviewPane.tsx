'use client';

/**
 * Khung xem truoc bam theo man hinh khi cuon.
 *
 * VI SAO DINH MAN HINH
 *   Ban xem truoc cu nam tren cung. Sua mot o o giua trang la phai cuon nguoc
 *   len xem, roi cuon xuong sua tiep — moi lan doi mot chu la mot vong cuon.
 *   Dinh man hinh thi no luon nam canh o dang sua.
 *
 * KHUNG MAY TINH / DIEN THOAI
 *   Da tach noi dung hai ban thi phai xem duoc ca hai, neu khong nguoi sua ban
 *   dien thoai van dang nhin khung may tinh. Nut chuyen o day chi doi BE NGANG
 *   cua khung xem truoc — noi dung ben trong tu doi theo, dung nhu trang that.
 *
 * CHI DINH TU MAN HINH RONG TRO LEN
 *   Duoi 1024px khong du cho cho hai cot. O do khung xem truoc tro ve dang mot
 *   khoi thuong nam tren cung, va do la hanh vi dung: mot khung dinh man hinh
 *   tren dien thoai se an mat chinh cai o dang go.
 */

import { useState } from 'react';

export type PreviewWidth = 'pc' | 'mobile';

/** Be ngang khung xem truoc. 390px la be ngang cua phan lon dien thoai dang dung. */
export const PREVIEW_WIDTH: Record<PreviewWidth, string> = {
  pc: '100%',
  mobile: '390px',
};

export function PreviewPane({
  title = 'Xem trước',
  note,
  width,
  onWidthChange,
  children,
}: {
  title?: string;
  note?: string;
  width: PreviewWidth;
  onWidthChange: (w: PreviewWidth) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:sticky lg:top-24">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">{title}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="chip"
            aria-pressed={width === 'pc'}
            onClick={() => onWidthChange('pc')}
          >
            Máy tính
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={width === 'mobile'}
            onClick={() => onWidthChange('mobile')}
          >
            Điện thoại
          </button>
        </div>
      </div>

      <div
        className="mx-auto overflow-hidden border"
        style={{
          borderColor: 'var(--line)',
          width: PREVIEW_WIDTH[width],
          maxWidth: '100%',
          // Khung dien thoai co vien day hon mot chut de nhin ra la mot thiet bi
          // chu khong phai mot khoi noi dung bi bop hep.
          borderWidth: width === 'mobile' ? '6px' : '1px',
          borderRadius: width === 'mobile' ? '18px' : '0',
        }}
      >
        {children}
      </div>

      {note && <p className="hint mt-3">{note}</p>}
    </div>
  );
}

/** Trang thai be ngang, tach ra de nhieu trang dung chung cach nho. */
export function usePreviewWidth(initial: PreviewWidth = 'pc') {
  return useState<PreviewWidth>(initial);
}
