'use client';

import { useContent } from '@/lib/content';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useTaxonomy, useUserContext } from '@/lib/hooks';
import { useOutfitDetail } from '@/lib/useOutfits';
import { AiTag, FeedbackBar, ProductRow, SeedTag, StatusTag } from '@/components/outfit';
import { EmptyState, SetupNotice, Spinner } from '@/components/site';
import { SaveButton } from '@/components/SaveButton';
import { formatVnd, formatRelative } from '@/lib/format';
import { colorGuidanceFor, NGU_HANH_LABEL } from '@/lib/nguhanh';

export default function OutfitDetail({ slug }: { slug: string }) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Detail slug={slug} />;
}

function Detail({ slug }: { slug: string }) {
  const { outfit, loading, notFound } = useOutfitDetail(slug);
  const tax = useTaxonomy();
  const c = useContent();
  const { privateData, reload } = useUserContext();

  if (loading) return <Spinner label="Đang tải outfit" />;

  if (notFound || !outfit) {
    return (
      <div className="shell py-20">
        <EmptyState title="Không tìm thấy outfit này">
          Bài có thể đã bị gỡ, hoặc chưa được duyệt để hiển thị công khai.{' '}
          <Link href="/kham-pha" className="underline">
            Xem các outfit khác
          </Link>
        </EmptyState>
      </div>
    );
  }

  const items = outfit.outfit_items ?? [];
  const element = privateData?.element ?? null;
  const menhOn = (privateData?.element_enabled ?? true) && element !== null;
  const guidance = element ? colorGuidanceFor(element) : null;

  // Doi chieu mau cua set do voi menh cua nguoi dang xem. Chi de GIAI THICH,
  // khong chan gi ca.
  const menhMatch = guidance
    ? outfit.color_slugs.filter((c) => {
        const el = tax.colorElements[c];
        return el === guidance.tuongSinh || el === guidance.banMenh;
      })
    : [];
  const menhAvoid = guidance
    ? outfit.color_slugs.filter((c) => tax.colorElements[c] === guidance.hanChe)
    : [];

  return (
    <article className="pb-24">
      {/* ---------------------------------------------------------------- */}
      {/* Anh lon + thong tin chinh                                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="shell pt-10 md:pt-14">
        <Link href="/kham-pha" className="eyebrow mb-8 inline-block hover:underline">
          ← Khám phá
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="frame drift-sm">
            {outfit.hero_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={outfit.hero_image_url} alt={outfit.title} />
            ) : (
              <div className="frame frame-empty absolute inset-0">
                Chưa có ảnh cho set đồ này
              </div>
            )}
          </div>

          <div className="lg:pt-4">
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {outfit.is_seed && <SeedTag />}
              {outfit.ai_generated && <AiTag />}
              {outfit.status !== 'published' && <StatusTag status={outfit.status} />}
            </div>

            <h1 className="display-sm mb-5">{outfit.title}</h1>

            {/* Nut luu o trang chi tiet la dang DAY DU co chu, khac nut gon
                tren the outfit: o day co cho, va day la luc nguoi ta da doc ky
                va dang quyet dinh. */}
            <SaveButton outfitId={outfit.id} full className="mb-5" />

            {outfit.description && (
              <p className="muted mb-8 text-lg leading-relaxed">{outfit.description}</p>
            )}

            <dl className="mb-8 flex flex-col gap-3 border-y py-5" style={{ borderColor: 'var(--line)' }}>
              <Row label="Phong cách" value={tax.styleLabel(outfit.style_slug)} />
              <Row label="Dịp" value={tax.occasionLabel(outfit.occasion_slug)} />
              <Row
                label="Tổng tạm tính"
                value={`${formatVnd(outfit.total_price_vnd)} cho ${items.length} món`}
              />
              {outfit.published_at && (
                <Row label="Đăng" value={formatRelative(outfit.published_at)} />
              )}
            </dl>

            <div className="mb-8">
              <p className="eyebrow mb-2">Bảng màu</p>
              <div className="flex flex-wrap gap-2">
                {outfit.color_slugs.map((c) => (
                  <span key={c} className="chip" style={{ cursor: 'default' }}>
                    <span className="swatch" style={{ background: tax.colorHex(c) }} />
                    {tax.colorLabel(c)}
                  </span>
                ))}
              </div>
            </div>

            {/* Doi chieu menh — chi giai thich, khong khang dinh gi ve van menh. */}
            {menhOn && guidance && (
              <div className="notice">
                <p className="eyebrow mb-2">Đối chiếu mệnh {NGU_HANH_LABEL[element!]}</p>
                {menhMatch.length > 0 && (
                  <p className="text-sm">
                    Có {menhMatch.length} màu được cho là hợp mệnh của bạn:{' '}
                    {menhMatch.map((c) => tax.colorLabel(c)).join(', ')}.
                  </p>
                )}
                {menhAvoid.length > 0 && (
                  <p className="muted mt-1 text-sm">
                    Có {menhAvoid.length} màu thuộc hành {NGU_HANH_LABEL[guidance.hanChe]} —
                    theo quan niệm ngũ hành thì nên hạn chế:{' '}
                    {menhAvoid.map((c) => tax.colorLabel(c)).join(', ')}.
                  </p>
                )}
                {menhMatch.length === 0 && menhAvoid.length === 0 && (
                  <p className="muted text-sm">
                    Bảng màu của set này trung tính với mệnh của bạn.
                  </p>
                )}
                <p className="muted-2 mt-2 text-xs">
                  Chỉ là gợi ý màu sắc mang tính tham khảo.{' '}
                  <Link href="/ho-so" className="underline">
                    Tắt gợi ý theo mệnh
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Danh sach san pham                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="shell mt-20">
        <h2 className="display-sm mb-2">
          <span style={c.s('outfit.items_heading')}>
            {c.t('outfit.items_heading', 'Các món trong set')}
          </span>
        </h2>
        <p className="muted-2 mb-8 text-sm">
          Bấm để sang sàn. PHỐI không bán hàng — bạn mua trực tiếp trên Shopee
          hoặc TikTok Shop.
        </p>

        {items.length === 0 ? (
          <EmptyState title="Set đồ này chưa có sản phẩm nào" />
        ) : (
          <div className="border-t" style={{ borderColor: 'var(--line)' }}>
            {items.map((it) => (
              <ProductRow
                key={it.id}
                product={it.products}
                link={it.affiliate_links}
                role={it.role}
                outfitId={outfit.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Bon nut phan hoi                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="shell mt-16">
        <FeedbackBar
          outfitId={outfit.id}
          colorSlugs={outfit.color_slugs}
          styleSlug={outfit.style_slug}
          onDone={reload}
        />
      </div>

      {outfit.ai_generated && (
        <div className="shell mt-12">
          <div className="notice notice-warn">
            Ảnh trong bài này do AI tạo ra. Ảnh chỉ mô tả tinh thần của cách phối —
            không đảm bảo giống tuyệt đối sản phẩm thật về màu sắc, hoạ tiết hay
            chi tiết in. Xem ảnh gốc của từng sản phẩm trên sàn trước khi mua.
          </div>
        </div>
      )}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}
