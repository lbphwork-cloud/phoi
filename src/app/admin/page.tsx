'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { Spinner } from '@/components/site';
import { formatRelative } from '@/lib/format';

interface Counts {
  pending: number;
  published: number;
  needsRevision: number;
  drafts: number;
  products: number;
  seedProducts: number;
  users: number;
  clicks7d: number;
  deadLinks: number;
  openRequests: number;
}

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export default function AdminHome() {
  const [c, setC] = useState<Counts | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    let alive = true;

    // head: true + count: 'exact' chi lay SO LUONG, khong tai dong nao ve.
    // Quan trong voi han muc egress 5GB/thang cua goi Supabase mien phi.
    const rows = (table: string) => sb.from(table).select('*', { count: 'exact', head: true });
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    Promise.all([
      rows('outfits').eq('status', 'pending'),
      rows('outfits').eq('status', 'published'),
      rows('outfits').eq('status', 'needs_revision'),
      rows('outfits').eq('status', 'draft'),
      rows('products'),
      rows('products').eq('is_seed', true),
      rows('profiles'),
      rows('click_events').gte('created_at', weekAgo),
      rows('affiliate_links').eq('is_alive', false),
      rows('data_requests').eq('status', 'open'),
      sb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(15),
    ]).then((res) => {
      if (!alive) return;
      const n = (i: number) => res[i].count ?? 0;
      setC({
        pending: n(0), published: n(1), needsRevision: n(2), drafts: n(3),
        products: n(4), seedProducts: n(5), users: n(6),
        clicks7d: n(7), deadLinks: n(8), openRequests: n(9),
      });
      setAudit((res[10].data as AuditRow[]) ?? []);
      setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  if (loading || !c) return <Spinner />;

  return (
    <div className="flex flex-col gap-12">
      {/* ------------------------------------------------------------------ */}
      {/* Viec can lam ngay                                                  */}
      {/* ------------------------------------------------------------------ */}
      {(c.pending > 0 || c.deadLinks > 0 || c.openRequests > 0) && (
        <section>
          <h2 className="display-xs mb-4">Cần bạn xử lý</h2>
          <div className="flex flex-col gap-3">
            {c.pending > 0 && (
              <Todo href="/admin/kiem-duyet" label={`${c.pending} bài đang chờ duyệt`} />
            )}
            {c.deadLinks > 0 && (
              <Todo
                href="/admin/outfit"
                label={`${c.deadLinks} link affiliate có thể đã hỏng`}
                note="Link chết là mất tiền trực tiếp — ưu tiên cao hơn mọi việc khác. Mở set đồ ra để sửa link của từng món."
              />
            )}
            {c.openRequests > 0 && (
              <Todo href="/admin/nguoi-dung" label={`${c.openRequests} yêu cầu về dữ liệu cá nhân`} />
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="display-xs mb-4">Số liệu</h2>
        <div className="grid grid-cols-2 gap-px md:grid-cols-4" style={{ background: 'var(--line)' }}>
          <Stat label="Đang hiển thị" value={c.published} />
          <Stat label="Chờ duyệt" value={c.pending} />
          <Stat label="Cần sửa" value={c.needsRevision} />
          <Stat label="Bản nháp" value={c.drafts} />
          <Stat label="Sản phẩm" value={c.products} />
          <Stat label="Chưa thay dữ liệu thật" value={c.seedProducts} />
          <Stat label="Người dùng" value={c.users} />
          <Stat label="Click 7 ngày" value={c.clicks7d} />
        </div>

        {/*
          CHI CON MOT CHO DUY NHAT TREN CA WEBSITE nhac den du lieu dung tam, va
          no nam trong trang quan tri — noi chi ban nhin thay.

          Nhan "Du lieu mau" da bo khoi moi cho nguoi ngoai co the thay: the
          outfit, trang chi tiet, tung san pham, hang doi kiem duyet. Mot nguoi
          la doc duoc dong do se hieu la website chua co hang that.

          Nhung khong bo han thong tin: ban van can biet con bao nhieu mon chua
          thay, neu khong thi khong co gi nhac va chung se nam do mai.
        */}
        {c.seedProducts > 0 && (
          <div className="notice mt-4">
            Còn {c.seedProducts} sản phẩm chưa thay bằng hàng thật. Tên và giá đang là
            dữ liệu mô tả, link trỏ tới trang tìm kiếm của sàn. Mở set đồ trong{' '}
            <Link href="/admin/outfit" className="underline">trang outfit</Link> rồi sửa
            từng món bên trong. Người xem không thấy dòng này.
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="display-xs mb-1">Nhật ký thao tác</h2>
        <p className="muted-2 mb-4 text-sm">
          Ghi bởi hàm SECURITY DEFINER trong database. Không tài khoản nào — kể cả
          quản trị viên — chèn hay xoá được dòng nào qua API, nên nhật ký không thể
          bị làm giả.
        </p>

        {audit.length === 0 ? (
          <p className="muted-2 text-sm">Chưa có thao tác nào được ghi.</p>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="muted-2 whitespace-nowrap">{formatRelative(a.created_at)}</td>
                    <td><code className="text-xs">{a.action}</code></td>
                    <td className="muted-2 text-xs">{a.entity_type}</td>
                    <td className="muted-2 text-xs">
                      {a.detail && Object.keys(a.detail).length > 0
                        ? JSON.stringify(a.detail)
                        : '—'}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-5" style={{ background: 'var(--bg)' }}>
      <p className="eyebrow mb-1">{label}</p>
      <p className="display-sm">{value}</p>
    </div>
  );
}

function Todo({ href, label, note }: { href: string; label: string; note?: string }) {
  return (
    <Link href={href} className="notice notice-warn block hover:underline">
      <span className="font-medium">{label}</span>
      {note && <span className="muted-2 mt-1 block text-xs no-underline">{note}</span>}
    </Link>
  );
}
