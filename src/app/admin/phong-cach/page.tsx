'use client';

/**
 * Sap xep va doi ten cac phong cach.
 *
 * COT `sort_order` DI TOI DAU
 *   Thu tu o day quyet dinh thu tu chip loc o trang Kham pha va thu tu o chon
 *   gu o trang Ho so. Truoc day muon doi phai viet mot migration; gio doi tren
 *   trang nay.
 *
 * KHONG PHAI THU TU CAC KHOI O TRANG CHU
 *   Trang chu co danh sach rieng — o "Cac phong cach hien o trang chu" ben
 *   trang Noi dung — vi trang chu chi trung bay vai phong cach chu khong hien
 *   het. Hai thu tu nay CO CHU Y de tach roi: thu tu bo loc va thu tu trung bay
 *   la hai quyet dinh khac nhau. Cot giua cho biet phong cach nao dang o trang
 *   chu de khong phai nho.
 *
 * THU TU DANG SUA GIU TRONG `order`, KHONG COPY DU LIEU RA STATE
 *   `order` chi la danh sach ma, dat CHONG len thu tu that. Khong co buoc "chep
 *   du lieu vua tai ve vao state" nen khong bao gio co canh man hinh hien ban
 *   cu sau khi tai lai. Chua dong vao thi `order` la null va man hinh dung
 *   thang thu tu cua database.
 *
 * LUU THU TU MOT LAN, LUU TEN TUNG DONG
 *   Thu tu la MOT quyet dinh trai tren nhieu dong nen luu mot lan. Ten thi moi
 *   dong mot y nen luu rieng — hong dong nao biet ngay dong do.
 *
 * DANH SO LAI TU 1 KHI LUU
 *   Khong hoan doi hai so cho nhau ma danh lai toan bo 1..N theo thu tu dang
 *   thay tren man hinh. Cac so hien tai co the thua ke tu migration cu va cach
 *   quang nhau (Pha cach tung mang so 90); danh lai mot the thi khong bao gio
 *   con hai dong cung so hay nhay bac.
 */

import { useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { useAsyncData } from '@/lib/hooks';
import type { Style } from '@/lib/supabase/types';
import { Spinner, EmptyState } from '@/components/site';

interface Loaded {
  styles: Style[];
  /** So set do dang thuoc tung phong cach, tra theo ma phong cach. */
  counts: Record<string, number>;
  /** Ma cac phong cach dang co khoi rieng o trang chu. */
  onHome: string[];
}

export default function StyleAdminPage() {
  const { data, loading, error, reload } = useAsyncData<Loaded>(
    'admin-styles',
    async (sb) => {
      const [styleRes, contentRes] = await Promise.all([
        sb.from('styles').select('*').order('sort_order'),
        sb.from('site_content').select('value').eq('key', 'home.styles.list').maybeSingle(),
      ]);

      if (styleRes.error) return { data: null, error: styleRes.error };

      const styles = (styleRes.data as Style[]) ?? [];

      // Dem so set do bang HEAD: chi lay con so, khong keo ve dong du lieu nao.
      // Van nhe khi so set do len hang nghin.
      const pairs = await Promise.all(
        styles.map(async (s) => {
          const { count } = await sb
            .from('outfits')
            .select('slug', { count: 'exact', head: true })
            .eq('style_slug', s.slug);
          return [s.slug, count ?? 0] as const;
        }),
      );

      return {
        data: {
          styles,
          counts: Object.fromEntries(pairs),
          onHome: String(contentRes.data?.value ?? '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        },
        error: null,
      };
    },
  );

  // Thu tu dang sua, dat chong len thu tu that. null = chua dong vao.
  const [order, setOrder] = useState<string[] | null>(null);
  const [draftLabel, setDraftLabel] = useState<Record<string, string>>({});

  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savedOrder, setSavedOrder] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <Spinner label="Đang tải phong cách" />;

  if (error) {
    return (
      <EmptyState title="Không tải được danh sách phong cách">{error}</EmptyState>
    );
  }

  if (!data || data.styles.length === 0) {
    return (
      <EmptyState title="Chưa có phong cách nào">
        Chạy <code>npm run db:apply</code> để nạp danh sách phong cách.
      </EmptyState>
    );
  }

  const base = data.styles;

  // Thu tu dang hien. Loc theo danh sach vua tai ve chu khong tin `order` mu
  // quang: neu co ai vua them mot phong cach moi o may khac thi no van hien ra
  // (o cuoi) thay vi bien mat.
  const rows: Style[] = order
    ? [
        ...order.map((slug) => base.find((s) => s.slug === slug)).filter((s): s is Style => !!s),
        ...base.filter((s) => !order.includes(s.slug)),
      ]
    : base;

  const orderDirty = order !== null && rows.some((s, i) => s.slug !== base[i]?.slug);

  /** Doi cho mot dong voi dong ke no. Chi doi tren man hinh, chua ghi. */
  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= rows.length) return;
    const next = rows.map((s) => s.slug);
    [next[index], next[to]] = [next[to], next[index]];
    setOrder(next);
    setSavedOrder(false);
  };

  const saveOrder = async () => {
    const sb = getSupabase();
    if (!sb) return;

    setSavingOrder(true);
    setErr(null);

    // Chi ghi nhung dong that su doi so. Bam Luu hai lan lien tiep thi lan hai
    // khong gui request nao.
    const changed = rows
      .map((s, i) => ({ slug: s.slug, label: s.label, sort_order: i + 1, was: s.sort_order }))
      .filter((r) => r.sort_order !== r.was);

    const results = await Promise.all(
      changed.map((r) =>
        sb.from('styles').update({ sort_order: r.sort_order }).eq('slug', r.slug),
      ),
    );

    setSavingOrder(false);

    const failed = results
      .map((res, i) => (res.error ? `${changed[i].label}: ${res.error.message}` : null))
      .filter(Boolean);

    if (failed.length > 0) {
      setErr(`Không lưu được thứ tự — ${failed.join('; ')}`);
      return;
    }

    setSavedOrder(true);
    setOrder(null);
    reload();
  };

  const saveLabel = async (s: Style) => {
    const sb = getSupabase();
    if (!sb) return;

    const value = (draftLabel[s.slug] ?? s.label).trim();
    if (value === '') {
      setErr('Tên phong cách không được để trống.');
      return;
    }

    setSavingSlug(s.slug);
    setErr(null);

    const { error: upErr } = await sb.from('styles').update({ label: value }).eq('slug', s.slug);

    setSavingSlug(null);

    if (upErr) {
      setErr(`Không lưu được tên "${s.label}": ${upErr.message}`);
      return;
    }

    setSavedSlug(s.slug);
    setDraftLabel((d) => {
      const next = { ...d };
      delete next[s.slug];
      return next;
    });
    reload();
  };

  return (
    <div>
      <div className="mb-10">
        <h1 className="display-sm mb-3">Phong cách</h1>
        <p className="muted max-w-2xl text-sm leading-relaxed">
          Thứ tự ở đây quyết định thứ tự bộ lọc trong trang Khám phá và ô chọn gu trong
          trang Hồ sơ. Còn thứ tự các khối lớn ngoài trang chủ nằm ở ô{' '}
          <em>Các phong cách hiện ở trang chủ</em> bên{' '}
          <Link href="/admin/noi-dung" className="underline">
            Nội dung
          </Link>
          .
        </p>
      </div>

      {err && <div className="notice notice-danger mb-8">{err}</div>}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-sm btn-solid"
          disabled={!orderDirty || savingOrder}
          onClick={() => void saveOrder()}
        >
          {savingOrder ? 'Đang lưu…' : 'Lưu thứ tự'}
        </button>
        {orderDirty && !savingOrder && (
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => setOrder(null)}>
            Hoàn tác
          </button>
        )}
        {orderDirty ? (
          <span className="muted-2 text-xs">Thứ tự trên màn hình đã khác bản đã lưu.</span>
        ) : (
          savedOrder && (
            <span className="text-xs" style={{ color: 'var(--color-ok)' }}>
              Đã lưu thứ tự
            </span>
          )
        )}
      </div>

      <div className="flex flex-col">
        {rows.map((s, i) => {
          const label = draftLabel[s.slug] ?? s.label;
          const dirty = draftLabel[s.slug] !== undefined && draftLabel[s.slug] !== s.label;
          const busy = savingSlug === s.slug;
          const used = data.counts[s.slug] ?? 0;

          return (
            <div
              key={s.slug}
              className="flex flex-wrap items-center gap-4 border-b py-4"
              style={{ borderColor: 'var(--line)' }}
            >
              {/* Thu tu + hai nut doi cho */}
              <div className="flex items-center gap-2">
                <span className="muted-2 w-6 text-sm tabular-nums">{i + 1}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-quiet"
                  disabled={i === 0}
                  aria-label={`Đưa ${s.label} lên trên`}
                  onClick={() => move(i, -1)}
                >
                  Lên
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-quiet"
                  disabled={i === rows.length - 1}
                  aria-label={`Đưa ${s.label} xuống dưới`}
                  onClick={() => move(i, 1)}
                >
                  Xuống
                </button>
              </div>

              {/* Ten hien cho nguoi xem */}
              <div className="min-w-[14rem] flex-1">
                <input
                  type="text"
                  className="field"
                  value={label}
                  aria-label={`Tên phong cách ${s.slug}`}
                  onChange={(e) => {
                    setDraftLabel((d) => ({ ...d, [s.slug]: e.target.value }));
                    setSavedSlug(null);
                  }}
                />
                <p className="hint">
                  Mã <code>{s.slug}</code> — không đổi được, vì đường dẫn{' '}
                  <code>/kham-pha?style={s.slug}</code> và các set đồ đang dùng mã này.
                </p>
              </div>

              {/* Trang thai */}
              <div className="flex min-w-[11rem] flex-col gap-1 text-xs">
                <span className="muted-2">
                  {used === 0 ? 'Chưa có set đồ nào' : `${used} set đồ`}
                </span>
                {data.onHome.includes(s.slug) && (
                  <span style={{ color: 'var(--color-ok)' }}>Đang hiện ở trang chủ</span>
                )}
              </div>

              {/* Luu ten */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!dirty || busy}
                  onClick={() => void saveLabel(s)}
                >
                  {busy ? 'Đang lưu…' : 'Lưu tên'}
                </button>
                {savedSlug === s.slug && (
                  <span className="text-xs" style={{ color: 'var(--color-ok)' }}>
                    Đã lưu
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="muted-2 mt-8 max-w-2xl text-xs leading-relaxed">
        Đổi tên chỉ đổi chữ người xem thấy. Mã phong cách giữ nguyên nên các đường dẫn đã
        chia sẻ ra ngoài không hỏng, và các set đồ đang thuộc phong cách đó vẫn nằm nguyên
        chỗ cũ.
      </p>
    </div>
  );
}
