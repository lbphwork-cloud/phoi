'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { AFFILIATE_LINK_ATTRS } from '@/lib/affiliate';
import { formatVnd, formatVndShort, priceFreshnessNote } from '@/lib/format';
import { useReveal, useTaxonomy } from '@/lib/hooks';
import { SaveButton } from '@/components/SaveButton';
import type { ScoreBreakdown } from '@/lib/scoring';
import type {
  AffiliateLink, Outfit, OutfitStatus, Product,
} from '@/lib/supabase/types';
import { ITEM_ROLE_LABEL, STATUS_LABEL } from '@/lib/supabase/types';

/** Nhan trang thai bai dang, mau theo muc do can chu y. */
export function StatusTag({ status }: { status: OutfitStatus }) {
  const cls: Record<OutfitStatus, string> = {
    draft: 'tag-quiet',
    pending: 'tag-warn',
    needs_revision: 'tag-warn',
    approved: 'tag-ok',
    rejected: 'tag-danger',
    published: 'tag-ok',
    hidden: 'tag-danger',
  };
  return <span className={`tag ${cls[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** Nhan du lieu mau, de khong lan voi du lieu that. */
export function SeedTag() {
  return <span className="tag tag-quiet">Dữ liệu mẫu</span>;
}

/** Nhan bat buoc cho anh do AI tao (de bai muc 7). */
export function AiTag() {
  return <span className="tag tag-warn">Ảnh tạo bởi AI</span>;
}

export function OutfitCard({
  outfit,
  score,
  href,
  onDislike,
}: {
  outfit: Pick<
    Outfit,
    'id' | 'slug' | 'title' | 'hero_image_url' | 'style_slug' | 'occasion_slug'
    | 'color_slugs' | 'total_price_vnd' | 'ai_generated' | 'is_seed' | 'status'
  >;
  score?: ScoreBreakdown;
  href?: string;
  /**
   * Bat nut "khong thich" ngay tren the.
   *
   * VI SAO O DAY CHU KHONG PHAI CHI O TRANG CHI TIET
   *   Nguoi dung loai tru nhanh hon nhieu so voi chon. Luot qua mot luoi va
   *   thay ngay ba bo do khong hop gu minh — bat ho mo tung bai roi quay lai
   *   chi de noi "khong thich" thi khong ai lam. Cho phan hoi ngay tai cho thi
   *   thu tu goi y sua duoc trong vai giay.
   */
  onDislike?: () => void;
}) {
  const ref = useReveal<HTMLDivElement>();
  const tax = useTaxonomy();
  const [dismissing, setDismissing] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);

  /**
   * Ghi mot phan hoi 'dislike_pairing' cho ca set.
   *
   * Chon 'dislike_pairing' chu khong phai 'hide': an han thi bai bien mat khoi
   * moi ket qua ve sau, ma mot cu bam nhanh tren luoi khong nen co hau qua nang
   * den vay. dislike_pairing chi day bai xuong duoi (trong so -100 trong
   * src/lib/scoring.ts) — van tim lai duoc neu bam nham.
   */
  const dislike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sb = getSupabase();
    if (!sb) return;

    const { data: s } = await sb.auth.getSession();
    if (!s.session) {
      setDismissError('Cần đăng nhập để phản hồi.');
      return;
    }

    setDismissing(true);
    setDismissError(null);

    const { error } = await sb.from('feedback_events').insert({
      user_id: s.session.user.id,
      outfit_id: outfit.id,
      kind: 'dislike_pairing',
      target_value: null,
    });

    setDismissing(false);
    if (error) { setDismissError(error.message); return; }
    onDislike?.();
  };

  return (
    <div ref={ref} className="reveal group/card relative">
      {/* Nut luu nam canh nut khong thich, cung goc tren ben phai. Hai nut
          nay la hai huong cua cung mot quyet dinh — thich hay khong — nen dat
          canh nhau de mat khong phai di tim. */}
      <SaveButton outfitId={outfit.id} className="btn-save-card" />

      {onDislike && (
        <button
          type="button"
          onClick={dislike}
          disabled={dismissing}
          title="Không thích set này — đẩy xuống cuối danh sách"
          aria-label={`Không thích ${outfit.title}`}
          className="btn-dismiss"
        >
          {dismissing ? '…' : '✕'}
        </button>
      )}

      <Link href={href ?? `/outfit/${outfit.slug}`} className="group block">
        <div className="frame mb-3">
          {outfit.hero_image_url ? (
            // Dung <img> thay vi next/image: voi output static export thi
            // toi uu anh cua Next bi tat, nen next/image chi them phuc tap.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={outfit.hero_image_url} alt={outfit.title} loading="lazy" />
          ) : (
            <div className="frame frame-empty absolute inset-0">Chưa có ảnh</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {outfit.is_seed && <SeedTag />}
          {outfit.ai_generated && <AiTag />}
          {outfit.status !== 'published' && <StatusTag status={outfit.status} />}
        </div>

        <p className="display-xs mt-2 leading-snug">{outfit.title}</p>

        <p className="muted-2 mt-1 text-xs">
          {tax.styleLabel(outfit.style_slug)}
          {outfit.occasion_slug && ` · ${tax.occasionLabel(outfit.occasion_slug)}`}
          {outfit.total_price_vnd !== null && ` · ${formatVndShort(outfit.total_price_vnd)}`}
        </p>

        <div className="mt-2 flex items-center gap-1">
          {outfit.color_slugs.slice(0, 5).map((c) => (
            <span
              key={c}
              className="swatch"
              style={{ background: tax.colorHex(c) }}
              title={tax.colorLabel(c)}
            />
          ))}
        </div>
      </Link>

      {dismissError && <p className="hint-error">{dismissError}</p>}

      {/* Giai thich vi sao outfit nay duoc goi y. Minh bach quan trong hon
          cam giac "he thong thong minh": nguoi dung sua duoc so thich khi
          thay ly do sai.                                                   */}
      {score && score.parts.length > 0 && (
        <details className="mt-2">
          <summary className="eyebrow cursor-pointer">Vì sao gợi ý này</summary>
          <ul className="muted-2 mt-1.5 flex flex-col gap-0.5 text-xs">
            {score.parts.map((p, i) => (
              <li key={i}>
                {p.points > 0 ? '+' : ''}{p.points} · {p.label}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Nut mua hang tro ra san.
 *
 * Ba viec dong thoi:
 *   1. Ghi mot dong vao click_events (khach chua dang nhap cung ghi duoc).
 *   2. Gan rel="sponsored nofollow noopener noreferrer" — cong bo lien ket
 *      tiep thi, khong truyen uy tin SEO, va chan trang dich truy cap
 *      window.opener cua minh.
 *   3. Mo tab moi de nguoi dung khong mat trang dang xem.
 *
 * Ghi click la fire-and-forget: neu that bai thi van cho nguoi dung di tiep.
 * Mat mot dong thong ke con hon chan nguoi dung mua hang.
 */
export function AffiliateButton({
  link,
  productId,
  outfitId,
  children,
  className = 'btn btn-solid w-full',
}: {
  link: AffiliateLink | null;
  productId: string;
  outfitId: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!link || !link.is_active) {
    return (
      <button type="button" className="btn w-full" disabled>
        Chưa có link mua
      </button>
    );
  }

  const track = () => {
    const sb = getSupabase();
    if (!sb) return;
    void sb.from('click_events').insert({
      outfit_id: outfitId,
      product_id: productId,
      affiliate_link_id: link.id,
    });
  };

  return (
    <a
      href={link.url}
      onClick={track}
      onAuxClick={track}
      className={className}
      {...AFFILIATE_LINK_ATTRS}
    >
      {/* CO Y khong ghi ten san vao nut. Mot set do co the tron ca link Shopee
          lan TikTok Shop, nen mot nut ghi "Mua tren Shopee" nam canh mot nut
          "Mua tren TikTok" trong roi va de bam nham. Ten san van hien o the
          nho ben canh, do la cho dung de noi no. */}
      {children ?? 'Xem sản phẩm'}
    </a>
  );
}

/** Mot dong san pham trong trang chi tiet outfit. */
export function ProductRow({
  product,
  link,
  role,
  outfitId,
}: {
  product: Product | null;
  link: AffiliateLink | null;
  role: keyof typeof ITEM_ROLE_LABEL;
  outfitId: string;
}) {
  const tax = useTaxonomy();
  if (!product) return null;

  return (
    <div
      className="flex flex-col gap-4 border-b py-6 sm:flex-row"
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="frame frame-square w-full shrink-0 sm:w-32">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} loading="lazy" />
        ) : (
          <div className="frame frame-empty absolute inset-0">Chưa có ảnh</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="eyebrow">{ITEM_ROLE_LABEL[role]}</p>
        <p className="mt-1 font-medium">{product.name}</p>

        <p className="muted-2 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {product.color_slug && (
            <span className="inline-flex items-center gap-1.5">
              <span className="swatch" style={{ background: tax.colorHex(product.color_slug) }} />
              {tax.colorLabel(product.color_slug)}
            </span>
          )}
          {product.is_seed && <SeedTag />}
        </p>

        <p className="mt-2 font-medium">{formatVnd(product.price_vnd)}</p>
        {/* Khong co API dong bo gia, nen phai noi ro gia cu tori dau. */}
        <p className="muted-2 text-xs">{priceFreshnessNote(product.price_checked_at)}</p>
      </div>

      <div className="w-full sm:w-40 sm:self-center">
        <AffiliateButton link={link} productId={product.id} outfitId={outfitId} />
        {link?.is_alive === false && (
          <p className="hint-error text-xs">Link có thể đã hỏng</p>
        )}
      </div>
    </div>
  );
}

/**
 * Bon nut phan hoi cua de bai muc 3.
 *
 * "An outfit" khac ba nut con lai: no loai outfit khoi ket qua han, nen phai
 * xac nhan truoc khi ghi.
 */
export function FeedbackBar({
  outfitId,
  colorSlugs,
  styleSlug,
  onDone,
}: {
  outfitId: string;
  colorSlugs: string[];
  styleSlug: string | null;
  onDone?: () => void;
}) {
  const tax = useTaxonomy();
  const [sent, setSent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askHide, setAskHide] = useState(false);

  const send = async (kind: string, targetValue: string | null, tokenId: string) => {
    const sb = getSupabase();
    if (!sb) return;

    const { data: s } = await sb.auth.getSession();
    if (!s.session) {
      setError('Cần đăng nhập để phản hồi. Phản hồi chỉ dùng để điều chỉnh gợi ý cho riêng bạn.');
      return;
    }

    setBusy(true);
    setError(null);

    const { error: e } = await sb.from('feedback_events').insert({
      user_id: s.session.user.id,
      outfit_id: outfitId,
      kind,
      target_value: targetValue,
    });

    setBusy(false);
    if (e) { setError(e.message); return; }

    setSent((v) => [...v, tokenId]);
    onDone?.();
  };

  const done = (id: string) => sent.includes(id);

  return (
    <div className="border-t pt-6" style={{ borderColor: 'var(--line)' }}>
      <p className="eyebrow mb-3">Phản hồi để gợi ý sát hơn</p>

      <div className="flex flex-wrap gap-2">
        {colorSlugs.map((c) => (
          <button
            key={c}
            type="button"
            disabled={busy || done(`color:${c}`)}
            onClick={() => send('dislike_color', c, `color:${c}`)}
            className="chip"
          >
            <span className="swatch" style={{ background: tax.colorHex(c) }} />
            {done(`color:${c}`) ? `Đã bỏ ${tax.colorLabel(c)}` : `Không thích màu ${tax.colorLabel(c)}`}
          </button>
        ))}

        {styleSlug && (
          <button
            type="button"
            disabled={busy || done('style')}
            onClick={() => send('dislike_style', styleSlug, 'style')}
            className="chip"
          >
            {done('style')
              ? `Đã bỏ ${tax.styleLabel(styleSlug)}`
              : `Không thích phong cách ${tax.styleLabel(styleSlug)}`}
          </button>
        )}

        <button
          type="button"
          disabled={busy || done('pairing')}
          onClick={() => send('dislike_pairing', null, 'pairing')}
          className="chip"
        >
          {done('pairing') ? 'Đã ghi nhận' : 'Không thích cách phối'}
        </button>

        {!askHide ? (
          <button type="button" onClick={() => setAskHide(true)} className="chip">
            Ẩn outfit này
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || done('hide')}
              onClick={() => send('hide_outfit', null, 'hide')}
              className="chip"
              aria-pressed
            >
              {done('hide') ? 'Đã ẩn' : 'Xác nhận ẩn'}
            </button>
            <button type="button" onClick={() => setAskHide(false)} className="btn btn-quiet btn-sm">
              Thôi
            </button>
          </span>
        )}
      </div>

      {error && <p className="hint-error">{error}</p>}

      <p className="muted-2 mt-3 text-xs">
        Phản hồi chỉ ảnh hưởng tới gợi ý của riêng bạn, không ảnh hưởng người khác
        và không hiển thị công khai.
      </p>
    </div>
  );
}
