/**
 * robots.txt — noi cho bot biet cho nao nen doc, cho nao khong.
 *
 * CHAN CAC TRANG CAN DANG NHAP, va ly do khong phai bao mat: bot bi RLS chan
 * san roi, no vao cung chi thay man hinh trong. Ly do la de khong lang phi —
 * moi lan bot mo mot trang no khong doc duoc gi la mot lan no khong mo mot
 * trang set do that.
 *
 * KHONG dung robots.txt de giau thu bi mat. File nay cong khai, va viet ten
 * mot duong dan vao day chinh la chi cho nguoi to mo biet duong dan do ton
 * tai. Thu can giau thi phai chan o tang database.
 */

import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/tao-bai/', '/ho-so/', '/gio-hang/', '/bai-cua-toi/', '/du-lieu-cua-toi/'],
    },
    sitemap: 'https://phoi.pages.dev/sitemap.xml',
  };
}
