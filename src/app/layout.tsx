import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { SiteFooter, SiteHeader } from '@/components/site';

/**
 * next/font TAI FONT VE VA TU LUU TAI MAY CHU luc build, roi phuc vu tu chinh
 * ten mien cua minh. Luc nguoi dung mo trang khong co yeu cau nao di ra Google
 * — nhanh hon mot vong ket noi, va khong de lo dia chi IP nguoi doc cho ben
 * thu ba.
 *
 * Bon do day la du: 300 cho tieu de lon, 400 cho phan doc, 500 cho nhan va
 * nut, 600 cho cho can nhan manh. Them do day nghia la them file phai tai.
 */
const beVietnam = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-be-vietnam',
});

export const metadata: Metadata = {
  title: {
    default: 'PHỐI — Phối đồ nam theo gu và theo mệnh',
    template: '%s · PHỐI',
  },
  description:
    'Gợi ý phối đồ nam trong khoảng 150.000 – 700.000đ, cá nhân hoá theo phong cách, ' +
    'màu sắc và niên mệnh ngũ hành. Mua trên Shopee và TikTok Shop.',
  applicationName: 'PHỐI',
  // Khong dat metadataBase o day: ten mien chua co (dang dung *.pages.dev).
  // Khi co ten mien that thi them metadataBase de anh og: co duong dan tuyet doi.
};

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
    <html lang="vi" className={`h-full ${beVietnam.variable}`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
