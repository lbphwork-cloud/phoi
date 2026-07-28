'use client';

/**
 * Xem mot set do theo slug nam trong dia chi: /outfit/xem/?slug=...
 *
 * VI SAO PHAI CO TRANG NAY
 *   Website xuat ra dang tinh: moi set do co mot trang HTML DUNG SAN luc build.
 *   Hau qua ma chu website gap phai: bai vua tao xong bam vao la ra trang loi,
 *   vi luc build chua co bai do nen khong co file nao de phuc vu.
 *
 *   Do khong phai truong hop hiem — no dung voi MOI bai ma bat ky ai dang sau
 *   lan trien khai gan nhat. Mot website cho phep nguoi dung dang bai ma bai
 *   vua dang lai bao loi thi tinh nang dang bai coi nhu khong dung duoc.
 *
 * TRANG NAY LA DUONG DU PHONG, khong phai duong chinh.
 *   Trang loi 404 tu chuyen huong tori day khi dia chi co dang /outfit/<slug>.
 *   Nguoi dung khong bao gio phai go dia chi nay bang tay.
 *
 * DANH DOI, noi ro: trang nay khong co the meta rieng, nen gui link cho ban be
 * qua Zalo hay Facebook thi ban xem truoc hien thong tin chung cua website chu
 * khong hien ten bai. Sau lan dung lai web ke tiep, dia chi that
 * /outfit/<slug>/ se ton tai va co day du the meta.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import OutfitDetail from '../[slug]/detail';
import { EmptyState, Spinner } from '@/components/site';
import Link from 'next/link';

export default function XemTheoSlug() {
  return (
    <Suspense fallback={<div className="shell py-20"><Spinner /></div>}>
      <Noi />
    </Suspense>
  );
}

function Noi() {
  const slug = (useSearchParams().get('slug') ?? '').trim();

  if (!slug) {
    return (
      <div className="shell py-20">
        <EmptyState title="Thiếu địa chỉ bài viết">
          Địa chỉ này cần tham số slug.{' '}
          <Link href="/kham-pha" className="underline">Xem các outfit khác</Link>
        </EmptyState>
      </div>
    );
  }

  return <OutfitDetail slug={slug} />;
}
