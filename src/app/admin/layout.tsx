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

  /*
    KHONG CHAN MAN HINH DE CHO NUA.

    Truoc day dong dau tien la `if (loading) return <Spinner/>`, va no chay MOI
    LAN bam vao mot trang quan tri — ke ca khi vua bam tu mot trang quan tri
    khac sang. Ly do nam o useAuth: moi component giu mot ban trang thai rieng
    nen lan nao dung lop chan nay cung bat dau lai tu con so khong. Cai do da
    duoc chua trong src/lib/hooks.ts.

    Cho nay chua not nua phan con lai: khi DA BIET la admin — ke ca chi biet
    qua bo nho trinh duyet tu lan truoc — thi vao thang, khong cho. Chi khi
    that su chua biet gi moi hien o cho, va hien BEN TRONG khung trang quan tri
    chu khong thay ca man hinh: bo khung di roi dung lai lam ca trang nhay mot
    cai, va nguoi dung mat luon hang the o tren.

    An toan khong dua vao cho nay. Moi truy van cua trang quan tri deu bi
    database kiem tra is_admin() lai — day chi la lop tien loi.
  */
  if (!isAdmin && loading) {
    return <Chrome pathname={pathname}><Spinner label="Đang mở trang quản trị" /></Chrome>;
  }

  if (!isAdmin && !session) {
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

  return <Chrome pathname={pathname}>{children}</Chrome>;
}

/**
 * Khung co dinh cua trang quan tri: tieu de va hang the.
 *
 * Tach ra vi no duoc dung o HAI trang thai — luc dang cho biet quyen va luc da
 * vao duoc. Khung phai la MOT va giong het nhau o ca hai, neu khong thi luc
 * chuyen tu cho sang xong ca trang se nhay.
 */
function Chrome({ pathname, children }: { pathname: string; children: React.ReactNode }) {
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
