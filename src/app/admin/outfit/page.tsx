'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { EmptyState, Spinner } from '@/components/site';
import { StatusTag } from '@/components/outfit';
import { AdminOutfitItems } from '@/components/AdminOutfitItems';
import { OrphanProducts } from '@/components/AdminOrphanProducts';
import { deleteOutfit, confirmDelete } from '@/lib/deleteOutfit';
import { useAsyncData, useTaxonomy } from '@/lib/hooks';
import { formatRelative, formatVnd } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/supabase/types';
import type { Outfit, OutfitStatus } from '@/lib/supabase/types';

const FILTERS: Array<OutfitStatus | 'all'> = [
  'all', 'published', 'pending', 'needs_revision', 'draft', 'hidden', 'rejected',
];

export default function AdminOutfitsPage() {
  const tax = useTaxonomy();
  const [status, setStatus] = useState<OutfitStatus | 'all'>('all');
  const [q, setQ] = useState('');
  /** Set do dang mo xem san pham ben trong. Moi luc chi mot. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error: loadError, reload } = useAsyncData<Outfit[]>(
    'admin-outfits',
    (sb) =>
      sb
        .from('outfits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400)
        .then(({ data: r, error }) => ({ data: (r as Outfit[] | null) ?? [], error })),
  );

  // Boc trong useMemo: `data ?? []` tao mot mang MOI moi lan render, lam
  // useMemo cua `visible` ben duoi khong bao gio dung duoc ket qua da tinh.
  const rows = useMemo(() => data ?? [], [data]);
  const error = actionError ?? loadError;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!needle || r.title.toLowerCase().includes(needle)),
    );
  }, [rows, status, q]);

  /**
   * Doi trang thai truc tiep. Chi admin lam duoc: cot status van nam trong
   * danh sach cot duoc UPDATE, nhung trigger enforce_outfit_status() chi cho
   * phep dat 'published' / 'hidden' khi is_admin() dung.
   */
  const setStatusOf = async (o: Outfit, next: OutfitStatus) => {
    const sb = getSupabase()!;
    setBusyId(o.id);
    setActionError(null);

    const { error: e } = await sb.from('outfits').update({ status: next }).eq('id', o.id);

    if (!e) {
      await sb.rpc('log_admin_action', {
        p_action: `outfit.status.${next}`,
        p_entity_type: 'outfit',
        p_entity_id: o.id,
        p_detail: { from: o.status, to: next },
      });
    }

    setBusyId(null);
    if (e) { setActionError(e.message); return; }
    reload();
  };

  /** Xoa han mot bai. Hoi xac nhan roi ghi nhat ky — xem src/lib/deleteOutfit.ts. */
  const removeOutfit = async (o: Outfit) => {
    if (!confirmDelete(o.title)) return;

    setBusyId(o.id);
    setActionError(null);

    const r = await deleteOutfit(o);

    setBusyId(null);
    if (!r.ok) { setActionError(r.message ?? 'Không xoá được.'); return; }

    // Dong vua xoa co the dang mo phan san pham ben trong.
    setOpenId((x) => (x === o.id ? null : x));
    reload();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-sm mb-1">Outfit</h1>
          <p className="muted-2 text-sm">{rows.length} bài · {visible.length} đang hiện</p>
        </div>
        <Link href="/tao-bai" className="btn btn-solid btn-sm">Tạo outfit mới</Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field max-w-xs"
          placeholder="Tìm theo tên"
        />
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            aria-pressed={status === f}
            onClick={() => setStatus(f)}
          >
            {f === 'all' ? 'Tất cả' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error && <div className="notice notice-danger mb-6">{error}</div>}

      {visible.length === 0 ? (
        <EmptyState title="Không có outfit nào khớp" />
      ) : (
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Tên</th>
                <th>Phong cách</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th>Tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <Fragment key={o.id}>
                <tr
                  className="cursor-pointer"
                  onClick={() => setOpenId((x) => (x === o.id ? null : o.id))}
                >
                  <td>
                    <div className="frame frame-square w-14">
                      {o.hero_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.hero_image_url} alt="" />
                      ) : (
                        <div className="frame frame-empty absolute inset-0">—</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="font-medium">
                      <span
                        className="muted-2 mr-2 inline-block text-xs transition-transform"
                        style={openId === o.id ? { transform: 'rotate(180deg)' } : undefined}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                      {o.title}
                    </span>
                    <span className="muted-2 block text-xs">
                      {o.is_seed && 'dữ liệu mẫu · '}
                      {o.ai_generated && 'ảnh AI · '}
                      {o.view_count} lượt xem
                    </span>
                  </td>
                  <td className="muted-2 text-xs">{tax.styleLabel(o.style_slug)}</td>
                  <td className="whitespace-nowrap">{formatVnd(o.total_price_vnd)}</td>
                  <td><StatusTag status={o.status} /></td>
                  <td className="muted-2 whitespace-nowrap text-xs">{formatRelative(o.created_at)}</td>
                  {/* Cac nut o day KHONG duoc lam mo/dong dong. stopPropagation
                      chan su kien bam noi len hang cha. */}
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">
                      {o.status !== 'published' && (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          disabled={busyId === o.id}
                          onClick={() => setStatusOf(o, 'published')}
                        >
                          Đăng
                        </button>
                      )}
                      {o.status === 'published' && (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          disabled={busyId === o.id}
                          onClick={() => setStatusOf(o, 'hidden')}
                        >
                          Ẩn
                        </button>
                      )}
                      <Link href={`/outfit/${o.slug}`} className="btn btn-quiet btn-sm">Xem</Link>
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm btn-danger"
                        disabled={busyId === o.id}
                        onClick={() => void removeOutfit(o)}
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Cac mon trong set, mo ra ngay duoi dong. Truoc day phai sang
                    mot trang "San pham" rieng — o do nhin mot dong san pham
                    khong biet no thuoc bai nao, nen sua thi khong biet minh dang
                    lam hong bai nao. */}
                {openId === o.id && (
                  <tr>
                    <td colSpan={7} className="bg-transparent">
                      <div className="py-4">
                        <p className="eyebrow mb-4">Sản phẩm trong set</p>
                        <AdminOutfitItems outfitId={o.id} />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted-2 mt-8 text-xs leading-relaxed">
        Bấm vào một dòng để mở các sản phẩm bên trong và sửa trực tiếp. Mọi thao tác
        đổi trạng thái ở đây đều được ghi vào nhật ký quản trị. Để duyệt bài kèm lý do
        cho tác giả, dùng trang{' '}
        <Link href="/admin/kiem-duyet" className="underline">Kiểm duyệt</Link> — trang đó
        ghi cả lý do vào hồ sơ bài đăng để tác giả đọc được.
      </p>

      <OrphanProducts />
    </div>
  );
}
