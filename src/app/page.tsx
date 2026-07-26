'use client';

import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useTaxonomy, useUserContext, useReveal } from '@/lib/hooks';
import { useOutfits } from '@/lib/useOutfits';
import { OutfitCard, SeedTag } from '@/components/outfit';
import { EmptyState, SetupNotice, Spinner } from '@/components/site';
import { NGU_HANH_LABEL } from '@/lib/nguhanh';

export default function HomePage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Home />;
}

function Home() {
  const tax = useTaxonomy();
  const { ctx, privateData, prefs, loading: ctxLoading } = useUserContext();
  const { outfits, loading } = useOutfits({}, ctx, tax.colorElements, 24);

  const heroRef = useReveal<HTMLDivElement>();
  const featured = outfits[0];
  const rest = outfits.slice(1, 13);

  const hasSeed = outfits.some((o) => o.is_seed);
  const personalised =
    (prefs?.style_slugs?.length ?? 0) > 0 || (prefs?.color_slugs?.length ?? 0) > 0;

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Mo dau. Chu it, khoang trang nhieu, mot anh lon.                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="shell pt-16 pb-20 md:pt-24 md:pb-28">
        <div ref={heroRef} className="reveal grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <p className="eyebrow mb-6">Phối đồ nam · Việt Nam</p>
            <h1 className="display mb-8">
              Mặc gì hôm nay,
              <br />
              đã có người phối sẵn.
            </h1>
            <p className="muted max-w-md text-lg leading-relaxed">
              Những set đồ hoàn chỉnh trong khoảng 150.000&nbsp;–&nbsp;700.000đ mỗi món.
              Chọn gu của bạn, hệ thống xếp lại thứ tự cho riêng bạn.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/kham-pha" className="btn btn-solid">
                Xem tất cả outfit
              </Link>
              {!ctxLoading && !personalised && (
                <Link href="/ho-so" className="btn">
                  Thiết lập gu của bạn
                </Link>
              )}
            </div>

            {/* Neu nguoi dung da nhap ngay sinh thi noi ro dang dung menh nao,
                va cho duong dan tat ngay tai cho.                          */}
            {privateData?.element && privateData.element_enabled && (
              <p className="muted-2 mt-8 text-sm">
                Đang ưu tiên màu hợp mệnh {NGU_HANH_LABEL[privateData.element]}
                {privateData.element_label && ` (${privateData.element_label})`}.{' '}
                <Link href="/ho-so" className="underline">
                  Tắt gợi ý theo mệnh
                </Link>
              </p>
            )}
          </div>

          {/* Outfit dau bang lam anh mo dau */}
          <div>
            {loading ? (
              <div className="frame frame-wide" />
            ) : featured ? (
              <Link href={`/outfit/${featured.slug}`} className="group block">
                <div className="frame frame-wide mb-4">
                  {featured.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featured.hero_image_url} alt={featured.title} />
                  ) : (
                    <div className="frame frame-empty absolute inset-0">
                      Chưa có ảnh — thêm trong trang quản trị
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Gợi ý hàng đầu cho bạn</p>
                    <p className="display-sm mt-1">{featured.title}</p>
                  </div>
                  {featured.is_seed && <SeedTag />}
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Loi bao du lieu mau. Bien mat ngay khi thay bang du lieu that.   */}
      {/* ---------------------------------------------------------------- */}
      {hasSeed && (
        <section className="shell pb-16">
          <div className="notice notice-warn">
            Đang có dữ liệu mẫu trên trang. Tên sản phẩm là tên mô tả theo loại,
            giá là khoảng giá phổ biến, và link trỏ tới trang tìm kiếm của sàn —
            không phải sản phẩm cụ thể nào. Vào{' '}
            <Link href="/admin/san-pham" className="underline">
              trang quản trị
            </Link>{' '}
            để thay bằng dữ liệu thật.
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Luoi outfit                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="shell pb-24">
        <div
          className="mb-10 flex items-end justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--line)' }}
        >
          <h2 className="display-sm">Mới nhất</h2>
          <Link href="/kham-pha" className="eyebrow hover:underline">
            Tất cả →
          </Link>
        </div>

        {loading ? (
          <Spinner />
        ) : rest.length === 0 ? (
          <EmptyState title="Chưa có outfit nào">
            Chạy migration <code>0006_seed_outfits.sql</code> để có 20 set đồ mẫu,
            hoặc tự tạo bài đầu tiên trong trang quản trị.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {rest.map((o) => (
              <OutfitCard key={o.id} outfit={o} score={o.score} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Ba buoc — giai thich cach website hoat dong                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t py-20" style={{ borderColor: 'var(--line)' }}>
        <div className="shell grid gap-10 md:grid-cols-3">
          {[
            {
              n: '01',
              t: 'Chọn gu',
              d: 'Phong cách, màu, khoảng giá. Thêm ngày sinh nếu muốn gợi ý theo mệnh — không bắt buộc, và tắt được bất cứ lúc nào.',
            },
            {
              n: '02',
              t: 'Xem và phản hồi',
              d: 'Bốn nút: không thích màu, không thích phong cách, không thích cách phối, ẩn outfit. Mỗi lần bấm là thứ tự gợi ý đổi theo.',
            },
            {
              n: '03',
              t: 'Mua trên sàn',
              d: 'Bấm vào món bạn muốn để sang Shopee hoặc TikTok Shop. PHỐI không bán hàng và không giữ tiền của bạn.',
            },
          ].map((s) => (
            <div key={s.n}>
              <p className="eyebrow mb-3">{s.n}</p>
              <p className="display-xs mb-2">{s.t}</p>
              <p className="muted text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
