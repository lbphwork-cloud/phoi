'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SetupNotice } from '@/components/site';
import { useAuth } from '@/lib/hooks';

export default function LoginPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Login />;
}

type Mode = 'signin' | 'signup';

function Login() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!authLoading && session) {
    return (
      <div className="shell-narrow py-20 text-center">
        <p className="eyebrow mb-4">Đã đăng nhập</p>
        <h1 className="display-sm mb-8">Bạn đang đăng nhập rồi</h1>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/ho-so" className="btn btn-solid">Vào hồ sơ</Link>
          <Link href="/kham-pha" className="btn">Khám phá outfit</Link>
        </div>
      </div>
    );
  }

  /**
   * Dang nhap bang Google.
   *
   * Day la duong DUOC KHUYEN DUNG, khong phai lua chon phu. Ly do rat cu the:
   * goi mien phi cua Supabase gioi han so email xac thuc gui duoc moi gio o
   * muc rat thap. Neu ai cung dang ky bang email thi luong dang ky se nghen
   * ngay khi co vai chuc nguoi vao cung luc. Google OAuth khong gui email nao.
   */
  const signInWithGoogle = async () => {
    const sb = getSupabase();
    if (!sb) return;

    setBusy(true);
    setError(null);

    const { error: e } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });

    if (e) {
      setBusy(false);
      setError(
        e.message.includes('provider is not enabled')
          ? 'Chưa bật đăng nhập Google trong Supabase. Vào Authentication → Providers → Google để bật. Xem README phần "Bật đăng nhập Google".'
          : e.message,
      );
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;

    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === 'signup') {
      if (password.length < 8) {
        setBusy(false);
        setError('Mật khẩu cần ít nhất 8 ký tự.');
        return;
      }

      const { data, error: err } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });

      setBusy(false);
      if (err) { setError(err.message); return; }

      // Neu Supabase bat xac thuc email thi chua co session ngay.
      if (data.session) router.push('/');
      else {
        setInfo(
          'Đã tạo tài khoản. Kiểm tra email để xác thực. Lưu ý: gói miễn phí của ' +
            'Supabase giới hạn số email gửi mỗi giờ — nếu không thấy email, hãy ' +
            'dùng đăng nhập Google.',
        );
      }
      return;
    }

    const { error: err } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng.'
          : err.message,
      );
      return;
    }

    // VE TRANG CHU, KHONG VAO HO SO.
    //   Nguoi ta dang nhap de XEM DO, khong phai de khai bao ho so. Da vao ho
    //   so thi phai bam tiep mot lan nua moi ra cho co noi dung — mot buoc thua
    //   dat dung luc nguoi dung dang muon xem nhat. Ai can sua ho so thi menu
    //   luon co san duong vao.
    router.push('/');
  };

  return (
    <div className="shell-narrow py-16 md:py-24">
      <p className="eyebrow mb-4">{mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}</p>
      <h1 className="display-sm mb-4">
        {mode === 'signin' ? 'Vào PHỐI' : 'Tạo tài khoản PHỐI'}
      </h1>
      <p className="muted mb-10 text-sm">
        Bạn xem outfit được mà không cần đăng nhập. Đăng nhập để lưu gu riêng,
        phản hồi để gợi ý sát hơn, và tự đăng bài phối đồ.
      </p>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="btn btn-solid mb-3 w-full"
      >
        Tiếp tục với Google
      </button>
      <p className="hint mb-8">
        Nhanh nhất và không cần chờ email xác thực.
      </p>

      <div className="mb-8 flex items-center gap-4">
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
        <span className="eyebrow">hoặc dùng email</span>
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      </div>

      <form onSubmit={submitEmail} className="flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            placeholder="ten@email.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            placeholder="Ít nhất 8 ký tự"
          />
        </div>

        {error && <div className="notice notice-danger">{error}</div>}
        {info && <div className="notice notice-ok">{info}</div>}

        <button type="submit" disabled={busy} className="btn">
          {busy ? 'Đang xử lý…' : mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
        </button>
      </form>

      <p className="muted mt-8 text-sm">
        {mode === 'signin' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
        <button
          type="button"
          className="underline"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
        >
          {mode === 'signin' ? 'Đăng ký' : 'Đăng nhập'}
        </button>
      </p>

      <p className="muted-2 mt-10 text-xs leading-relaxed">
        Khi tạo tài khoản, bạn đồng ý để PHỐI lưu email và các lựa chọn gu của bạn
        nhằm cá nhân hoá nội dung. Ngày sinh là tuỳ chọn, chỉ dùng để suy ra niên
        mệnh ngũ hành, không hiển thị công khai, và bạn xoá được bất cứ lúc nào
        trong trang hồ sơ.
      </p>
    </div>
  );
}
