import type { Metadata } from 'next';
import './globals.css';
import { SiteFooter, SiteHeader } from '@/components/site';

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
    <html lang="vi" className="h-full">
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
