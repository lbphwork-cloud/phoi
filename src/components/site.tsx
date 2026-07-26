'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth, useTheme } from '@/lib/hooks';

const NAV = [
  { href: '/kham-pha', label: 'Khám phá' },
  { href: '/tao-bai', label: 'Tạo bài' },
  { href: '/bai-cua-toi', label: 'Bài của tôi' },
];

export function SiteHeader() {
  const { session, profile, isAdmin, loading, signOut } = useAuth();
  const { theme, cycle } = useTheme();
  const [open, setOpen] = useState(false);

  // Dong menu khi doi trang bang nut back/forward cua trinh duyet
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, []);

  const themeLabel = theme === 'system' ? 'Tự động' : theme === 'light' ? 'Sáng' : 'Tối';

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
    >
      <div className="shell flex items-center justify-between gap-4 py-4">
        <Link href="/" className="display-xs shrink-0" style={{ letterSpacing: '0.28em' }}>
          PHỐI
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="btn btn-quiet">
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="btn btn-quiet">
              Quản trị
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycle}
            className="btn btn-quiet btn-sm hidden sm:inline-flex"
            title="Đổi chế độ sáng / tối"
          >
            {themeLabel}
          </button>

          {loading ? (
            <span className="eyebrow hidden sm:block">…</span>
          ) : session ? (
            <>
              <Link href="/ho-so" className="btn btn-quiet btn-sm hidden sm:inline-flex">
                {profile?.display_name ?? 'Hồ sơ'}
              </Link>
              <button type="button" onClick={signOut} className="btn btn-sm hidden sm:inline-flex">
                Thoát
              </button>
            </>
          ) : (
            <Link href="/dang-nhap" className="btn btn-solid btn-sm">
              Đăng nhập
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn btn-quiet btn-sm md:hidden"
            aria-expanded={open}
            aria-label="Mở menu"
          >
            {open ? 'Đóng' : 'Menu'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t md:hidden" style={{ borderColor: 'var(--line)' }}>
          <div className="shell flex flex-col py-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="btn btn-quiet justify-start"
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="btn btn-quiet justify-start">
                Quản trị
              </Link>
            )}
            {session ? (
              <>
                <Link href="/ho-so" onClick={() => setOpen(false)} className="btn btn-quiet justify-start">
                  Hồ sơ
                </Link>
                <button type="button" onClick={signOut} className="btn btn-quiet justify-start">
                  Đăng xuất
                </button>
              </>
            ) : null}
            <button type="button" onClick={cycle} className="btn btn-quiet justify-start">
              Chế độ: {themeLabel}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t py-12" style={{ borderColor: 'var(--line)' }}>
      <div className="shell grid gap-10 md:grid-cols-3">
        <div>
          <p className="display-xs mb-3" style={{ letterSpacing: '0.28em' }}>
            PHỐI
          </p>
          <p className="muted text-sm">
            Gợi ý phối đồ nam theo gu và theo mệnh. Sản phẩm trong khoảng
            150.000&nbsp;–&nbsp;700.000đ, mua trên Shopee và TikTok Shop.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-3">Trang</p>
          <ul className="flex flex-col gap-1 text-sm">
            <li><Link href="/kham-pha" className="muted hover:underline">Khám phá outfit</Link></li>
            <li><Link href="/tao-bai" className="muted hover:underline">Tạo bài phối đồ</Link></li>
            <li><Link href="/ho-so" className="muted hover:underline">Hồ sơ và quyền dữ liệu</Link></li>
          </ul>
        </div>

        {/*
          Cong bo affiliate. Day khong phai phan trang tri — day la thong le
          minh bach voi nguoi tieu dung, va la thu can co truoc khi website mo
          cho nguoi that vao.
        */}
        <div>
          <p className="eyebrow mb-3">Công bố</p>
          <p className="muted-2 text-xs leading-relaxed">
            Các liên kết mua hàng trên PHỐI là liên kết tiếp thị. Người đăng bài
            có thể nhận hoa hồng từ sàn khi bạn mua qua liên kết của họ. Giá bạn
            trả không thay đổi.
          </p>
          <p className="muted-2 mt-3 text-xs leading-relaxed">
            Nội dung về ngũ hành chỉ là gợi ý màu sắc mang tính tham khảo trong
            phối đồ, không phải dự đoán vận mệnh.
          </p>
          <p className="muted-2 mt-3 text-xs leading-relaxed">
            Giá sản phẩm do sàn quyết định và có thể đã thay đổi so với thời điểm
            chúng tôi ghi nhận. Vui lòng kiểm tra lại trên sàn trước khi mua.
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Man hinh huong dan khi chua cau hinh Supabase.
 * Hien thay vi de trang trang hoac nem loi do — nguoi moi clone repo can biet
 * phai lam gi tiep.
 */
export function SetupNotice() {
  return (
    <div className="shell-narrow py-20">
      <p className="eyebrow mb-4">Chưa kết nối database</p>
      <h1 className="display-sm mb-6">Cần cấu hình Supabase trước</h1>

      <div className="notice notice-warn mb-8">
        Website đang chạy nhưng chưa có kết nối tới database, nên chưa có dữ liệu
        để hiển thị. Đây là trạng thái bình thường khi mới tải mã nguồn về.
      </div>

      <ol className="muted flex flex-col gap-4 text-sm">
        <li>
          <strong className="block" style={{ color: 'var(--fg)' }}>1. Tạo project Supabase</strong>
          Vào supabase.com, tạo project mới ở khu vực Singapore (gần Việt Nam nhất).
        </li>
        <li>
          <strong className="block" style={{ color: 'var(--fg)' }}>2. Chạy migration</strong>
          Mở SQL Editor, dán lần lượt 6 file trong <code>supabase/migrations/</code> theo
          đúng thứ tự số, chạy từng file một.
        </li>
        <li>
          <strong className="block" style={{ color: 'var(--fg)' }}>3. Tạo file .env.local</strong>
          Sao chép <code>.env.example</code> thành <code>.env.local</code> rồi điền URL và
          anon key lấy trong Settings → API.
        </li>
        <li>
          <strong className="block" style={{ color: 'var(--fg)' }}>4. Khởi động lại</strong>
          Dừng <code>npm run dev</code> rồi chạy lại. Biến môi trường chỉ được đọc lúc khởi động.
        </li>
      </ol>

      <p className="muted-2 mt-8 text-sm">
        Hướng dẫn đầy đủ nằm trong <code>README.md</code>.
      </p>
    </div>
  );
}

export function Spinner({ label = 'Đang tải' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="eyebrow">{label}…</p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border py-20 text-center" style={{ borderColor: 'var(--line)' }}>
      <p className="display-xs mb-2">{title}</p>
      {children && <div className="muted mx-auto max-w-md px-6 text-sm">{children}</div>}
    </div>
  );
}
