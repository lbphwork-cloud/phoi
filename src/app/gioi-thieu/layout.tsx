import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Tieu de va mo ta rieng cho trang gioi thieu, doc luc DUNG TRANG.
 *
 * VI SAO PHAI CO LOP NAY
 *   Trang gioi thieu la mot component chay o trinh duyet ('use client'), ma
 *   component nhu vay khong khai bao duoc metadata. Khong co lop nay thi tab
 *   trinh duyet va ket qua tim kiem Google deu hien tieu de chung cua ca
 *   website — dung o trang duy nhat co nhiem vu tra loi "trang nay la gi".
 *
 *   Dung supabase-js chu khong dung fetch(): fetch() co `cache: 'no-store'` se
 *   bien trang thanh trang dong, dieu bi cam trong che do xuat tinh. Da mac
 *   dung loi do mot lan — xem chu thich trong src/app/layout.tsx.
 */
const FALLBACK_TITLE = 'PHỐI là gì';

export async function generateMetadata(): Promise<Metadata> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { title: FALLBACK_TITLE };

  try {
    const sb = createClient(url, key);
    const { data } = await sb
      .from('site_content')
      .select('key, value')
      .in('key', ['about.heading', 'about.body']);

    const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value?.trim() ?? '';

    // Doan dau tien cua noi dung lam mo ta — do dung la cau tra loi ngan nhat
    // cho cau hoi ma nguoi tim kiem dang go.
    const firstParagraph = get('about.body').split(/\n\s*\n/)[0]?.trim() ?? '';

    return {
      title: get('about.heading') || FALLBACK_TITLE,
      ...(firstParagraph ? { description: firstParagraph.slice(0, 300) } : {}),
    };
  } catch {
    return { title: FALLBACK_TITLE };
  }
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
