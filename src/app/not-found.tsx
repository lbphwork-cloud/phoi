'use client';

/**
 * Trang khong tim thay — VA la duong cuu cho cac set do dang sau lan build.
 *
 * BOI CANH
 *   Ban xuat tinh dung san mot file HTML cho tung set do CO LUC BUILD. Bai dang
 *   sau do khong co file nao, nen Cloudflare Pages tra ve 404.html — chinh la
 *   trang nay. Chu website gap dung canh do: tao bai xong, bam vao, ra trang
 *   loi.
 *
 * NEN TRANG NAY LAM MOT VIEC TRUOC KHI BAO LOI
 *   Neu dia chi co dang /outfit/<slug> thi day gan nhu chac chan la mot bai co
 *   that vua duoc dang. Chuyen sang /outfit/xem/?slug=<slug> — trang do tu hoi
 *   database va hien bai binh thuong.
 *
 *   `replace` chu khong phai `push`: nguoi dung bam Quay lai thi ve trang truoc
 *   do, khong quay nguoc vao chinh trang loi nay.
 *
 * VI SAO KHONG DUNG _redirects CUA CLOUDFLARE
 *   Mot quy tac viet lai /outfit/* se de len ca 100 trang da dung san, va lam
 *   mat the meta rieng cua chung — thu chi co o ban dung san. Cach nay chi chay
 *   khi file that KHONG ton tai, nen no khong dung gi tori cac trang da co.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState, Spinner } from '@/components/site';

export default function NotFound() {
  const [dangChuyen, setDangChuyen] = useState(false);

  useEffect(() => {
    const m = window.location.pathname.match(/^\/outfit\/([^/]+)\/?$/);
    // '_khong-co-du-lieu' la slug giu cho luc build khong doc duoc database;
    // no khong ung voi bai nao nen khong can thu tai.
    if (!m || m[1] === 'xem' || m[1] === '_khong-co-du-lieu') return;

    setDangChuyen(true);
    window.location.replace(`/outfit/xem/?slug=${encodeURIComponent(m[1])}`);
  }, []);

  if (dangChuyen) {
    return <div className="shell py-20"><Spinner label="Đang mở bài viết" /></div>;
  }

  return (
    <div className="shell py-20">
      <EmptyState title="Không tìm thấy trang này">
        Đường dẫn có thể đã đổi hoặc bài đã bị gỡ.{' '}
        <Link href="/kham-pha" className="underline">Khám phá bộ sưu tập</Link>
      </EmptyState>
    </div>
  );
}
