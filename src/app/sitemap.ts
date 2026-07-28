/**
 * sitemap.xml — ban do cua website cho cong cu tim kiem.
 *
 * VI SAO CAN
 *   Trang chi tiet set do khong duoc lien ket tu moi noi: mot bai cu nam o
 *   trang thu ba cua danh sach thi con bot nao cung phai bam qua ba trang moi
 *   thay. Sitemap dua thang danh sach day du, mot lan.
 *
 * LAY DU LIEU LUC BUILD. Che do xuat tinh khong co may chu de sinh file nay
 * theo tung yeu cau — Next.js goi ham nay mot lan luc dung web va ghi ra mot
 * file tinh. Bai moi duyet se xuat hien o lan dung lai ke tiep, giong het cach
 * trang chi tiet cua no duoc dung san.
 *
 * KHONG LIET KE TRANG CAN DANG NHAP (/admin, /tao-bai, /ho-so, /gio-hang).
 * Chung khong co gi cho nguoi la doc, va dua vao chi lam bot di lang phi roi
 * bao "trang nay chan toi".
 */

import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

/** Dia chi that cua website. Doi ten mien thi sua o day. */
const GOC = 'https://phoi.pages.dev';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tinh: MetadataRoute.Sitemap = [
    { url: `${GOC}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${GOC}/kham-pha/`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${GOC}/gioi-thieu/`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return tinh;

  try {
    const sb = createClient(url, key);
    const { data } = await sb
      .from('outfits')
      .select('slug, published_at, created_at')
      .eq('status', 'published')
      .limit(2000);

    const bai = (data ?? []).map((r) => {
      const o = r as { slug: string; published_at: string | null; created_at: string };
      return {
        url: `${GOC}/outfit/${o.slug}/`,
        lastModified: new Date(o.published_at ?? o.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      };
    });

    return [...tinh, ...bai];
  } catch {
    // Khong doc duoc thi van co sitemap cho cac trang co dinh. Mot sitemap
    // thieu bai con hon mot lan build that bai.
    return tinh;
  }
}
