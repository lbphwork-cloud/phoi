'use client';

/**
 * San pham khong thuoc set do nao.
 *
 * VI SAO CAN MUC NAY
 *   Truoc day co mot trang "San pham" liet ke moi san pham. Bo trang do di thi
 *   san pham nao khong nam trong set nao se khong con duong nao nhin thay —
 *   chung van chiem cho trong database, van co anh tren Storage, ma khong ai
 *   biet chung ton tai. Do la ro ri du lieu am tham, kieu chi phat hien ra sau
 *   mot nam khi thac mac sao dung luong tang.
 *
 *   Chung sinh ra khi mot lan tao bai that bai giua chung: san pham da tao
 *   xong thi buoc gan vao set loi.
 *
 * MAC DINH THU GON, VA IM LANG KHI KHONG CO GI
 *   Khong co san pham mo coi nao thi khong hien gi ca. Mot muc luon hien voi
 *   so 0 chi lam nhieu mat.
 */

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useAsyncData } from '@/lib/hooks';
import { formatRelative, formatVnd } from '@/lib/format';
import type { Product } from '@/lib/supabase/types';

export function OrphanProducts() {
  const { data, loading, reload } = useAsyncData<Product[]>('admin-orphan-products', (sb) =>
    sb
      .from('products')
      .select('*, outfit_items(product_id)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data: r, error }) => {
        // PostgREST khong loc duoc theo "bang con rong" trong truy van, nen loc
        // o day. Gioi han 200 dong nen khong dang ke.
        const rows = (r as Array<Product & { outfit_items: unknown[] }> | null) ?? [];
        return { data: rows.filter((p) => (p.outfit_items ?? []).length === 0), error };
      }),
  );

  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = data ?? [];

  // Im lang khi khong co gi de bao.
  if (loading || rows.length === 0) return null;

  const remove = async (p: Product) => {
    if (!window.confirm(`Xoá "${p.name}"? Không thể hoàn lại.`)) return;

    const sb = getSupabase();
    if (!sb) return;

    setBusyId(p.id);
    setErr(null);

    const { error } = await sb.from('products').delete().eq('id', p.id);

    setBusyId(null);
    if (error) { setErr(error.message); return; }
    reload();
  };

  return (
    <section className="mt-12 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
      <button
        type="button"
        className="btn btn-sm btn-quiet"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Ẩn' : 'Xem'} sản phẩm không thuộc set nào ({rows.length})
      </button>

      {open && (
        <div className="mt-6">
          <p className="muted-2 mb-5 max-w-2xl text-xs leading-relaxed">
            Những sản phẩm này không nằm trong set đồ nào, thường là dấu vết của một lần
            tạo bài hỏng giữa chừng. Không ai nhìn thấy chúng ngoài trang này. Xoá đi
            cũng không ảnh hưởng bài nào.
          </p>

          {err && <div className="notice notice-danger mb-4">{err}</div>}

          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Ảnh</th>
                  <th>Tên</th>
                  <th>Giá</th>
                  <th>Tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="frame frame-square w-12">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt="" />
                        ) : (
                          <div className="frame frame-empty absolute inset-0">—</div>
                        )}
                      </div>
                    </td>
                    <td>{p.name}</td>
                    <td className="whitespace-nowrap">{formatVnd(p.price_vnd)}</td>
                    <td className="muted-2 whitespace-nowrap text-xs">
                      {formatRelative(p.created_at)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        disabled={busyId === p.id}
                        onClick={() => void remove(p)}
                      >
                        {busyId === p.id ? 'Đang xoá…' : 'Xoá'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
