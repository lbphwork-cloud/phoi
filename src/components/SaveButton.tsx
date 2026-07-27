'use client';

/**
 * Nut luu mot set do vao gio.
 *
 * MOI NUT TU DOC TRANG THAI GIO
 *   Nhin qua thi lang phi — mot trang kham pha co 60 the outfit se goi
 *   useSaved() 60 lan. Nhung useAsyncData gom theo KHOA, va moi nut dung chung
 *   mot khoa, nen chi co mot luot goi mang. Doi lai, cho goi khong phai luon
 *   trang thai gio xuong qua nam lop component.
 *
 * KHACH CHUA DANG NHAP VAN THAY NUT
 *   An nut di thi ho khong biet tinh nang nay ton tai. Bam vao thi hien loi
 *   moi dang nhap kem duong dan — do la luc ho co ly do that de dang ky.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks';
import { useSaved, SAVED_LIMIT } from '@/lib/saved';

export function SaveButton({
  outfitId,
  className = '',
  /** Nut day du co chu, hop trong trang chi tiet. Nut gon chi co bieu tuong. */
  full = false,
}: {
  outfitId: string;
  className?: string;
  full?: boolean;
}) {
  const { session } = useAuth();
  const saved = useSaved();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inCart = saved.ids.has(outfitId);

  const click = async (e: React.MouseEvent) => {
    // Nut nay thuong nam trong mot the <Link> boc ca the outfit. Khong chan thi
    // bam luu se dieu huong sang trang chi tiet.
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      setMsg('Cần đăng nhập để lưu set đồ.');
      return;
    }

    setBusy(true);
    const r = await saved.toggle(outfitId);
    setBusy(false);
    setMsg(r.ok ? null : r.message);
  };

  return (
    <>
      <button
        type="button"
        onClick={click}
        disabled={busy}
        aria-pressed={inCart}
        title={inCart ? 'Bỏ khỏi giỏ' : 'Lưu vào giỏ để mua sau'}
        className={full ? `btn ${inCart ? 'btn-solid' : ''} ${className}` : `btn-save ${className}`}
      >
        {full ? (
          <>{inCart ? 'Đã có trong giỏ' : 'Lưu vào giỏ'}</>
        ) : (
          <span aria-hidden="true">{busy ? '…' : inCart ? '✓' : '+'}</span>
        )}
        {!full && <span className="sr-only">{inCart ? 'Bỏ khỏi giỏ' : 'Lưu vào giỏ'}</span>}
      </button>

      {msg && (
        <p className="hint-error">
          {msg}{' '}
          {!session ? (
            <Link href="/dang-nhap" className="underline">Đăng nhập</Link>
          ) : (
            saved.full && (
              <>
                Giỏ đang có đủ {SAVED_LIMIT} set.{' '}
                <Link href="/gio-hang" className="underline">Xem giỏ để bỏ bớt</Link>
              </>
            )
          )}
        </p>
      )}
    </>
  );
}
