'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { EmptyState, Spinner } from '@/components/site';
import { useAuth } from '@/lib/hooks';
import { formatDate, formatRelative } from '@/lib/format';
import type { Profile, UserRole } from '@/lib/supabase/types';
import { SortHeader, useTableSort, useSorted } from '@/components/SortHeader';

interface DataRequest {
  id: string;
  user_id: string;
  kind: string;
  note: string | null;
  status: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  /*
    TIM VA LOC CHO DANH SACH NGUOI DUNG.

    Bang nay khong co gioi han: cang nhieu nguoi dang ky thi no cang dai. Tim
    mot tai khoan cu the bang mat tren mot bang dai la viec khong lam duoc, va
    do dung la luc quan tri vien can tim — khi co ai do bao cao mot tai khoan.
  */
  const [q, setQ] = useState('');
  const [locQuyen, setLocQuyen] = useState<'all' | 'admin' | 'user'>('all');
  const sort = useTableSort<'name' | 'role' | 'joined'>('joined', 'desc');

  const loc = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter(
      (u) =>
        (locQuyen === 'all' || u.role === locQuyen) &&
        (!needle || (u.display_name ?? '').toLowerCase().includes(needle)),
    );
  }, [users, locQuyen, q]);

  const visible = useSorted(loc, sort, (u, k) => {
    switch (k) {
      case 'name': return u.display_name;
      case 'role': return u.role;
      case 'joined': return u.created_at;
    }
  });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    let alive = true;
    Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('data_requests').select('*').order('created_at', { ascending: false }).limit(100),
    ]).then(([u, r]) => {
      if (!alive) return;
      if (u.error) setError(u.error.message);
      setUsers((u.data as Profile[]) ?? []);
      setRequests((r.data as DataRequest[]) ?? []);
      setLoading(false);
    });

    return () => { alive = false; };
  }, [nonce]);

  /**
   * Doi quyen tai khoan.
   *
   * Phai di qua ham set_user_role() vi cot profiles.role da bi REVOKE quyen
   * UPDATE o migration 0002. Hai lop chan doc lap cho cung mot lo hong: neu
   * mot lop bi go bo do sai sot, lop kia van con.
   */
  const setRole = async (u: Profile, role: UserRole) => {
    const sb = getSupabase()!;

    if (u.id === session?.user.id && role !== 'admin') {
      setError('Không thể tự hạ quyền chính mình — làm vậy sẽ khoá hết quản trị viên ra ngoài.');
      return;
    }

    if (!window.confirm(`Đổi quyền của "${u.display_name}" thành ${role}?`)) return;

    setBusyId(u.id);
    setError(null);

    const { error: e } = await sb.rpc('set_user_role', { p_user_id: u.id, p_role: role });

    setBusyId(null);
    if (e) { setError(e.message); return; }
    setNonce((n) => n + 1);
  };

  const closeRequest = async (r: DataRequest, status: 'done' | 'rejected') => {
    const sb = getSupabase()!;
    setBusyId(r.id);

    const { error: e } = await sb
      .from('data_requests')
      .update({ status, handled_by: session?.user.id, handled_at: new Date().toISOString() })
      .eq('id', r.id);

    setBusyId(null);
    if (e) { setError(e.message); return; }
    setNonce((n) => n + 1);
  };

  if (loading) return <Spinner />;

  const open = requests.filter((r) => r.status === 'open');

  return (
    <div className="flex flex-col gap-14">
      {error && <div className="notice notice-danger">{error}</div>}

      {/* ------------------------------------------------------------------ */}
      {/* Yeu cau ve du lieu ca nhan (Nghi dinh 13/2023)                    */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h1 className="display-sm mb-1">Yêu cầu về dữ liệu cá nhân</h1>
        <p className="muted-2 mb-4 text-sm">
          Người dùng tự xuất và tự xoá dữ liệu được ngay trong trang hồ sơ, nên
          danh sách này thường trống. Nó chỉ có việc khi ai đó cần bạn can thiệp tay.
        </p>

        {open.length === 0 ? (
          <p className="muted-2 text-sm">Không có yêu cầu nào đang mở.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((r) => (
              <div key={r.id} className="notice notice-warn">
                <p className="eyebrow mb-1">
                  {r.kind === 'delete' ? 'Yêu cầu xoá' : r.kind === 'export' ? 'Yêu cầu xuất' : 'Yêu cầu sửa'}
                  {' · '}
                  {formatRelative(r.created_at)}
                </p>
                <p className="text-sm">{r.note ?? 'Không có ghi chú.'}</p>
                <p className="muted-2 mt-1 text-xs">Tài khoản: {r.user_id}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busyId === r.id}
                    onClick={() => closeRequest(r, 'done')}
                  >
                    Đã xử lý
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    disabled={busyId === r.id}
                    onClick={() => closeRequest(r, 'rejected')}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="display-sm mb-1">Người dùng</h2>
        <p className="muted-2 mb-4 text-sm">
          {users.length} tài khoản · {users.filter((u) => u.role === 'admin').length} quản trị viên.
          Ngày sinh và niên mệnh của người dùng KHÔNG hiển thị ở đây — bảng
          <code> user_private </code>chỉ cho chính chủ đọc, quản trị viên cũng không có quyền.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="field max-w-xs"
            placeholder="Tìm theo tên hiển thị"
            aria-label="Tìm người dùng theo tên hiển thị"
          />
          <select
            className="field max-w-40"
            value={locQuyen}
            onChange={(e) => setLocQuyen(e.target.value as 'all' | 'admin' | 'user')}
            aria-label="Lọc theo quyền"
          >
            <option value="all">Mọi quyền</option>
            <option value="admin">Quản trị viên</option>
            <option value="user">Người dùng</option>
          </select>
          {(q.trim() || locQuyen !== 'all') && (
            <button type="button" className="btn btn-sm btn-quiet"
                    onClick={() => { setQ(''); setLocQuyen('all'); }}>
              Bỏ lọc
            </button>
          )}
          <p className="muted-2 text-sm">{visible.length}/{users.length} tài khoản</p>
        </div>

        {visible.length === 0 ? (
          <EmptyState title={users.length === 0 ? 'Chưa có tài khoản nào' : 'Không có tài khoản nào khớp'} />
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <SortHeader sort={sort} colKey="name">Tên hiển thị</SortHeader>
                  <SortHeader sort={sort} colKey="role">Quyền</SortHeader>
                  <SortHeader sort={sort} colKey="joined">Tham gia</SortHeader>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="font-medium">{u.display_name}</span>
                      {u.id === session?.user.id && (
                        <span className="tag tag-quiet ml-2">bạn</span>
                      )}
                      <span className="muted-2 block text-xs">{u.id}</span>
                    </td>
                    <td>
                      <span className={`tag ${u.role === 'admin' ? 'tag-ok' : 'tag-quiet'}`}>
                        {u.role === 'admin' ? 'Quản trị' : 'Người dùng'}
                      </span>
                    </td>
                    <td className="muted-2 whitespace-nowrap text-xs">{formatDate(u.created_at)}</td>
                    <td>
                      {u.role === 'admin' ? (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          disabled={busyId === u.id || u.id === session?.user.id}
                          onClick={() => setRole(u, 'user')}
                        >
                          Hạ về người dùng
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          disabled={busyId === u.id}
                          onClick={() => setRole(u, 'admin')}
                        >
                          Cấp quyền quản trị
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
