'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { EmptyState, Spinner } from '@/components/site';
import { StatusTag } from '@/components/outfit';
import { AdminOutfitItems } from '@/components/AdminOutfitItems';
import { OrphanProducts } from '@/components/AdminOrphanProducts';
import { SortHeader, useTableSort, useSorted } from '@/components/SortHeader';
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
  /** Loc theo phong cach. 'all' = khong loc. */
  const [style, setStyle] = useState<string>('all');
  const [q, setQ] = useState('');
  const sort = useTableSort<'title' | 'style' | 'price' | 'status' | 'created'>('created', 'desc');
  /** Set do dang mo xem san pham ben trong. Moi luc chi mot. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Cac bai dang duoc tich de xoa mot lan.
   *
   * Giu ID chu khong giu ca dong du lieu: danh sach co the duoc tai lai giua
   * chung, va luc do cac dong cu tro thanh doi tuong khac. ID thi khong doi.
   */
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [xoaNhieuBusy, setXoaNhieuBusy] = useState(false);
  const [tienDo, setTienDo] = useState<string | null>(null);

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

  const loc = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (style === 'all' || r.style_slug === style) &&
        (!needle || r.title.toLowerCase().includes(needle)),
    );
  }, [rows, status, style, q]);

  const visible = useSorted(loc, sort, (r, k) => {
    switch (k) {
      case 'title': return r.title;
      case 'style': return tax.styleLabel(r.style_slug);
      case 'price': return r.total_price_vnd;
      case 'status': return STATUS_LABEL[r.status];
      case 'created': return r.created_at;
    }
  });

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

  const doiChon = (id: string) =>
    setChon((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const dangHienDuocChonHet = visible.length > 0 && visible.every((o) => chon.has(o.id));

  /**
   * Xoa tat ca bai dang duoc tich.
   *
   * XOA LAN LUOT, KHONG SONG SONG. Moi lan xoa con ghi mot dong nhat ky quan
   * tri va go cac ban ghi lien quan; ban ra hai chuc yeu cau cung luc chi de
   * xong nhanh hon vai giay la doi lay nguy co dinh gioi han goi va bo lai
   * mot nua cong viec do dang.
   *
   * BAO SO DA XOA KHI CO LOI. Dung lai giua chung ma khong noi da xoa duoc bao
   * nhieu thi nguoi dung khong biet minh dang o dau, va bam lai lan nua la xoa
   * chong len.
   */
  const xoaCacBaiDaChon = async () => {
    const ds = visible.filter((o) => chon.has(o.id));
    if (ds.length === 0) return;

    const ok = window.confirm(
      `Xoá ${ds.length} bài? Không khôi phục được.\n\n`
        + ds.slice(0, 8).map((o) => `· ${o.title}`).join('\n')
        + (ds.length > 8 ? `\n· … và ${ds.length - 8} bài nữa` : ''),
    );
    if (!ok) return;

    setXoaNhieuBusy(true);
    setActionError(null);

    let xong = 0;
    for (const o of ds) {
      setTienDo(`Đang xoá ${xong + 1}/${ds.length}: ${o.title}`);
      const r = await deleteOutfit(o);
      if (!r.ok) {
        setActionError(
          `Đã xoá ${xong}/${ds.length} bài rồi thì dừng vì lỗi ở "${o.title}": `
            + (r.message ?? 'không rõ nguyên nhân'),
        );
        break;
      }
      xong++;
    }

    setTienDo(null);
    setXoaNhieuBusy(false);
    setChon(new Set());
    setOpenId(null);
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

      {/*
        LOC THEO PHONG CACH.

        Danh sach nay len toi 400 dong va nam trong mot bang. Muon sua ba bai
        workwear thi truoc day phai doc het ca bang de tim ra chung — trong khi
        phong cach da la mot cot san trong du lieu.

        Dung <select> chu khong phai chip nhu bo loc trang thai: co chin phong
        cach, chin cai chip nua se lam hang bo loc dai gap doi va day ca bang
        xuong duoi man hinh.
      */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="label mb-0" htmlFor="style-filter">Phong cách</label>
        <select
          id="style-filter"
          className="field max-w-xs"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          <option value="all">Tất cả phong cách</option>
          {tax.styles.map((st) => (
            <option key={st.slug} value={st.slug}>{st.label}</option>
          ))}
        </select>

        {(style !== 'all' || status !== 'all' || q.trim()) && (
          <button
            type="button"
            className="btn btn-sm btn-quiet"
            onClick={() => { setStyle('all'); setStatus('all'); setQ(''); }}
          >
            Bỏ lọc
          </button>
        )}

        <p className="muted-2 text-sm">
          {visible.length}/{rows.length} set đồ
        </p>
      </div>

      {error && <div className="notice notice-danger mb-6">{error}</div>}

      {/*
        THANH THAO TAC HANG LOAT, chi hien khi CO tich.

        Bam dinh dau danh sach: tich mot bai o dau bang roi cuon xuong tich
        them bai o cuoi, nut xoa van o trong tam mat. Neu de no o mot cho co
        dinh thi voi 400 dong no se nam ngoai man hinh gan nhu ca thoi gian.
      */}
      {chon.size > 0 && (
        <div
          className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 border px-4 py-3"
          style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}
        >
          <span className="text-sm font-medium">Đã chọn {chon.size} bài</span>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={xoaNhieuBusy}
            onClick={() => void xoaCacBaiDaChon()}
          >
            {xoaNhieuBusy ? 'Đang xoá…' : `Xoá ${chon.size} bài`}
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={xoaNhieuBusy}
            onClick={() => setChon(new Set())}
          >
            Bỏ chọn
          </button>
          {tienDo && <span className="muted-2 text-xs">{tienDo}</span>}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState title="Không có outfit nào khớp" />
      ) : (
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                {/* Tich het / bo tich het cho nhung dong DANG HIEN, khong phai
                    toan bo 400 bai: nguoi dung loc lai roi tich "tat ca" ma no
                    om ca nhung bai dang bi loc di la mot cai bay that su. */}
                <th style={{ width: '1%' }}>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả bài đang hiện"
                    checked={dangHienDuocChonHet}
                    onChange={() =>
                      setChon(dangHienDuocChonHet ? new Set() : new Set(visible.map((o) => o.id)))
                    }
                  />
                </th>
                <th>Ảnh</th>
                <SortHeader sort={sort} colKey="title">Tên</SortHeader>
                <SortHeader sort={sort} colKey="style">Phong cách</SortHeader>
                <SortHeader sort={sort} colKey="price">Giá</SortHeader>
                <SortHeader sort={sort} colKey="status">Trạng thái</SortHeader>
                <SortHeader sort={sort} colKey="created">Tạo</SortHeader>
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
                  {/* O tich khong duoc lam mo/dong dong — bam vao no la dang
                      chon bai, khong phai dang muon xem cac mon ben trong. */}
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${o.title}`}
                      checked={chon.has(o.id)}
                      onChange={() => doiChon(o.id)}
                    />
                  </td>
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
                    <td colSpan={8} className="bg-transparent">
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
