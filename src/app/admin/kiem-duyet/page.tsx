'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { EmptyState, Spinner } from '@/components/site';
import { StatusTag } from '@/components/outfit';
import { useAsyncData, useTaxonomy } from '@/lib/hooks';
import { formatRelative, formatVnd } from '@/lib/format';
import type { OutfitWithItems, ReviewAction } from '@/lib/supabase/types';

/**
 * Hang doi kiem duyet.
 *
 * Ba nut duyet deu goi CUNG mot ham SQL review_outfit(), khong tu UPDATE bang
 * outfits. Ly do: ham do lam ba viec trong MOT giao dich — doi trang thai, ghi
 * post_reviews, ghi admin_audit_log. Neu tu UPDATE thi rat de doi trang thai
 * xong ma quen ghi ly do, va nhat ky se co lo hong.
 *
 * Ham cung bat buoc phai co ly do khi chon "yeu cau sua" — kiem tra do nam
 * trong SQL, khong phai o form nay.
 */
export default function ModerationPage() {
  const tax = useTaxonomy();

  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const { data, loading, error: loadError, reload } = useAsyncData<OutfitWithItems[]>(
    filter,
    (sb) => {
      let q = sb
        .from('outfits')
        .select('*, outfit_items(*, products(*), affiliate_links(*))')
        // nullsFirst: false de bai da co moc gui duyet len truoc — hang doi
        // phai theo thu tu ai gui truoc duoc xet truoc.
        .order('submitted_at', { ascending: true, nullsFirst: false })
        .limit(60);

      q = filter === 'pending'
        ? q.eq('status', 'pending')
        : q.in('status', ['pending', 'needs_revision', 'rejected', 'hidden']);

      return q.then(({ data: r, error }) => ({
        data: (r as OutfitWithItems[] | null) ?? [],
        error,
      }));
    },
  );

  const rows = data ?? [];
  const error = actionError ?? loadError;

  const review = async (id: string, action: ReviewAction) => {
    const sb = getSupabase()!;
    const reason = (reasons[id] ?? '').trim();

    if (action === 'request_changes' && !reason) {
      setActionError('Phải nhập lý do khi yêu cầu sửa. Tác giả cần biết phải sửa gì.');
      return;
    }

    setBusyId(id);
    setActionError(null);

    const { error: e } = await sb.rpc('review_outfit', {
      p_outfit_id: id,
      p_action: action,
      p_reason: reason || null,
    });

    setBusyId(null);
    if (e) { setActionError(e.message); return; }

    setReasons((r) => ({ ...r, [id]: '' }));
    reload();
  };

  /** An noi dung vi pham. 'hidden' la trang thai khoa: tac gia khong tu mo lai duoc. */
  const hide = async (id: string) => {
    const sb = getSupabase()!;
    const reason = (reasons[id] ?? '').trim();
    if (!reason) { setActionError('Nhập lý do ẩn để lưu vào nhật ký.'); return; }

    setBusyId(id);
    const { error: e } = await sb
      .from('outfits')
      .update({ status: 'hidden', review_note: reason })
      .eq('id', id);

    if (!e) {
      await sb.rpc('log_admin_action', {
        p_action: 'outfit.hide',
        p_entity_type: 'outfit',
        p_entity_id: id,
        p_detail: { reason },
      });
    }

    setBusyId(null);
    if (e) { setActionError(e.message); return; }
    reload();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-sm">Kiểm duyệt</h1>
          <p className="muted-2 text-sm">{rows.length} bài trong danh sách</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="chip"
            aria-pressed={filter === 'pending'}
            onClick={() => setFilter('pending')}
          >
            Chỉ chờ duyệt
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Tất cả cần chú ý
          </button>
        </div>
      </div>

      {error && <div className="notice notice-danger mb-6">{error}</div>}

      {rows.length === 0 ? (
        <EmptyState title="Không có bài nào cần duyệt">
          Hàng đợi trống. Bài mới sẽ hiện ở đây khi có người gửi duyệt.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {rows.map((o) => (
            <article key={o.id} className="border p-5" style={{ borderColor: 'var(--line)' }}>
              <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
                <div>
                  <div className="frame">
                    {o.hero_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.hero_image_url} alt="" />
                    ) : (
                      <div className="frame frame-empty absolute inset-0">Chưa có ảnh</div>
                    )}
                  </div>
                  {o.ai_generated && (
                    <p className="tag tag-warn mt-2">Ảnh tạo bởi AI</p>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusTag status={o.status} />
                    {o.is_seed && <span className="tag tag-quiet">Dữ liệu mẫu</span>}
                    <span className="muted-2 text-xs">
                      {o.submitted_at ? `gửi ${formatRelative(o.submitted_at)}` : 'chưa gửi'}
                    </span>
                  </div>

                  <h2 className="display-xs mb-1">{o.title}</h2>
                  <p className="muted-2 mb-3 text-xs">
                    {tax.styleLabel(o.style_slug)} · {tax.occasionLabel(o.occasion_slug)} ·{' '}
                    {formatVnd(o.total_price_vnd)} · {o.outfit_items?.length ?? 0} món
                  </p>

                  {o.description && <p className="muted mb-4 text-sm">{o.description}</p>}

                  {/* Danh sach san pham va link — day la thu can kiem tra ky nhat:
                      ten, gia, va ten mien cua link.                            */}
                  <div className="scroll-x mb-4">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Vai trò</th>
                          <th>Sản phẩm</th>
                          <th>Giá</th>
                          <th>Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(o.outfit_items ?? []).map((it) => (
                          <tr key={it.id}>
                            <td className="muted-2 text-xs">{it.role}</td>
                            <td>{it.products?.name ?? '—'}</td>
                            <td className="whitespace-nowrap">{formatVnd(it.products?.price_vnd ?? null)}</td>
                            <td className="text-xs">
                              {it.affiliate_links ? (
                                <>
                                  <span className="tag tag-quiet">
                                    {it.affiliate_links.resolved_host ??
                                      it.affiliate_links.platform}
                                  </span>{' '}
                                  <a
                                    href={it.affiliate_links.url}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="underline"
                                  >
                                    mở
                                  </a>
                                  {it.affiliate_links.resolved_host === null && (
                                    <span className="muted-2 block">chưa resolve</span>
                                  )}
                                </>
                              ) : (
                                <span className="hint-error">thiếu link</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <label className="label" htmlFor={`reason-${o.id}`}>
                    Lý do (bắt buộc khi yêu cầu sửa hoặc ẩn)
                  </label>
                  <textarea
                    id={`reason-${o.id}`}
                    value={reasons[o.id] ?? ''}
                    onChange={(e) => setReasons((r) => ({ ...r, [o.id]: e.target.value }))}
                    className="field mb-4"
                    rows={2}
                    placeholder="Ví dụ: ảnh mờ, cần ảnh rõ hơn. Hoặc: link sản phẩm thứ 2 đã hết hàng."
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-solid"
                      disabled={busyId === o.id}
                      onClick={() => review(o.id, 'approve')}
                    >
                      Duyệt và đăng
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busyId === o.id}
                      onClick={() => review(o.id, 'request_changes')}
                    >
                      Yêu cầu sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={busyId === o.id}
                      onClick={() => review(o.id, 'reject')}
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={busyId === o.id}
                      onClick={() => hide(o.id)}
                    >
                      Ẩn vì vi phạm
                    </button>
                    <Link href={`/outfit/${o.slug}`} className="btn btn-quiet btn-sm">
                      Xem như người dùng
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
