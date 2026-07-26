import type { NextConfig } from 'next';

/**
 * Hai che do build:
 *
 *   npm run dev            — che do thuong. Route dong hoat dong day du.
 *   npm run build:static   — dat BUILD_STATIC=1, xuat ra thu muc out/ gom
 *                            toan bo HTML tinh. Day la thu tai len
 *                            Cloudflare Pages.
 *
 * Vi sao xuat tinh: Cloudflare Pages cho bang thong khong gioi han va CHO PHEP
 * dung thuong mai o goi mien phi. Goi Hobby cua Vercel thi khong — dieu khoan
 * cua ho gioi han goi mien phi cho muc dich phi thuong mai, ma website affiliate
 * sinh hoa hong la hoat dong thuong mai.
 *
 * Vi sao khong bat 'export' o moi luc: che do export tat mot so tinh nang cua
 * Next (route handler, middleware, toi uu anh). Giu che do thuong luc phat
 * trien de de go loi hon.
 */
const isStatic = process.env.BUILD_STATIC === '1';

const nextConfig: NextConfig = {
  ...(isStatic ? { output: 'export' as const } : {}),

  images: {
    // Che do export khong co server nen khong toi uu anh duoc. Dat unoptimized
    // o CA HAI che do de anh hien giong nhau giua dev va production — tranh
    // truong hop chi phat hien loi anh sau khi da trien khai.
    unoptimized: true,
  },

  // Moi trang la mot thu muc chua index.html. Cloudflare Pages phuc vu file
  // tinh de doan hon voi cach nay.
  trailingSlash: true,
};

export default nextConfig;
