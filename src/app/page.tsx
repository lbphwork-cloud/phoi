'use client';

/**
 * Trang chu.
 *
 * BO CUC (theo yeu cau cua chu website)
 *   1. Mot khoi mo dau TRAN HET CHIEU NGANG, gioi thieu website. Chu va nut
 *      nam BEN TRONG khung anh, khong nam canh anh.
 *   2. Ben duoi la cac khoi phong cach. Moi khoi mot anh lon va mot nut dan
 *      sang trang kham pha da loc san phong cach do.
 *
 *   CO Y KHONG co luoi outfit deu nhau o day nua. Ai muon xem nhieu thi vao
 *   /kham-pha — do la viec cua trang do. Trang chu chi lam mot viec: dan nguoi
 *   ta di dung huong.
 *
 * ANH CUA TUNG KHOI LAY O DAU
 *   Uu tien anh quan tri vien dat trong site_content. Chua dat thi tu lay anh
 *   cua outfit dep nhat thuoc phong cach do. Nho vay trang chu KHONG BAO GIO
 *   co o trong, ke ca khi chua ai vao dat anh.
 *
 * MOI DOAN CHU DEU CO BAN DU PHONG viet ngay tai cho. Neu database khong goi
 * duoc thi trang van day du chu — xem chu thich dau src/lib/content.ts.
 */

import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useTaxonomy, useUserContext, useReveal } from '@/lib/hooks';
import { useOutfits } from '@/lib/useOutfits';
import { useContent, heroAppearance } from '@/lib/content';
import { SetupNotice } from '@/components/site';
import { NGU_HANH_LABEL } from '@/lib/nguhanh';

export default function HomePage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Home />;
}

function Home() {
  const tax = useTaxonomy();
  const c = useContent();
  const { ctx, privateData, prefs, loading: ctxLoading } = useUserContext();
  const { outfits } = useOutfits({}, ctx, tax.colorElements, 60);

  const heroRef = useReveal<HTMLDivElement>();

  const personalised =
    (prefs?.style_slugs?.length ?? 0) > 0 || (prefs?.color_slugs?.length ?? 0) > 0;

  const heroImage = c.t('home.hero.image', '') || outfits[0]?.hero_image_url || '';
  const heroTitle = c.t('home.hero.title', 'Mặc gì hôm nay,\nđã có người phối sẵn.');
  const hero = heroAppearance(c.t);

  // Danh sach phong cach hien o trang chu, do quan tri vien quyet dinh.
  const styleSlugs = c.list(
    'home.styles.list',
    'toi-gian, streetwear, smart-casual, co-dien, thanh-lich',
  );

  const styles = styleSlugs
    .map((slug) => {
      const meta = tax.styles.find((s) => s.slug === slug);
      if (!meta) return null;

      // Anh du phong: outfit dau tien thuoc phong cach nay va co anh.
      const fromOutfit = outfits.find((o) => o.style_slug === slug && o.hero_image_url);

      return {
        slug,
        label: meta.label,
        desc: c.t(`home.style.${slug}.desc`, meta.description ?? ''),
        image: c.t(`home.style.${slug}.image`, '') || fromOutfit?.hero_image_url || '',
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <>
      {/* ================================================================== */}
      {/* 1. Mo dau — gioi thieu website, tran het chieu ngang               */}
      {/* ================================================================== */}
      <section className="bleed">
        <div
          ref={heroRef}
          className={`hero-media reveal flex ${hero.alignClass}`}
          style={{ minHeight: 'clamp(30rem, 82vh, 48rem)' }}
        >
          {heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" aria-hidden="true" />
          )}

          {/* Lop phu do quan tri vien chon, de len tren anh va duoi chu. Dat
              bang style thay vi ::after cua .hero-media de doi duoc luc chay. */}
          {hero.overlay !== 'none' && (
            <div
              className="absolute inset-0"
              style={{ background: hero.overlay }}
              aria-hidden="true"
            />
          )}

          <div className="hero-body shell w-full pb-14 md:pb-20" style={hero.textStyle}>
            <div className={hero.boxStyle ? 'inline-block max-w-3xl p-8 md:p-10' : ''}
                 style={hero.boxStyle}>
              <p className="eyebrow mb-5" style={{ color: hero.dimColor }}>
                {c.t('home.hero.eyebrow', 'Phối đồ nam · Việt Nam')}
              </p>

              {/* Xuong dong theo dung cho quan tri vien bam Enter trong o nhap */}
              <h1 className="display mb-7 max-w-3xl whitespace-pre-line">{heroTitle}</h1>

              <p className="max-w-xl text-base leading-relaxed md:text-lg">
                {c.t(
                  'home.hero.subtitle',
                  'Những set đồ hoàn chỉnh trong khoảng 150.000 – 700.000đ mỗi món. ' +
                    'Chọn gu của bạn, hệ thống xếp lại thứ tự cho riêng bạn.',
                )}
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href={c.t('home.hero.cta_href', '/kham-pha')}
                  className={`btn ${hero.buttonClass}`}
                >
                  {c.t('home.hero.cta_label', 'Xem tất cả outfit')}
                </Link>
                {!ctxLoading && !personalised && (
                  <Link href="/ho-so" className="btn btn-ghost-onmedia">
                    Thiết lập gu của bạn
                  </Link>
                )}
              </div>

              {privateData?.element && privateData.element_enabled && (
                <p className="mt-7 text-sm" style={{ color: hero.dimColor }}>
                  Đang ưu tiên màu hợp mệnh {NGU_HANH_LABEL[privateData.element]}
                  {privateData.element_label && ` (${privateData.element_label})`}.{' '}
                  <Link href="/ho-so" className="underline">
                    Tắt gợi ý theo mệnh
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* 2. Cac khoi phong cach — moi khoi mot anh, mot nut                 */}
      {/* ================================================================== */}
      {styles.length > 0 && (
        <section className="pt-20 md:pt-28">
          <div className="shell mb-12 md:mb-16">
            <p className="eyebrow">{c.t('home.styles.eyebrow', 'Theo phong cách')}</p>
          </div>

          <div className="flex flex-col gap-20 md:gap-28">
            {styles.map((s, i) => (
              <StyleBlock key={s.slug} style={s} flip={i % 2 === 1} />
            ))}
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* 3. Ba buoc — giai thich cach website hoat dong                     */}
      {/* ================================================================== */}
      <section
        className="mt-24 border-t py-20 md:mt-32"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="shell">
          <p className="eyebrow mb-10">{c.t('home.steps.heading', 'Cách hoạt động')}</p>
          <div className="grid gap-10 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <p className="eyebrow mb-3">{String(n).padStart(2, '0')}</p>
                <p className="display-xs mb-2">
                  {c.t(
                    `home.step${n}.title`,
                    ['Chọn gu', 'Xem và phản hồi', 'Mua trên sàn'][n - 1],
                  )}
                </p>
                <p className="muted text-sm leading-relaxed">
                  {c.t(
                    `home.step${n}.desc`,
                    [
                      'Phong cách, màu, khoảng giá. Thêm ngày sinh nếu muốn gợi ý theo mệnh — không bắt buộc, và tắt được bất cứ lúc nào.',
                      'Bốn nút: không thích màu, không thích phong cách, không thích cách phối, ẩn outfit. Mỗi lần bấm là thứ tự gợi ý đổi theo.',
                      'Bấm vào món bạn muốn để sang Shopee hoặc TikTok Shop. PHỐI không bán hàng và không giữ tiền của bạn.',
                    ][n - 1],
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Mot khoi phong cach: anh lon ben nay, chu va nut ben kia, doi ben theo hang.
 *
 * Doi ben (`flip`) de mat khong bi keo theo mot duong thang khi cuon — mot
 * nhip rat nho nhung la khac biet giua "trang web" va "trang bao thoi trang".
 */
function StyleBlock({
  style,
  flip,
}: {
  style: { slug: string; label: string; desc: string; image: string };
  flip: boolean;
}) {
  const ref = useReveal<HTMLDivElement>();
  const href = `/kham-pha?style=${encodeURIComponent(style.slug)}`;

  return (
    <div ref={ref} className="reveal shell">
      <div
        className={`grid items-center gap-8 md:gap-14 lg:grid-cols-[1.35fr_1fr] ${
          flip ? 'lg:[&>*:first-child]:order-2' : ''
        }`}
      >
        <Link href={href} className="group block">
          <div
            className="hero-media"
            style={{ aspectRatio: '4 / 5', maxHeight: '40rem' }}
          >
            {style.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={style.image}
                alt={style.label}
                className="transition-transform duration-700 group-hover:scale-[1.03]"
              />
            )}
          </div>
        </Link>

        <div>
          <h2 className="display-sm mb-4">{style.label}</h2>
          {style.desc && (
            <p className="muted mb-8 max-w-md text-base leading-relaxed">{style.desc}</p>
          )}
          <Link href={href} className="btn">
            Xem set đồ {style.label.toLowerCase()}
          </Link>
        </div>
      </div>
    </div>
  );
}
