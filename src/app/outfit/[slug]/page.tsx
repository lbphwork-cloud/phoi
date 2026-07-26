/**
 * Trang chi tiet outfit.
 *
 * Vo trang la Server Component chi de co generateStaticParams — noi dung do
 * Client Component tai. Ly do cho cach tach nay:
 *
 *   - generateStaticParams cho phep dung san MOT trang tinh cho tung outfit
 *     luc build. Do la SEO co ban, mien phi, va la ly do dung Next.js thay vi
 *     mot SPA thuan. Neu sau nay bo qua buoc nay thi phai viet lai.
 *   - Noi dung tai o phia trinh duyet de outfit moi dang hien ra ngay ma
 *     khong phai build lai, va de dem luot xem cung phan hoi hoat dong duoc.
 *
 * Neu chua cau hinh bien moi truong luc build thi generateStaticParams tra ve
 * mang rong: build van thanh cong, chi la chua co trang tinh nao. Trong che do
 * `npm run dev` thi moi slug van chay binh thuong.
 */

import { createClient } from '@supabase/supabase-js';
import OutfitDetail from './detail';

/*
 * CO Y KHONG khai bao `export const dynamicParams`.
 *
 * Next yeu cau gia tri do phai la mot boolean tinh (khong duoc tinh tu bien moi
 * truong), va che do `output: export` tu choi gia tri `true`. Bo han thi ca hai
 * che do deu chay dung nhu mong doi:
 *
 *   npm run dev / build   -> moi slug render duoc
 *   npm run build:static  -> chi cac slug da dung san luc build
 *
 * Hau qua thuc te cua ban tinh: outfit vua duoc duyet se chua co trang tinh cho
 * tori lan build tiep theo. Cach xu ly: dat webhook trong Supabase goi Deploy
 * Hook cua Cloudflare Pages moi khi mot outfit chuyen sang 'published'. Xem
 * README, phan "Dung lai trang khi co bai moi".
 */

/**
 * Che do `output: export` coi mang RONG la "thieu generateStaticParams" va bao
 * loi build. Nen khi khong doc duoc danh sach outfit (chua co bien moi truong,
 * hoac database khong tra loi), phai tra ve it nhat mot slug giu cho.
 *
 * Trang /outfit/_khong-co-du-lieu/ se render trang thai "khong tim thay outfit
 * nay" — dung y nghia, va khong co link nao tro tori no. Coi no la dau hieu:
 * neu ban thay trang do ton tai tren ban da trien khai, nghia la luc build
 * Cloudflare Pages chua co bien moi truong Supabase.
 */
const PLACEHOLDER_SLUG = '_khong-co-du-lieu';

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      '[PHOI] Thieu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY luc build.\n' +
        '       Khong dung san duoc trang outfit tinh nao — ban da trien khai se khong co\n' +
        '       trang chi tiet outfit. Dat hai bien nay trong Cloudflare Pages:\n' +
        '       Settings -> Environment variables -> Production.',
    );
    return [{ slug: PLACEHOLDER_SLUG }];
  }

  try {
    const sb = createClient(url, key);
    const { data, error } = await sb
      .from('outfits')
      .select('slug')
      .eq('status', 'published')
      .limit(2000);

    if (error) {
      console.warn('[PHOI] Khong doc duoc danh sach outfit luc build:', error.message);
      return [{ slug: PLACEHOLDER_SLUG }];
    }

    const slugs = (data ?? []).map((r) => ({ slug: r.slug as string }));

    if (slugs.length === 0) {
      console.warn(
        '[PHOI] Database ket noi duoc nhung khong co outfit nao o trang thai "published".\n' +
          '       Chay migration 0006_seed_outfits.sql de co 20 set do mau.',
      );
      return [{ slug: PLACEHOLDER_SLUG }];
    }

    console.log(`[PHOI] Dung san ${slugs.length} trang outfit tinh.`);
    return slugs;
  } catch (e) {
    console.warn('[PHOI] Loi khi dung san trang outfit:', (e as Error).message);
    return [{ slug: PLACEHOLDER_SLUG }];
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <OutfitDetail slug={slug} />;
}
