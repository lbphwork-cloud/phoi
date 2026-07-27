'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { SetupNotice, Spinner } from '@/components/site';
import { useAuth } from '@/lib/hooks';

const TABS = [
  { href: '/admin', label: 'Tổng quan' },
  { href: '/admin/kiem-duyet', label: 'Kiểm duyệt' },
  { href: '/admin/outfit', label: 'Outfit' },
  { href: '/admin/san-pham', label: 'Sản phẩm' },
  { href: '/admin/noi-dung', label: 'Nội dung' },
  { href: '/admin/phong-cach', label: 'Phong cách' },
  { href: '/admin/nguoi-dung', label: 'Người dùng' },
  { href: '/admin/ai', label: 'AI' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Guard>{children}</Guard>;
}

/**
 * Chan truy cap trang quan tri o phia giao dien.
 *
 * DAY CHI LA LOP TIEN LOI, KHONG PHAI LOP BAO VE. Nguoi dung co the tu sua
 * JavaScript trong trinh duyet de di qua. Lop bao ve that la RLS: moi truy van
 * ma trang admin thuc hien deu bi database kiem tra is_admin() lai. Ke tan cong
 * vao duoc man hinh nay cung chi thay man hinh trong.
 */
function Guard({ children }: { children: React.ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return <Spinner label="Đang kiểm tra quyền" />;

  if (!session) {
    return (
      <div className="shell-narrow py-20 text-center">
        <h1 className="display-sm mb-6">Cần đăng nhập</h1>
        <Link href="/dang-nhap" className="btn btn-solid">Đăng nhập</Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="shell-narrow py-20">
        <p className="eyebrow mb-4">Không có quyền</p>
        <h1 className="display-sm mb-6">Trang này chỉ dành cho quản trị viên</h1>
        <div className="notice notice-warn mb-8">
          Tài khoản của bạn đang ở quyền &quot;người dùng&quot;. Để tự cấp quyền quản trị
          cho tài khoản đầu tiên, mở SQL Editor của Supabase và chạy:
          <pre className="scroll-x mt-3 text-xs">
{`update profiles set role = 'admin'
 where id = (select id from auth.users where email = 'email-cua-ban@...');`}
          </pre>
        </div>
        <Link href="/" className="btn">Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="shell py-10">
      <div className="mb-8">
        <p className="eyebrow mb-3">Quản trị PHỐI</p>
        <nav className="scroll-x flex gap-1 border-b pb-2" style={{ borderColor: 'var(--line)' }}>
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="btn btn-quiet btn-sm shrink-0"
                style={active ? { background: 'var(--fg)', color: 'var(--bg)' } : undefined}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
