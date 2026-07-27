import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  Be_Vietnam_Pro, Inter, Manrope, Montserrat, Playfair_Display, EB_Garamond, Oswald,
} from 'next/font/google';
import './globals.css';
import { Favicon, PageTransition, SiteFooter, SiteHeader, TypographyStyle } from '@/components/site';

/**
 * next/font TAI FONT VE VA TU LUU TAI MAY CHU luc build, roi phuc vu tu chinh
 * ten mien cua minh. Luc nguoi dung mo trang khong co yeu cau nao di ra Google
 * — nhanh hon mot vong ket noi, va khong de lo dia chi IP nguoi doc cho ben
 * thu ba.
 *
 * Nam do day: 300 cho tieu de lon, 400 cho phan doc, 500 cho nhan, 600 cho nut,
 * 700 cho ai muon dat chu that dam. Them do day nghia la them file phai tai.
 */
const beVietnam = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam',
});

/**
 * SAU FONT TUY CHON, cho quan tri vien doi kieu chu trong trang Quan tri.
 *
 * TAT CA DEU CO BO CHU TIENG VIET DAY DU — toi da kiem tra tung font mot bang
 * cach doc that bang khai bao cua Google, khong doan. Day khong phai chi tiet
 * vun vat: font thieu tieng Viet thi trinh duyet phai ghep dau tu font khac,
 * dau bi lech va chong len chu, va no chi lo ra o nhung chu nhieu dau. Bebas
 * Neue — font rat hay duoc dung cho thoi trang — nam trong so bi loai vi ly do
 * nay: go "Phoi" ra "Phoi" mat dau.
 *
 * `preload: false` cho ca sau: trinh duyet CHI tai font nao dang thuc su duoc
 * dung. Khong co dong nay thi moi nguoi vao trang deu phai tai bay bo font du
 * chi dung mot.
 */
/*
  MOI LOI GOI PHAI VIET DAY DU, KHONG DUOC GOM THAM SO CHUNG RA BIEN.
  next/font chay luc BUILD chu khong phai luc trang chay: no doc thang ma nguon
  de biet phai tai font nao ve. Vi vay tham so bat buoc phai la hang viet tai
  cho — mot bien hay mot phep trai (`...OPTIONAL`) deu lam build that bai voi
  loi "Unexpected spread". Trong lap lai o day la cai gia phai tra, va la cai
  gia dung.

  `preload: false` cho ca sau font tuy chon: trinh duyet CHI tai font nao dang
  thuc su duoc dung. Khong co dong nay thi moi nguoi vao trang deu phai tai bay
  bo font du chi dung mot.
*/
const inter = Inter({
  subsets: ['vietnamese', 'latin'], weight: ['300', '400', '500', '600', '700'],
  display: 'swap', preload: false, variable: '--font-inter',
});
const manrope = Manrope({
  subsets: ['vietnamese', 'latin'], weight: ['300', '400', '500', '600', '700'],
  display: 'swap', preload: false, variable: '--font-manrope',
});
const montserrat = Montserrat({
  subsets: ['vietnamese', 'latin'], weight: ['300', '400', '500', '600', '700'],
  display: 'swap', preload: false, variable: '--font-montserrat',
});
const playfair = Playfair_Display({
  subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'],
  display: 'swap', preload: false, variable: '--font-playfair',
});
const garamond = EB_Garamond({
  subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'],
  display: 'swap', preload: false, variable: '--font-garamond',
});
const oswald = Oswald({
  subsets: ['vietnamese', 'latin'], weight: ['300', '400', '500', '600', '700'],
  display: 'swap', preload: false, variable: '--font-oswald',
});

const FONT_VARS = [
  beVietnam.variable, inter.variable, manrope.variable, montserrat.variable,
  playfair.variable, garamond.variable, oswald.variable,
].join(' ');

/**
 * Doc phan nhan dien website tu database LUC DUNG TRANG.
 *
 * VI SAO PHAI LA LUC DUNG TRANG CHU KHONG PHAI LUC CHAY
 *   Google, Facebook, Zalo doc the <meta> trong HTML tra ve. Phan lon chung
 *   KHONG chay JavaScript truoc khi doc. Nen mot doan mo ta chi duoc dat luc
 *   trang chay se khong bao gio den duoc ket qua tim kiem.
 *
 *   Doi lai: sua o quan tri xong phai trien khai lai trang thi chung moi thay.
 *   Su that nay duoc viet thang vao goi y cua o nhap, khong giau trong code.
 *
 * KHONG DOC DUOC THI DUNG BAN VIET SAN
 *   Luc build tren Cloudflare co the thieu bien moi truong, hoac database co
 *   the khong tra loi. Trong ca hai truong hop trang van phai co mo ta —
 *   khong co mo ta thi ket qua tim kiem hien mot doan chu bat ky lay tu than
 *   trang, thuong la vo nghia.
 */
const META_FALLBACK = {
  title: 'PHỐI — Phối đồ nam theo gu và theo mệnh',
  name: 'PHỐI',
  description:
    'Gợi ý phối đồ nam trong khoảng 150.000 – 700.000đ, cá nhân hoá theo phong cách, ' +
    'màu sắc và niên mệnh ngũ hành. Mua trên Shopee và TikTok Shop.',
};

type SiteMeta = {
  title: string;
  name: string;
  description: string;
  image: string;
  favicon: string;
};

async function readSiteMeta(): Promise<SiteMeta> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const blank: SiteMeta = {
    title: META_FALLBACK.title,
    name: META_FALLBACK.name,
    description: META_FALLBACK.description,
    image: '',
    favicon: '',
  };

  if (!url || !key) {
    console.warn('[PHOI] Luc build khong co bien Supabase — dung mo ta viet san.');
    return blank;
  }

  try {
    // DUNG THU VIEN SUPABASE CHU KHONG DUNG fetch() TRAN.
    //
    // Next thay the fetch() toan cuc bang ban cua no de quan ly bo nho dem. Mot
    // loi goi fetch() co `cache: 'no-store'` bien ca trang thanh trang DONG —
    // dieu bi cam trong che do xuat tinh, va build bao loi cho MOI trang. Da
    // mac dung loi do: mo ta khong bao gio duoc doc, va trang lang le dung ban
    // viet san.
    //
    // Thu vien supabase-js goi mang bang duong khac nen khong bi Next dem,
    // cung khong lam trang thanh dong. Day cung la cach generateStaticParams
    // cua trang outfit dang lam.
    const sb = createClient(url, key);
    const { data, error } = await sb
      .from('site_content')
      .select('key, value')
      .in('key', [
        'site.title', 'site.name', 'site.description', 'site.share_image', 'site.favicon',
      ]);

    if (error) throw new Error(error.message);

    const get = (k: string) =>
      (data ?? []).find((r) => r.key === k)?.value?.trim() ?? '';

    return {
      title: get('site.title') || META_FALLBACK.title,
      name: get('site.name') || META_FALLBACK.name,
      description: get('site.description') || META_FALLBACK.description,
      image: get('site.share_image'),
      favicon: get('site.favicon'),
    };
  } catch (e) {
    console.warn('[PHOI] Khong doc duoc mo ta website luc build:', (e as Error).message);
    return blank;
  }
}

/**
 * BO NHO DEM CUA BAN DUNG.
 *   Next luu lai trang da dung trong .next/cache. Doi mo ta trong database ma
 *   khong doi mot dong ma nguon nao thi lan dung tiep theo se dung lai trang cu
 *   — HTML van mang mo ta cu. Da mac dung loi do luc thu.
 *
 *   Vi vay lenh `build:static` xoa .next/cache truoc moi lan dung. Tren
 *   Cloudflare thi moi lan dung deu la may moi nen khong co van de nay.
 */
export async function generateMetadata(): Promise<Metadata> {
  const meta = await readSiteMeta();

  return {
    title: {
      default: meta.title,
      // Cac trang con tu dat tieu de rieng cua chung; mau nay noi them ten
      // website vao sau. Ten lay tu o "Ten website" chu khong viet cung nua —
      // doi ten ma tab van hien ten cu la mot kieu sai rat kho phat hien.
      template: `%s · ${meta.name}`,
    },
    description: meta.description,
    applicationName: meta.name,
    // Bieu tuong tab ghi thang vao HTML luc dung trang. Component <Favicon />
    // van dat lai luc chay — hai duong cho hai doi tuong khac nhau: may tim
    // kiem doc HTML va khong chay JavaScript, con nguoi dung thi can thay doi
    // ngay sau khi sua chu khong phai doi mot lan trien khai.
    ...(meta.favicon ? { icons: { icon: meta.favicon } } : {}),
    openGraph: {
      title: meta.title,
      siteName: meta.name,
      description: meta.description,
      type: 'website',
      ...(meta.image ? { images: [{ url: meta.image }] } : {}),
    },
    // Khong dat metadataBase o day: ten mien chua co (dang dung *.pages.dev).
    // Khi co ten mien that thi them metadataBase de anh og: co duong dan tuyet doi.
  };
}


export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Cho phep phong to. Chan phong to la loi tro nang co ban.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`h-full ${FONT_VARS}`}>
      <body className="flex min-h-full flex-col">
        {/* Kieu chu do quan tri vien chon, do vao bien CSS o goc tai luc chay.
            Dat TRUOC moi thu khac de chu khong nhay kieu sau khi tai xong. */}
        <TypographyStyle />
        <Favicon />
        <SiteHeader />
        <main className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
