'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { EmptyState, SetupNotice, Spinner } from '@/components/site';
import { StatusTag } from '@/components/outfit';
import { useAsyncData, useAuth, useTaxonomy } from '@/lib/hooks';
import { useContent } from '@/lib/content';
import { formatRelative, formatVnd } from '@/lib/format';
import type { Outfit } from '@/lib/supabase/types';

export default function MyPostsPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <MyPosts />;
}

function MyPosts() {
  const { session, loading: authLoading } = useAuth();
  const tax = useTaxonomy();
  const c = useContent();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const uid = session?.user.id ?? '';

  // useAsyncData suy ra trang thai loading tu khoa thay vi goi setLoading —
  // xem chu thich cua hook trong src/lib/hooks.ts.
  const { data, loading, error: loadError, reload } = useAsyncData<Outfit[]>(
    uid,
    (sb) =>
      sb
        .from('outfits')
        .select('*')
        .eq('author_id', uid)
        .order('created_at', { ascending: false })
        .then(({ data: rows, error }) => ({
          data: (rows as Outfit[] | null) ?? [],
          error,
        })),
    // Chua dang nhap thi khong goi truy van: author_id = '' se loi o Postgres.
    Boolean(uid),
  );

  const rows = data ?? [];
  const error = actionError ?? loadError;

  if (authLoading || loading) return <Spinner />;

  if (!session) {
    return (
      <div className="shell-narrow py-20 text-center">
        <h1 className="display-sm mb-6">Cần đăng nhập</h1>
        <Link href="/dang-nhap" className="btn btn-solid">Đăng nhập</Link>
      </div>
    );
  }

  /** Gui duyet lai. Tac gia chi duoc dat 'pending' — trigger database chan
      moi trang thai khac, nen day la thao tac duy nhat co the lam. */
  const resubmit = async (o: Outfit) => {
    const sb = getSupabase()!;
    setBusyId(o.id);
    setActionError(null);

    const { error: e } = await sb.from('outfits').update({ status: 'pending' }).eq('id', o.id);

    setBusyId(null);
    if (e) { setActionError(e.message); return; }
    reload();
  };

  /** Rut bai ve nhap. */
  const withdraw = async (o: Outfit) => {
    const sb = getSupabase()!;
    setBusyId(o.id);
    const { error: e } = await sb.from('outfits').update({ status: 'draft' }).eq('id', o.id);
    setBusyId(null);
    if (e) { setActionError(e.message); return; }
    reload();
  };

  /**
   * Xoa han mot bai cua chinh minh.
   *
   * Truoc day chinh sach trong database chi cho xoa bai o trang thai nhap, nen
   * nut nay cung chi hien voi ban nhap. Nguoi gui duyet mot bai roi doi y thi
   * khong con duong nao rut lai. Migration 0017 mo quyen cho moi trang thai
   * TRU 'hidden' — bai bi an vi vi pham ma cho xoa thi nguoi vi pham chi can
   * bam xoa la mat dau vet kiem duyet.
   */
  const remove = async (o: Outfit) => {
    const warn =
      o.status === 'published'
        ? `Xoá "${o.title}"? Bài đang hiển thị công khai và sẽ biến mất khỏi trang khám phá ngay. Không thể hoàn lại.`
        : `Xoá "${o.title}"? Không thể hoàn lại.`;
    if (!window.confirm(warn)) return;

    const sb = getSupabase()!;
    setBusyId(o.id);
    const { error: e } = await sb.from('outfits').delete().eq('id', o.id);
    setBusyId(null);
    if (e) { setActionError(e.message); return; }
    reload();
  };

  const groups: Array<{ label: string; test: (o: Outfit) => boolean }> = [
    { label: 'Cần sửa', test: (o) => o.status === 'needs_revision' },
    { label: 'Chờ duyệt', test: (o) => o.status === 'pending' },
    { label: 'Đang hiển thị', test: (o) => o.status === 'published' },
    { label: 'Bản nháp', test: (o) => o.status === 'draft' },
    { label: 'Khác', test: (o) => ['rejected', 'hidden', 'approved'].includes(o.status) },
  ];

  return (
    <div className="shell py-12 md:py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-4">
            <span style={c.s('myposts.title')}>{c.t('myposts.title', 'Bài của tôi')}</span>
          </p>
          <h1 className="display-sm">{rows.length} bài</h1>
          <p className="muted mt-3 max-w-2xl text-sm leading-relaxed">
            <span style={c.s('myposts.subtitle')}>
              {c.t('myposts.subtitle', '')}
            </span>
          </p>
        </div>
        <Link href="/tao-bai" className="btn btn-solid">Tạo bài mới</Link>
      </div>

      {error && <div className="notice notice-danger mb-8">{error}</div>}

      {rows.length === 0 ? (
        <EmptyState title={c.t('myposts.empty', 'Bạn chưa có bài nào')}>
          <Link href="/tao-bai" className="underline">Tạo bài phối đồ đầu tiên</Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-14">
          {groups.map((g) => {
            const list = rows.filter(g.test);
            if (list.length === 0) return null;

            return (
              <section key={g.label}>
                <h2 className="eyebrow mb-4 border-b pb-2" style={{ borderColor: 'var(--line)' }}>
                  {g.label} · {list.length}
                </h2>

                <div className="flex flex-col">
                  {list.map((o) => (
                    <div
                      key={o.id}
                      className="flex flex-col gap-4 border-b py-5 sm:flex-row sm:items-center"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <div className="frame frame-square w-20 shrink-0">
                        {o.hero_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.hero_image_url} alt="" />
                        ) : (
                          <div className="frame frame-empty absolute inset-0">—</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <StatusTag status={o.status} />
                          {o.ai_generated && <span className="tag tag-warn">Ảnh AI</span>}
                        </div>

                        <p className="font-medium">{o.title}</p>
                        <p className="muted-2 text-xs">
                          {tax.styleLabel(o.style_slug)} · {tax.occasionLabel(o.occasion_slug)} ·{' '}
                          {formatVnd(o.total_price_vnd)} · tạo {formatRelative(o.created_at)}
                        </p>

                        {/* Ly do admin yeu cau sua — day la thu tac gia can thay ro nhat. */}
                        {o.review_note && (
                          <div className="notice notice-warn mt-2">
                            <p className="eyebrow mb-1">Ghi chú kiểm duyệt</p>
                            {o.review_note}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 sm:w-56 sm:justify-end">
                        {o.status === 'published' && (
                          <Link href={`/outfit/${o.slug}`} className="btn btn-sm">Xem</Link>
                        )}
                        {(o.status === 'draft' || o.status === 'needs_revision' || o.status === 'rejected') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-solid"
                            disabled={busyId === o.id}
                            onClick={() => resubmit(o)}
                          >
                            Gửi duyệt
                          </button>
                        )}
                        {o.status === 'pending' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busyId === o.id}
                            onClick={() => withdraw(o)}
                          >
                            Rút về nháp
                          </button>
                        )}
                        {/* Moi trang thai deu xoa duoc, tru bai bi an vi vi pham.
                            Chinh sach trong database cung chan dung nhu vay, nen
                            nut nay khong the tu no mo them quyen gi. */}
                        {o.status !== 'hidden' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={busyId === o.id}
                            onClick={() => remove(o)}
                          >
                            Xoá
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="notice mt-16">
        <p className="eyebrow mb-2">Về quy trình duyệt</p>
        <p className="muted text-sm leading-relaxed">
          Bản nháp → Chờ duyệt → Cần sửa / Duyệt / Từ chối → Công khai. Sau khi bài
          đã được duyệt, nếu bạn sửa ảnh đại diện, thêm bớt sản phẩm hoặc đổi link
          affiliate thì bài tự động quay lại trạng thái chờ duyệt. Quy tắc này được
          thực thi ngay trong database, không phải ở giao diện — nên nó áp dụng kể
          cả khi gọi trực tiếp qua API.
        </p>
      </div>
    </div>
  );
}
