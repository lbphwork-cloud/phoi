'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useTaxonomy, useUserContext } from '@/lib/hooks';
import { useOutfits, type OutfitFilters } from '@/lib/useOutfits';
import { OutfitCard } from '@/components/outfit';
import { EmptyState, SetupNotice, Spinner } from '@/components/site';
import { colorGuidanceFor, NGU_HANH_LABEL } from '@/lib/nguhanh';
import { formatVnd } from '@/lib/format';

/** Cac buoc gia bam san, thay cho thanh truot — de bam tren dien thoai hon. */
const PRICE_STEPS: Array<{ label: string; min: number | null; max: number | null }> = [
  { label: 'Tất cả', min: null, max: null },
  { label: 'Dưới 1 triệu', min: null, max: 1_000_000 },
  { label: '1 – 1,5 triệu', min: 1_000_000, max: 1_500_000 },
  { label: '1,5 – 2 triệu', min: 1_500_000, max: 2_000_000 },
  { label: 'Trên 2 triệu', min: 2_000_000, max: null },
];

export default function DiscoverPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Discover />;
}

function Discover() {
  const tax = useTaxonomy();
  const { ctx, privateData } = useUserContext();

  const [filters, setFilters] = useState<OutfitFilters>({});
  const [priceStep, setPriceStep] = useState(0);
  const [menhOnly, setMenhOnly] = useState(false);

  const { outfits, loading, error, total } = useOutfits(filters, ctx, tax.colorElements, 120);

  const element = privateData?.element ?? null;
  const menhEnabled = privateData?.element_enabled ?? true;
  const guidance = element ? colorGuidanceFor(element) : null;

  /**
   * Bo loc "chi mau hop menh" chay o phia trinh duyet, KHONG phai truy van
   * may chu: no can ban do mau -> hanh, va no la lua chon cua nguoi dung chu
   * khong phai dieu kien luu tru.
   *
   * Day co y la bo loc TUY CHON. Mac dinh menh chi la diem cong mem trong
   * bo cham diem — neu loc cung ngay tu dau thi nguoi menh Thuy chi con thay
   * do den va xanh, catalog ngheo di ngay lap tuc.
   */
  const visible =
    menhOnly && guidance
      ? outfits.filter((o) =>
          o.color_slugs.some((c) => {
            const el = tax.colorElements[c];
            return el === guidance.tuongSinh || el === guidance.banMenh;
          }),
        )
      : outfits;

  const toggle = (k: keyof OutfitFilters, v: string) =>
    setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }));

  const applyPrice = (i: number) => {
    setPriceStep(i);
    setFilters((f) => ({ ...f, priceMin: PRICE_STEPS[i].min, priceMax: PRICE_STEPS[i].max }));
  };

  const clearAll = () => {
    setFilters({});
    setPriceStep(0);
    setMenhOnly(false);
  };

  const activeCount =
    (filters.styleSlug ? 1 : 0) +
    (filters.occasionSlug ? 1 : 0) +
    (filters.colorSlug ? 1 : 0) +
    (priceStep > 0 ? 1 : 0) +
    (menhOnly ? 1 : 0);

  return (
    <div className="shell py-12 md:py-16">
      <div className="mb-10">
        <p className="eyebrow mb-4">Khám phá</p>
        <h1 className="display-sm">Tất cả outfit</h1>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bo loc                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-12 flex flex-col gap-6 border-y py-6" style={{ borderColor: 'var(--line)' }}>
        <Group label="Phong cách">
          {tax.styles.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="chip"
              aria-pressed={filters.styleSlug === s.slug}
              onClick={() => toggle('styleSlug', s.slug)}
            >
              {s.label}
            </button>
          ))}
        </Group>

        <Group label="Dịp sử dụng">
          {tax.occasions.map((o) => (
            <button
              key={o.slug}
              type="button"
              className="chip"
              aria-pressed={filters.occasionSlug === o.slug}
              onClick={() => toggle('occasionSlug', o.slug)}
            >
              {o.label}
            </button>
          ))}
        </Group>

        <Group label="Màu">
          {tax.colors.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="chip"
              aria-pressed={filters.colorSlug === c.slug}
              onClick={() => toggle('colorSlug', c.slug)}
              title={c.element ? `Thuộc hành ${NGU_HANH_LABEL[c.element]}` : undefined}
            >
              <span className="swatch" style={{ background: c.hex }} />
              {c.label}
            </button>
          ))}
        </Group>

        <Group label="Khoảng giá cả set">
          {PRICE_STEPS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              className="chip"
              aria-pressed={priceStep === i}
              onClick={() => applyPrice(i)}
            >
              {p.label}
            </button>
          ))}
        </Group>

        {/* Bo loc theo menh chi hien khi nguoi dung DA nhap ngay sinh va
            CHUA tat goi y theo menh. Khong quang cao tinh nang ho khong dung. */}
        {element && menhEnabled && guidance && (
          <Group label={`Mệnh ${NGU_HANH_LABEL[element]}`}>
            <button
              type="button"
              className="chip"
              aria-pressed={menhOnly}
              onClick={() => setMenhOnly((v) => !v)}
            >
              Chỉ hiện outfit có màu hợp mệnh
            </button>
            <span className="muted-2 self-center text-xs">
              Tương sinh: {NGU_HANH_LABEL[guidance.tuongSinh]} · Bản mệnh:{' '}
              {NGU_HANH_LABEL[guidance.banMenh]} · Hạn chế: {NGU_HANH_LABEL[guidance.hanChe]}
            </span>
          </Group>
        )}

        {activeCount > 0 && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={clearAll} className="btn btn-sm">
              Bỏ {activeCount} bộ lọc
            </button>
            <span className="muted-2 text-xs">
              {visible.length} / {total} outfit
            </span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Ket qua                                                            */}
      {/* ------------------------------------------------------------------ */}
      {error && <div className="notice notice-danger mb-8">Không tải được dữ liệu: {error}</div>}

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState title="Không có outfit nào khớp">
          {activeCount > 0 ? (
            <>
              Thử bỏ một vài bộ lọc.{' '}
              <button type="button" onClick={clearAll} className="underline">
                Bỏ tất cả
              </button>
            </>
          ) : (
            <>
              Chưa có outfit nào được đăng.{' '}
              <Link href="/tao-bai" className="underline">
                Tạo bài đầu tiên
              </Link>
            </>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {visible.map((o) => (
              <OutfitCard key={o.id} outfit={o} score={o.score} />
            ))}
          </div>

          <p className="muted-2 mt-12 text-center text-xs">
            Giá hiển thị là tổng tạm tính của cả set, ghi nhận tại thời điểm nhập.
            Ví dụ khoảng giá mục tiêu mỗi món: {formatVnd(150_000)} – {formatVnd(700_000)}.
          </p>
        </>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
      <p className="eyebrow shrink-0 sm:w-40 sm:pt-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
