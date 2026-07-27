'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, useTheme } from '@/lib/hooks';
import { useContent } from '@/lib/content';
import { typographyCss } from '@/lib/typography';
import { SearchBox } from '@/components/SearchBox';

/**
 * Cac muc tren thanh menu.
 *
 * `key` la khoa trong bang noi dung, `fallback` la chu viet cung trong ma nguon
 * de trang van du chu khi database khong goi duoc. Duong dan thi KHONG sua duoc
 * tu trang quan tri: doi duong dan la lam hong lien ket, va do phai la mot thay
 * doi co y trong ma nguon chu khong phai mot cu bam nham.
 */
const NAV = [
  { href: '/kham-pha', key: 'nav.discover', fallback: 'Discover' },
  { href: '/gio-hang', key: 'nav.cart', fallback: 'Cart' },
  { href: '/tao-bai', key: 'nav.create', fallback: 'Create' },
  { href: '/bai-cua-toi', key: 'nav.my_posts', fallback: 'My posts' },
];

/**
 * Kieu chu do quan tri vien chon, do vao bien CSS o cap goc.
 *
 * VI SAO LA MOT THE <style> CHU KHONG PHAI THUOC TINH style
 *   Cac bien nay phai nam tren :root de moi quy tac trong globals.css doc
 *   duoc — ke ca quy tac cua nhung component chua ai viet. React khong dat
 *   duoc bien CSS len :root bang thuoc tinh style, nen phai di duong nay.
 *
 * Chua tai xong thi khong do gi ca, va globals.css tu dung gia tri mac dinh
 * viet cung trong tung quy tac. Khong bao gio co khoanh khac chu mat kieu.
 */
export function TypographyStyle() {
  const c = useContent();
  if (c.loading) return null;
  return <style dangerouslySetInnerHTML={{ __html: typographyCss(c.t) }} />;
}

/**
 * Lop boc noi dung, chay lai hieu ung mo dan moi lan doi trang.
 *
 * `key={pathname}` la ca co che: doi khoa thi React vut bo cay cu va dung cay
 * moi, nen hieu ung CSS chay lai tu dau. Khong co no thi React tai su dung
 * phan tu cu va hieu ung chi chay dung mot lan trong ca phien.
 *
 * KHONG dung thu vien chuyen dong nao. Mot hieu ung mo dan 0.45s khong dang
 * de them mot goi vao goi phai tai ve — va goi do se nam trong duong tai cua
 * moi trang, ke ca trang khong co hieu ung gi.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="page-in">{children}</div>;
}

/**
 * Dat bieu tuong tab trinh duyet tu o noi dung, luc trang dang chay.
 *
 * VI SAO CAN CA HAI DUONG
 *   Bieu tuong trong the <head> duoc ghi luc DUNG TRANG. Do la ban ma Google va
 *   Facebook doc. Nhung sua o quan tri xong ma phai doi mot lan trien khai moi
 *   thay bieu tuong moi thi rat kho hieu — nen component nay dat lai the <link>
 *   ngay khi trang tai xong, de trinh duyet thay lien.
 *
 *   Hai duong nay khong mau thuan: mot cho may tim kiem, mot cho nguoi dung.
 *   Cau giai thich do da duoc viet vao goi y cua chinh o nhap.
 */
export function Favicon() {
  const c = useContent();
  const href = c.t('site.favicon', '');

  useEffect(() => {
    if (!href) return;

    // Xoa cac the icon co san roi dat lai mot cai. Chi doi `href` cua the cu
    // thi mot so trinh duyet khong ve lai — chung chi doc the icon mot lan.
    for (const el of document.querySelectorAll('link[rel~="icon"]')) el.remove();

    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    document.head.appendChild(link);
  }, [href]);

  return null;
}

export function SiteHeader() {
  const { session, isAdmin, loading, signOut } = useAuth();
  const { theme, cycle } = useTheme();
  const c = useContent();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Dong menu khi doi trang bang nut back/forward cua trinh duyet
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, []);

  const themeLabel =
    theme === 'system' ? c.t('nav.theme_auto', 'Auto')
    : theme === 'light' ? c.t('nav.theme_light', 'Light')
    : c.t('nav.theme_dark', 'Dark');

  /**
   * Logo. Hai o anh rieng cho nen sang va nen toi.
   *
   * VI SAO HAI O CHU KHONG PHAI MOT
   *   Logo PNG tach nen chi co mot mau. Logo trang thi tang hinh o che do sang,
   *   logo den thi tang hinh o che do toi — website nay co ca hai che do. O thu
   *   hai de trong thi tu dung lai anh thu nhat, nen ai khong quan tam khong
   *   phai lam gi.
   *
   *   Ca hai duoc dat trong DOM cung luc va an/hien bang CSS theo che do. Chon
   *   bang JavaScript se lam logo nhay mot cai luc trang vua tai xong.
   */
  const logoLight = c.t('site.logo.light', '');
  const logoDark = c.t('site.logo.dark', '') || logoLight;
  // `c.t` da tu chon ban dien thoai khi o do co gia tri, nen chi can mot lan goi.
  const logoHeight = c.t('site.logo.height', '28');

  const brand = (
    <Link href="/" className="shrink-0" aria-label="PHỐI — về trang chủ">
      {logoLight ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoLight}
            alt="PHỐI"
            className="logo-light block w-auto"
            style={{ height: `${logoHeight}px` }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDark}
            alt="PHỐI"
            className="logo-dark w-auto"
            style={{ height: `${logoHeight}px` }}
          />
        </>
      ) : (
        <span className="display-xs" style={{ letterSpacing: '0.28em' }}>
          PHỐI
        </span>
      )}
    </Link>
  );

  const navItems = [
    ...NAV,
    ...(isAdmin ? [{ href: '/admin', key: 'nav.admin', fallback: 'Admin' }] : []),
  ];

  return (
    <header
      className="header-rule sticky top-0 z-50 backdrop-blur-md"
      style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
    >
      {/*
        BA COT: menu trai — logo GIUA — tai khoan phai.

        MOC CHUYEN LA 1024px CHU KHONG PHAI 768px.
        O 768px, nam muc menu cong ba muc tai khoan cong logo khong du cho —
        da nhin bang trinh duyet that va thay "Bai cua toi" dam vao chu PHOI.
        Duoi 1024px thi toan bo dieu huong nam trong nut ba gach.

        Dung grid ba cot bang nhau chu khong phai flex voi justify-between:
        voi flex, logo chi nam giua khi hai ben tinh co dai bang nhau, ma ben
        phai doi do dai theo ten nguoi dang nhap. Grid thi cot giua luon dung
        giua khung, bat ke hai ben dai ngan the nao.
      */}
      <div className="shell grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="navlink"
              aria-current={pathname === n.href ? 'page' : undefined}
            >
              <span style={c.s(n.key)}>{c.t(n.key, n.fallback)}</span>
            </Link>
          ))}
        </nav>

        {/* Tren dien thoai, cot trai la nut ba gach va kinh lup — dung bo cuc
            cua cac trang thoi trang: dieu huong ben trai, ten thuong hieu o
            giua. Ba gach ve bang SVG chu khong dung ky tu "≡": ky tu do hien
            khac nhau tren tung he dieu hanh va thuong bi lech tam. */}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="navlink"
            aria-expanded={open}
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              {open ? (
                <>
                  <path d="M5 5 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M19 5 5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
          <SearchBox />
        </div>

        <div className="flex justify-center">{brand}</div>

        {/*
          LOP `hidden` DAT TREN THE BOC, KHONG TREN TUNG MUC.

          Ly do la mot cai bay ve thu tu CSS: cac lop tu viet trong globals.css
          (.navlink, .btn, .chip...) khong nam trong tang nao ca, con cac lop
          tien ich cua Tailwind thi nam trong tang `utilities`. CSS cho phep moi
          quy tac KHONG THUOC TANG NAO thang moi quy tac co tang, bat ke do manh
          yeu ra sao. Nen `.navlink { display: inline-flex }` an dut
          `.hidden { display: none }`, va cac muc nay van hien tren dien thoai
          du da ghi `hidden`.

          Da kiem chung bang trinh duyet that: mot the mang ca hai lop tra ve
          display = flex chu khong phai none.

          Dat `hidden` len mot the boc khong mang lop tu viet nao thi khong con
          gi de tranh chap.
        */}
        <div className="hidden items-center justify-end gap-1 lg:flex">
          <SearchBox />

          <button
            type="button"
            onClick={cycle}
            className="navlink"
            title="Đổi chế độ sáng / tối"
          >
            {themeLabel}
          </button>

          {loading ? (
            <span className="navlink">…</span>
          ) : session ? (
            <>
              {/* CHU CHUNG cho moi tai khoan, khong phai ten nguoi dang nhap.
                  Ten nguoi dung dai ngan khac nhau nen thanh menu doi be ngang
                  theo tung nguoi — va cot logo o giua bi xe dich theo. Ten cua
                  minh thi nguoi dung da biet roi; cai ho can biet la bam vao
                  day thi di dau. */}
              <Link href="/ho-so" className="navlink">
                <span style={c.s('nav.profile')}>{c.t('nav.profile', 'Profile')}</span>
              </Link>
              <button type="button" onClick={signOut} className="navlink">
                <span style={c.s('nav.sign_out')}>{c.t('nav.sign_out', 'Log out')}</span>
              </button>
            </>
          ) : (
            <Link href="/dang-nhap" className="navlink">
              <span style={c.s('nav.sign_in')}>{c.t('nav.sign_in', 'Sign in')}</span>
            </Link>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t lg:hidden" style={{ borderColor: 'var(--line)' }}>
          <div className="shell flex flex-col py-2">
            {navItems.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="navlink justify-start"
              >
                <span style={c.s(n.key)}>{c.t(n.key, n.fallback)}</span>
              </Link>
            ))}
            {session ? (
              <>
                <Link href="/ho-so" onClick={() => setOpen(false)} className="navlink justify-start">
                  {c.t('nav.profile', 'Profile')}
                </Link>
                <button type="button" onClick={signOut} className="navlink justify-start">
                  {c.t('nav.sign_out', 'Log out')}
                </button>
              </>
            ) : (
              <Link href="/dang-nhap" onClick={() => setOpen(false)} className="navlink justify-start">
                {c.t('nav.sign_in', 'Sign in')}
              </Link>
            )}
            <button type="button" onClick={cycle} className="navlink justify-start">
              {themeLabel}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * Chan trang.
 *
 * BO CUC MOT COT DOC, KHONG PHAI BA COT NGANG
 *   Logo va cau dinh vi len tren cung. Ben duoi la khoi cong bo, dan ngang het
 *   be ngang — dung bang be ngang cua khoi "Cach hoat dong" ngay phia tren, va
 *   chia dung ba cot khop cot voi 01 / 02 / 03. Hai khoi lien nhau ma le cot
 *   khac nhau se nhin nhu hai trang bi dan vao nhau.
 *
 * KHONG CON COT "TRANG"
 *   Bon duong dan o do lap y nguyen thanh menu ngay phia tren dau trang. Mot
 *   danh sach duong dan chi de lap lai mot danh sach khac la cho chiem cho.
 *
 * DUONG KE DEN CHU KHONG PHAI XAM NHAT
 *   Thanh menu dung `--fg` (den dam), chan trang truoc day dung `--line` (xam
 *   rat nhat). Hai duong ke gioi han tren va duoi cua ca trang ma khac hin
 *   nhau thi trang nhin nhu chua dong lai. Gio ca hai giong nhau.
 */
export function SiteFooter() {
  const c = useContent();

  // Cung hai o anh voi thanh menu. Chan trang de logo to hon mot chut vi o do
  // no la dau moc dong trang chu khong phai mot muc dieu huong.
  const logoLight = c.t('site.logo.light', '');
  const logoDark = c.t('site.logo.dark', '') || logoLight;
  const logoHeight = c.t('site.logo.height', '28');
  const logoPx = `${Number(logoHeight) * 1.4 || 40}px`;

  return (
    <footer className="py-14" style={{ borderTop: '1px solid var(--fg)' }}>
      <div className="shell">
        {/*
          CANH GIUA TREN MAY TINH, SAT LE TRAI TREN DIEN THOAI.

          Man hinh rong thi logo dung giua la mot dau cham het — mat di het mot
          hang roi dung lai o giua. Man hinh hep thi khong con "giua" de noi:
          moi thu deu gan giua, va canh giua chi lam logo lech so voi cac dong
          chu canh trai ngay ben duoi no.

          `md:mx-auto` dat tren chinh the anh chu khong chi text-center: anh la
          mot khoi co be ngang rieng, `text-center` khong dieu khien duoc no.
        */}
        <div className="text-left md:text-center">
          <div className="mb-3">
            {logoLight ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoLight} alt="PHỐI" className="logo-light w-auto md:mx-auto"
                     style={{ height: logoPx }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoDark} alt="PHỐI" className="logo-dark w-auto md:mx-auto"
                     style={{ height: logoPx }} />
              </>
            ) : (
              <p className="display-xs" style={{ letterSpacing: '0.28em' }}>
                <span style={c.s('site.name')}>{c.t('site.name', 'PHỐI')}</span>
              </p>
            )}
          </div>
          <p className="muted text-sm leading-relaxed">
            <span style={c.s('site.tagline')}>
              {c.t(
                'site.tagline',
                'Gợi ý phối đồ nam theo gu và theo mệnh. Sản phẩm trong khoảng ' +
                  '150.000 – 700.000đ, mua trên Shopee và TikTok Shop.',
              )}
            </span>
          </p>
        </div>

        {/*
          Cong bo affiliate. Day khong phai phan trang tri — day la thong le
          minh bach voi nguoi tieu dung, va la thu can co truoc khi website mo
          cho nguoi that vao.

          Ca ba doan cung 14px voi phan doc cua khoi "Cach hoat dong" ngay tren.
          Truoc day chung la 12px va mau nhat hon — tuc la thong tin phap ly
          duoc trinh bay nhu mot thu dang co giau di. Neu da noi la minh bach
          thi phai doc duoc.
        */}
        <div className="mt-14">
          <p className="eyebrow mb-6">
            <span style={c.s('footer.disclosure_heading')}>
              {c.t('footer.disclosure_heading', 'Công bố')}
            </span>
          </p>
          <div className="grid gap-10 md:grid-cols-3">
            <p className="muted text-sm leading-relaxed">
              <span style={c.s('footer.affiliate')}>
                {c.t(
                  'footer.affiliate',
                  'Các liên kết mua hàng trên PHỐI là liên kết tiếp thị. Người đăng bài ' +
                    'có thể nhận hoa hồng từ sàn khi bạn mua qua liên kết của họ. ' +
                    'Giá bạn trả không thay đổi.',
                )}
              </span>
            </p>
            <p className="muted text-sm leading-relaxed">
              <span style={c.s('footer.about')}>
                {c.t(
                  'footer.about',
                  'Nội dung về ngũ hành chỉ là gợi ý màu sắc mang tính tham khảo trong ' +
                    'phối đồ, không phải dự đoán vận mệnh.',
                )}
              </span>
            </p>
            <p className="muted text-sm leading-relaxed">
              <span style={c.s('footer.price_note')}>
                {c.t(
                  'footer.price_note',
                  'Giá sản phẩm do sàn quyết định và có thể đã thay đổi so với thời điểm ' +
                    'chúng tôi ghi nhận. Vui lòng kiểm tra lại trên sàn trước khi mua.',
                )}
              </span>
            </p>
          </div>
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
