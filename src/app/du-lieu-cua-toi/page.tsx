'use client';

/**
 * Quyen cua nguoi dung doi voi du lieu ca nhan cua chinh ho.
 *
 * VI SAO LA MOT TRANG RIENG
 *   Truoc day khoi nay nam duoi cung trang /ho-so. Chu website muon bo di vi
 *   no lam trang ho so nang ne va lac de — trang do de chon gu, khong phai de
 *   doc dieu khoan.
 *
 *   Nhung KHONG BO HAN. Nghi dinh 13/2023 ve bao ve du lieu ca nhan yeu cau
 *   nguoi dung phai tu xem, tu tai ve va tu xoa duoc du lieu cua minh, khong
 *   phai gui yeu cau roi cho quan tri vien xu ly. Chuyen sang trang rieng giu
 *   nguyen quyen do ma khong lam roi trang chinh.
 *
 * CA HAI VIEC DEU CHAY BANG QUYEN CUA CHINH NGUOI DUNG
 *   Tai ve: doc bang REST, Row Level Security tu gioi han o dong cua ho.
 *   Xoa: goi ham SQL erase_my_personal_data(), xoa dung va du trong mot giao
 *   dich. Khong co buoc nao di qua quan tri vien.
 */

import { useState } from 'react';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SetupNotice, Spinner } from '@/components/site';
import { useAuth } from '@/lib/hooks';
import { useContent } from '@/lib/content';

export default function MyDataPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <MyData />;
}

function MyData() {
  const { session, loading } = useAuth();
  const c = useContent();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <Spinner label="Đang tải" />;

  if (!session) {
    return (
      <div className="shell-narrow py-20 text-center">
        <h1 className="display-sm mb-6">Cần đăng nhập</h1>
        <p className="muted mb-8 text-sm">
          Dữ liệu cá nhân chỉ xem được bởi chính chủ tài khoản.
        </p>
        <Link href="/dang-nhap" className="btn btn-solid">Đăng nhập</Link>
      </div>
    );
  }

  const uid = session.user.id;
  const email = session.user.email ?? null;

  /** Xuat du lieu ca nhan ra file JSON, khong can cho admin xu ly. */
  const exportData = async () => {
    const sb = getSupabase();
    if (!sb) return;

    setBusy(true);
    setErr(null);

    const [pr, pf, pv, fb, ou] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      sb.from('user_preferences').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('user_private').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('feedback_events').select('*').eq('user_id', uid),
      sb.from('outfits').select('*').eq('author_id', uid),
    ]);

    const blob = new Blob(
      [JSON.stringify({
        xuat_luc: new Date().toISOString(),
        email,
        ho_so: pr.data,
        so_thich: pf.data,
        du_lieu_rieng: pv.data,
        phan_hoi: fb.data,
        bai_dang: ou.data,
      }, null, 2)],
      { type: 'application/json' },
    );

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phoi-du-lieu-ca-nhan-${uid.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);

    setBusy(false);
    setMsg('Đã tải file dữ liệu về máy bạn.');
  };

  /** Xoa du lieu ca nhan. Di qua ham SQL de xoa dung va day du trong 1 giao dich. */
  const eraseData = async () => {
    const sb = getSupabase();
    if (!sb) return;

    if (!window.confirm(
      'Xoá toàn bộ dữ liệu cá nhân: ngày sinh, niên mệnh, gu đã chọn và lịch sử phản hồi.\n\n' +
      'Các bài bạn đã đăng vẫn được giữ nhưng chuyển sang khuyết danh.\n\nTiếp tục?'
    )) return;

    setBusy(true);
    setErr(null);

    const { error } = await sb.rpc('erase_my_personal_data');
    setBusy(false);

    if (error) { setErr(error.message); return; }
    setMsg('Đã xoá dữ liệu cá nhân.');
  };

  return (
    <div className="shell-narrow py-12 md:py-16">
      <p className="eyebrow mb-4">Quyền của bạn</p>
      <h1 className="display-sm mb-6" style={c.s('privacy.title')}>
        {c.t('privacy.title', 'Dữ liệu cá nhân của bạn')}
      </h1>

      <p className="muted mb-10 leading-relaxed" style={c.s('privacy.desc')}>
        {c.t(
          'privacy.desc',
          'Bạn có quyền xem, tải về và xoá dữ liệu cá nhân của mình bất cứ lúc nào, ' +
            'không cần chờ quản trị viên xử lý.',
        )}
      </p>

      {msg && <div className="notice notice-ok mb-6">{msg}</div>}
      {err && <div className="notice notice-danger mb-6">{err}</div>}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={exportData} disabled={busy} className="btn">
          Tải dữ liệu của tôi (JSON)
        </button>
        <button type="button" onClick={eraseData} disabled={busy} className="btn btn-danger">
          Xoá dữ liệu cá nhân
        </button>
      </div>

      <p className="muted-2 mt-8 text-sm leading-relaxed" style={c.s('privacy.warning')}>
        {c.t(
          'privacy.warning',
          'Xoá dữ liệu cá nhân sẽ xoá ngày sinh, niên mệnh, gu đã chọn và toàn bộ lịch sử ' +
            'phản hồi. Các bài bạn đã đăng công khai vẫn được giữ lại nhưng chuyển sang ' +
            'khuyết danh, để không làm vỡ những set đồ người khác đang xem.',
        )}
      </p>

      <p className="muted-2 mt-12 border-t pt-8 text-xs" style={{ borderColor: 'var(--line)' }}>
        <Link href="/ho-so" className="underline">Về trang hồ sơ</Link>
      </p>
    </div>
  );
}
