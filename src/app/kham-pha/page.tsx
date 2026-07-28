'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useTaxonomy, useUserContext } from '@/lib/hooks';
import { useOutfits, type OutfitFilters } from '@/lib/useOutfits';
import { useContent } from '@/lib/content';
import { OutfitCard } from '@/components/outfit';
import { ColorPicker } from '@/components/ColorPicker';
import { EmptyState, SetupNotice, Spinner } from '@/components/site';
import { colorGuidanceFor, NGU_HANH_LABEL } from '@/lib/nguhanh';
import { formatVnd } from '@/lib/format';

/**
 * Cac buoc gia bam san, thay cho thanh truot — de bam tren dien thoai hon.
 *
 * TINH THEO TONG GIA CA SET, khong phai gia tung mon.
 *   Mot set thuong 4 mon, moi mon 150.000 – 700.000d, nen tong roi vao khoang
 *   1 – 2 trieu. Cac buoc duoi bam theo do.
 *
 *   Neu sau nay muon loc theo GIA TUNG MON thi phai doi ca cach truy van trong
 *   useOutfits — bang outfits chi luu total_price_vnd, khong luu gia mon le.
 */
const PRICE_STEPS: Array<{ label: string; min: number | null; max: number | null }> = [
  { label: 'Tất cả', min: null, max: null },
  { label: 'Dưới 500k', min: null, max: 500_000 },
  { label: '500k – 1 triệu', min: 500_000, max: 1_000_000 },
  { label: '1 – 1,5 triệu', min: 1_000_000, max: 1_500_000 },
  { label: '1,5 – 2 triệu', min: 1_500_000, max: 2_000_000 },
  { label: '2 – 3 triệu', min: 2_000_000, max: 3_000_000 },
  { label: 'Trên 3 triệu', min: 3_000_000, max: null },
];

export default function DiscoverPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  // useSearchParams bat buoc phai nam trong <Suspense> o ban xuat tinh.
  return (
    <Suspense fallback={<div className="shell py-20"><Spinner /></div>}>
      <Discover />
    </Suspense>
  );
}

function Discover() {
  const tax = useTaxonomy();
  /**
   * Phong cach do trang chu truyen sang: /kham-pha/?style=toi-gian
   *
   * TRUOC DAY DOC BANG window.location.search VA NO SAI.
   *   Bam tu trang chu la dieu huong PHIA TRINH DUYET — React dung trang moi
   *   TRUOC, roi Next moi doi dia chi tren thanh dia chi. Doc window trong lan
   *   render dau nen van thay dia chi cua trang CU, tuc la khong co tham so
   *   nao, nen bo loc khong bat. Go thang dia chi vao trinh duyet thi lai chay
   *   dung — dung kieu loi chi xuat hien khi bam tu trong trang, va rat kho
   *   doan neu chi doc ma nguon.
   *
   *   useSearchParams doc tu chinh bo dieu huong cua Next nen luon dung o moi
   *   kieu dieu huong. Cai gia phai tra la mot lop <Suspense> o tren.
   */
  const searchParams = useSearchParams();
  const c = useContent();
  const { ctx, privateData } = useUserContext();

  // Doc mot lan luc mo trang. Sau do bo loc thuoc ve nguoi dung: ho bo chon
  // phong cach thi khong co ly do gi de dia chi keo no quay lai.
  const [filters, setFilters] = useState<OutfitFilters>(() => {
    const s = searchParams.get('style');
    return s ? { styleSlug: s } : {};
  });
  const [priceStep, setPriceStep] = useState(0);
  const [menhOnly, setMenhOnly] = useState(false);

  const { outfits, loading, error, total, reload } = useOutfits(filters, ctx, tax.colorElements, 120);

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

  /** Bao nhieu bai co mau hop menh — dung cho con so ngay tren nut. */
  const soHopMenh = guidance
    ? outfits.filter((o) =>
        o.color_slugs.some((cs) => {
          const el = tax.colorElements[cs];
          return el === guidance.tuongSinh || el === guidance.banMenh;
        }),
      ).length
    : 0;

  /*
    TAI THEO TUNG DOT, khong bay het mot luc.

    Hien tai co 19 bai nen bay het van muot. Nhung moi the mang mot buc anh, va
    o vai tram bai thi trinh duyet phai giai ma vai tram tam anh cung luc —
    dien thoai tam trung se giat, va nguoi dung tren mang 3G tai ve hang chuc
    megabyte cho mot man hinh ho chi luot qua.

    24 bai mot dot: du day sau man hinh o moi khung, va vua mot lan cuon.

    DEM LAI TU DAU KHI DOI BO LOC — `key` cua danh sach doi thi so dot ve 1.
    Khong lam vay thi doi bo loc xong van dang o "dot 4" cua mot danh sach chi
    con 5 bai, va man hinh trong tron.
  */
  const MOI_DOT = 24;
  const [soDot, setSoDot] = useState(1);
  const khoaDanhSach = JSON.stringify(filters) + `|${menhOnly}|${visible.length}`;
  const [khoaCu, setKhoaCu] = useState(khoaDanhSach);
  if (khoaCu !== khoaDanhSach) {
    setKhoaCu(khoaDanhSach);
    setSoDot(1);
  }

  const dangHien = visible.slice(0, soDot * MOI_DOT);
  const conNua = visible.length - dangHien.length;

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
    (filters.colorSlugs?.length ? 1 : 0) +
    (priceStep > 0 ? 1 : 0) +
    (menhOnly ? 1 : 0);

  /**
   * Nhung gi dang loc BEN TRONG muc "Nang cao", viet ra de doc khi muc dang
   * dong.
   *
   * Gom ba bo loc vao mot cho co mot cai gia: dong lai la khong con thay minh
   * dang loc gi. Nguoi dung loc mau den, cuon xuong xem, cuon nguoc len thay
   * mot dong "Nang cao" tron tru — roi khong hieu vi sao ket qua it di.
   *
   * Viet TEN chu khong viet so ("Nang cao · 2"). Con so noi rang co gi do dang
   * bat nhung khong noi la gi, van phai mo ra xem.
   */
  const advancedSummary =
    [
      filters.occasionSlug
        ? tax.occasions.find((o) => o.slug === filters.occasionSlug)?.label
        : null,
      filters.colorSlugs?.length
        ? filters.colorSlugs.map((cs) => tax.colors.find((x) => x.slug === cs)?.label).join(', ')
        : null,
      priceStep > 0 ? PRICE_STEPS[priceStep].label : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined;

  return (
    <div className="shell py-12 md:py-16">
      <div className="mb-10">
        <p className="eyebrow mb-4">
          <span style={c.s('discover.title')}>{c.t('discover.title', 'Khám phá')}</span>
        </p>
        <h1 className="display-sm mb-4">
          <span style={c.s('discover.heading')}>
            {c.t('discover.heading', 'Tất cả outfit')}
          </span>
        </h1>
        <p className="muted max-w-2xl text-sm leading-relaxed">
          <span style={c.s('discover.subtitle')}>
          {c.t(
            'discover.subtitle',
            'Lọc theo phong cách, dịp, màu và khoảng giá. ' +
              'Gu của bạn luôn được ưu tiên hơn gợi ý theo mệnh.',
          )}
          </span>
        </p>
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

        {/* BA NHOM CON LAI NAM CHUNG TRONG MOT MUC "NANG CAO", DONG MAC DINH.
            Ly do: mo het ra la 33 nut, day toan bo ket qua xuong duoi man hinh
            dien thoai — nguoi dung phai cuon qua bo loc moi nhin thay cai ho
            vao de xem. Truoc day ba nhom thu gon rieng, van la ba dong chiem
            cho ma dong nao cung ghi "Tat ca", nhin nhu ba o trong.

            Phong cach thi KHONG gom vao day: no la bo loc duoc dung nhieu nhat
            va la thu trang chu dan sang, phai thay ngay. */}
        <Collapsible label="Nâng cao" summary={advancedSummary}>
          <div className="flex w-full flex-col gap-5">
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

            {/* Loc theo mau: gom nhom, xem chu thich trong ColorPicker.
                29 cai chip trong mot khoi loc lam nguoi ta khong loc nua. */}
            <Group label="Màu">
              <ColorPicker
                colors={tax.colors}
                selected={filters.colorSlugs ?? []}
                onChange={(xs) => setFilters((f) => ({ ...f, colorSlugs: xs.length ? xs : null }))}
                multiple
              />
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
          </div>
        </Collapsible>

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
            {/*
              NOI SO BAI HOP MENH NGAY TAI NUT.

              Truoc day bam nut xong chi thay danh sach doi — khong biet no bo
              bao nhieu bai, va neu danh sach ngan san thi khong biet nut co
              chay khong. Mot con so tra loi ca hai cau hoi truoc khi bam.
            */}
            <span className="muted-2 self-center text-xs">
              {soHopMenh}/{outfits.length} bài có màu hợp mệnh ·
              {' '}Tương sinh: {NGU_HANH_LABEL[guidance.tuongSinh]} · Bản mệnh:{' '}
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
        <EmptyState title={c.t('discover.empty_title', 'Không có outfit nào khớp')}>
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
            {dangHien.map((o) => (
              <OutfitCard
                key={o.id}
                outfit={o}
                score={o.score}
                hopMenh={
                  guidance
                    ? o.color_slugs.filter((cs) => {
                        const el = tax.colorElements[cs];
                        return el === guidance.tuongSinh || el === guidance.banMenh;
                      })
                    : undefined
                }
                // Sau khi ghi phan hoi, tai lai danh sach de bo cham diem
                // xep lai thu tu ngay — set vua bam se tut xuong cuoi.
                onDislike={reload}
              />
            ))}
          </div>

          {conNua > 0 && (
            <div className="mt-12 text-center">
              <button type="button" className="btn" onClick={() => setSoDot((n) => n + 1)}>
                Xem thêm {Math.min(conNua, MOI_DOT)} bài
              </button>
              <p className="muted-2 mt-3 text-xs">
                Đang hiện {dangHien.length} trong {visible.length} bài.
              </p>
            </div>
          )}

          <p className="muted-2 mt-12 text-center text-xs">
            <span style={c.s('discover.price_note')}>
              {c.t(
                'discover.price_note',
                'Giá hiển thị là tổng tạm tính của cả set, ghi nhận tại thời điểm nhập.',
              )}
            </span>{' '}
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

/**
 * Nhom bo loc thu gon duoc, mac dinh dong.
 *
 * Khi dong van hien NHUNG GI DANG LOC ben trong. Neu khong, nguoi dung loc mot
 * mau roi cuon xuong, quay len thay nhom dong lai va tuong minh chua loc gi —
 * roi khong hieu vi sao ket qua it di.
 *
 * KHONG GHI "TAT CA" KHI CHUA LOC GI. Chu do khong mang thong tin nao — chua
 * loc thi hien nhien la tat ca — ma lai lam moi dong trong nhin nhu mot o dang
 * cho dien. Mui ten da noi du: co cai gi do mo ra duoc.
 *
 * Dung <details>/<summary> that thay vi tu quan ly trang thai: no mo duoc bang
 * ban phim, doc duoc bang trinh doc man hinh, va tim-trong-trang cua trinh
 * duyet tu mo ra khi tu khoa nam ben trong. Ba thu do neu tu lam se phai viet
 * them kha nhieu ma de sai.
 */
function Collapsible({
  label,
  summary,
  children,
}: {
  label: string;
  /** Nhung gi dang loc ben trong, hien khi dang dong. */
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-1">
        <span className="eyebrow shrink-0 sm:w-40">{label}</span>
        {summary && (
          <span className="text-sm" style={{ color: 'var(--fg)' }}>
            {summary}
          </span>
        )}
        <span
          className="muted-2 ml-auto text-sm transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ▾
        </span>
      </summary>
      <div className="mt-4 flex flex-wrap gap-2 sm:ml-40 sm:pl-6">{children}</div>
    </details>
  );
}
