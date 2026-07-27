'use client';

/**
 * O tim kiem tren thanh menu.
 *
 * TIM CA TEN SET DO LAN TEN SAN PHAM
 *   Nguoi ta go "ao khoac denim" chu khong go ten mot set do — ho khong biet
 *   set do ten gi. Chi tim ten set thi phan lon luot go se ra rong, va nguoi
 *   dung ket luan la website khong co gi.
 *
 *   Hai truy van rieng roi gop lai, chu khong phai mot truy van co join: qua
 *   REST cua PostgREST, loc theo mot bang lien ket khong tra ve dung dong cha
 *   khi dieu kien nam o bang con. Hai luot goi don gian va doan duoc.
 *
 * CHI TIM KHI DA GO XONG
 *   Doi 350ms sau lan go cuoi. Go "ao khoac" la 8 ky tu — khong doi thi la 8
 *   luot goi mang cho mot y dinh duy nhat.
 *
 * NHO NAM LAN TIM GAN NHAT
 *   Luu trong trinh duyet, khong gui len may chu. Lich su tim kiem la du lieu
 *   ca nhan; no khong can roi khoi may cua nguoi dung de lam duoc viec nay.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { formatVndShort } from '@/lib/format';
import type { Outfit } from '@/lib/supabase/types';

const RECENT_KEY = 'phoi.tim-kiem.gan-day';
const RECENT_MAX = 5;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // localStorage co the bi chan (che do rieng tu, thiet lap trinh duyet).
    // Khong nho duoc lich su thi tim kiem van chay — do la thu chinh.
    return [];
  }
}

function pushRecent(q: string) {
  try {
    const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* khong nho duoc thi thoi */
  }
}

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Outfit[]>([]);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Chi dua con tro vao o. Doc lich su tim kiem KHONG nam o day ma nam trong
  // ham bam mo — dat state trong effect se tao mot vong render thua, va React
  // canh bao dung ve viec do.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Dong bang phim Esc. Nguoi dung ban phim khong co cach nao khac de thoat.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const needle = q.trim();
    // Khong xoa ket qua o day. Ket qua cu duoc LOC RA luc hien (xem `visible`
    // ben duoi) — vua tranh mot lan dat state trong effect, vua khong lam danh
    // sach nhay mat roi hien lai khi nguoi dung sua mot ky tu.
    if (needle.length < 2) return;

    let alive = true;
    const timer = setTimeout(async () => {
      const sb = getSupabase();
      if (!sb) return;

      setBusy(true);

      // 1. Theo ten set do
      const byTitle = await sb
        .from('outfits')
        .select('*')
        .eq('status', 'published')
        .ilike('title', `%${needle}%`)
        .limit(8);

      // 2. Theo ten san pham -> lay id cac set chua san pham do
      const byProduct = await sb
        .from('outfit_items')
        .select('outfit_id, products!inner(name)')
        .ilike('products.name', `%${needle}%`)
        .limit(30);

      const extraIds = [
        ...new Set((byProduct.data ?? []).map((r) => (r as { outfit_id: string }).outfit_id)),
      ].filter((id) => !(byTitle.data ?? []).some((o) => (o as Outfit).id === id));

      let extras: Outfit[] = [];
      if (extraIds.length > 0) {
        const res = await sb
          .from('outfits')
          .select('*')
          .eq('status', 'published')
          .in('id', extraIds.slice(0, 8));
        extras = (res.data as Outfit[] | null) ?? [];
      }

      if (!alive) return;
      setRows([...((byTitle.data as Outfit[] | null) ?? []), ...extras].slice(0, 10));
      setBusy(false);
      pushRecent(needle);
    }, 350);

    return () => { alive = false; clearTimeout(timer); };
  }, [q]);

  // Chua go du hai ky tu thi khong hien ket qua cu.
  const visible = q.trim().length >= 2 ? rows : [];

  return (
    <>
      <button
        type="button"
        className="navlink"
        onClick={() => { setRecent(readRecent()); setOpen(true); }}
        aria-label="Tìm kiếm"
        title="Tìm kiếm"
      >
        {/* Kinh lup ve bang SVG chu khong dung ky tu bieu tuong: ky tu bieu
            tuong hien khac nhau tren tung he dieu hanh, va mot so may khong co
            no nen ra o vuong rong. */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-24"
          style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl border p-6"
            style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <input
                ref={inputRef}
                type="search"
                className="field"
                placeholder="Tìm set đồ hoặc tên sản phẩm — ví dụ: áo khoác denim"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="button" className="btn btn-sm btn-quiet" onClick={() => setOpen(false)}>
                Đóng
              </button>
            </div>

            {q.trim().length < 2 && recent.length > 0 && (
              <div className="mb-4">
                <p className="eyebrow mb-2">Vừa tìm</p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button key={r} type="button" className="chip" onClick={() => setQ(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {busy && <p className="muted-2 text-sm">Đang tìm…</p>}

            {!busy && q.trim().length >= 2 && visible.length === 0 && (
              <p className="muted-2 text-sm">
                Không có set nào khớp. Thử một từ ngắn hơn, hoặc{' '}
                <Link href="/kham-pha" className="underline" onClick={() => setOpen(false)}>
                  lọc trong trang khám phá
                </Link>
                .
              </p>
            )}

            <div className="flex flex-col">
              {visible.map((o) => (
                <Link
                  key={o.id}
                  href={`/outfit/${o.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b py-3"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <div className="frame frame-square w-12 shrink-0">
                    {o.hero_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.hero_image_url} alt="" loading="lazy" />
                    ) : (
                      <div className="frame frame-empty absolute inset-0">—</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{o.title}</p>
                    <p className="muted-2 text-xs">
                      {o.total_price_vnd !== null && formatVndShort(o.total_price_vnd)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
