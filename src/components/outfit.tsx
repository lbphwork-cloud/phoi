'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { AFFILIATE_LINK_ATTRS } from '@/lib/affiliate';
import { formatVnd, formatVndShort, priceFreshnessNote } from '@/lib/format';
import { useReveal, useTaxonomy } from '@/lib/hooks';
import { SaveButton } from '@/components/SaveButton';
import { BAC_HOP_CA_BO, type ScoreBreakdown } from '@/lib/scoring';
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

/*
  NHAN "Du lieu mau" DA BO KHOI TOAN BO WEBSITE.

  No tung hien tren the outfit, tren trang chi tiet, tren tung san pham va
  trong hai trang quan tri. Chu website goi dung ten: nhin rat thieu chuyen
  nghiep — mot nguoi la vao trang doc duoc dong do se hieu la website chua co
  hang that.

  Cot `is_seed` trong database GIU NGUYEN. No van dung cho cac phep kiem chung
  va van dem duoc, chi la khong hien ra man hinh nua. Xoa cot di thi moi phep
  kiem "dem dung du lieu mau" mat cho dua, ma chung dang bao ve nhung thu that.
*/

/** Nhan bat buoc cho anh do AI tao (de bai muc 7). */
export function AiTag() {
  return <span className="tag tag-warn">Ảnh tạo bởi AI</span>;
}

export function OutfitCard({
  outfit,
  score,
  hopMenh,
  href,
  onDislike,
}: {
  outfit: Pick<
    Outfit,
    'id' | 'slug' | 'title' | 'hero_image_url' | 'style_slug' | 'occasion_slug'
    | 'color_slugs' | 'total_price_vnd' | 'ai_generated' | 'is_seed' | 'status'
  >;
  score?: ScoreBreakdown;
  /**
   * Cac slug mau cua CHINH bai nay ma hop menh nguoi dang xem.
   *
   * Trang goi truyen vao thay vi the tu tinh: chi trang do moi biet nien menh
   * cua nguoi dung, va tinh mot lan cho ca luoi re hon tinh lai o tung the.
   */
  hopMenh?: string[];
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
   * Y kien da bam trong phien nay.
   *
   * CHI LA TRANG THAI CUC BO, khong doc lai tu database. Doc trang thai thich
   * cua tung the nghia la mot luot goi mang cho moi the tren luoi — hai muoi
   * the la hai muoi luot, de lay ve mot dau tich. Cai bam vao van duoc ghi va
   * van doi thu tu goi y o lan tai sau; chi rieng dau tich tren man hinh la
   * khong song qua mot lan tai lai trang.
   */
  const [opinion, setOpinion] = useState<'like' | 'dislike' | null>(null);

  /**
   * Ghi mot phan hoi 'dislike_pairing' cho ca set.
   *
   * Chon 'dislike_pairing' chu khong phai 'hide': an han thi bai bien mat khoi
   * moi ket qua ve sau, ma mot cu bam nhanh tren luoi khong nen co hau qua nang
   * den vay. dislike_pairing chi day bai xuong duoi (trong so -100 trong
   * src/lib/scoring.ts) — van tim lai duoc neu bam nham.
   */
  const react = (kind: 'like' | 'dislike') => async (e: React.MouseEvent) => {
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
      kind: kind === 'like' ? 'like_pairing' : 'dislike_pairing',
      target_value: null,
    });

    setDismissing(false);
    if (error) { setDismissError(error.message); return; }
    setOpinion(kind);

    // CHI bao ra ngoai khi KHONG thich. Trang kham pha dung tin hieu do de bo
    // the khoi danh sach — con mot the vua duoc thich thi phai o nguyen cho,
    // neu khong thi bam thich lai lam no bien mat, dung nguoc y nguoi bam.
    if (kind === 'dislike') onDislike?.();
  };

  /*
    THE CAO BANG NHAU TRONG CUNG MOT HANG.

    VAN DE: ten set do dai ngan khac nhau — co cai mot dong, co cai ba dong —
    nen phan chu duoi anh cao thap khac nhau, va nut "Lưu vào giỏ" cua tung the
    nam o do cao khac nhau. Nhin ca luoi thi hang khong con thang.

    CACH CHUA: the la mot cot flex cao het o luoi, phan chu bi gioi han dung
    HAI DONG, va nut bi day xuong day bang `mt-auto`. Nho vay moi nut deu nam
    tren mot duong ngang, bat ke ten dai bao nhieu.

    Chon giu BO CUC hon giu CHU DU: chu website noi ro "ưu tiên giữ bố cục
    đều". Ten bi cat con doc duoc phan dau, va ten day du van nam trong thuoc
    tinh title lan trang chi tiet.
  */
  return (
    <div ref={ref} className="reveal group/card relative flex h-full flex-col">
      {/*
        HAI NUT Y KIEN, dat canh nhau o goc tren ben phai.

        Truoc day o day la dau "+" (them vao gio) va dau "x" (khong thich).
        Hai van de: dau "+" lap lai chinh nut "Thêm vào giỏ" day du ngay ben
        duoi the, con mot dau "x" o goc anh thi ai cung doc thanh "dong lai"
        hoac "xoa" chu khong doc thanh "khong thich".

        Gio la mot cap doi xung — trai tim va trai tim gach cheo. Hai huong cua
        cung mot cau hoi thi phai nhin nhu mot cap, khong phai hai bieu tuong
        vay muon tu hai y nghia khac nhau.

        TRANG DEN, khong mau. Mau tren mot the anh thoi trang se tranh cho voi
        chinh buc anh — ma buc anh moi la thu nguoi ta vao day de xem.
      */}
      {onDislike && (
        <div className="card-actions">
          <button
            type="button"
            onClick={react('like')}
            disabled={dismissing}
            title="Thích cách phối này — ưu tiên gợi ý set tương tự"
            aria-label={`Thích ${outfit.title}`}
            aria-pressed={opinion === 'like'}
            className="btn-react"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"
                 fill={opinion === 'like' ? 'currentColor' : 'none'}>
              <path
                d="M12 20s-7-4.35-7-9.15A4.85 4.85 0 0 1 12 7a4.85 4.85 0 0 1 7 3.85C19 15.65 12 20 12 20Z"
                stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={react('dislike')}
            disabled={dismissing}
            title="Không thích cách phối này — đẩy xuống cuối danh sách"
            aria-label={`Không thích ${outfit.title}`}
            aria-pressed={opinion === 'dislike'}
            className="btn-react"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 20s-7-4.35-7-9.15A4.85 4.85 0 0 1 12 7a4.85 4.85 0 0 1 7 3.85C19 15.65 12 20 12 20Z"
                stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
              />
              <path d="M4.5 4.5 19.5 19.5" stroke="currentColor" strokeWidth="1.7"
                    strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <Link href={href ?? `/outfit/${outfit.slug}`} className="group block">
        {/* `drift`: anh troi nhe nguoc chieu cuon. Hieu ung phong to khi di
            chuot qua van chay song song — no dung thuoc tinh `scale` rieng chu
            khong tranh cho tren `transform`. Xem chu thich .frame > img. */}
        <div className="frame drift mb-3">
          {outfit.hero_image_url ? (
            // Dung <img> thay vi next/image: voi output static export thi
            // toi uu anh cua Next bi tat, nen next/image chi them phuc tap.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={outfit.hero_image_url} alt={outfit.title} loading="lazy" />
          ) : (
            <div className="frame frame-empty absolute inset-0">Chưa có ảnh</div>
          )}
        </div>

        {/* NHAN "Du lieu mau" DA BO KHOI THE OUTFIT.
            No chiem dung cho de thay nhat tren the ma khong giup nguoi xem
            quyet dinh gi — va toan bo du lieu mau roi se duoc thay bang hang
            that. Nhan van con trong cac trang quan tri, noi no thuc su co ich:
            do la cho quan tri vien biet con bao nhieu bai can thay.

            NHAN "Anh tao boi AI" THI GIU. Do la cam ket voi nguoi xem chu khong
            phai mot chi tiet giao dien — bo di la noi doi. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {outfit.ai_generated && <AiTag />}
          {outfit.status !== 'published' && <StatusTag status={outfit.status} />}
        </div>

        {/*
          TOI DA HAI DONG, du thi cat bang dau ba cham.

          `minHeight` bang dung hai dong nen the co ten mot dong van chiem cho
          bang the co ten hai dong — neu chi cat ma khong giu cho thi hang van
          so le, chi do it hon.

          2,75em = 2 dong x 1,375 (leading-snug). `em` o day tinh theo co chu
          cua chinh the nay, nen no dung o moi co chu ma nguoi dung chon trong
          trang Nội dung.
        */}
        <p
          className="display-xs mt-2 line-clamp-2 leading-snug"
          style={{ minHeight: '2.75em' }}
          title={outfit.title}
        >
          {outfit.title}
        </p>

        {/* Mot dong, khong bao gio xuong dong: ba manh thong tin nay ngan va
            deu nhau, cho xuong dong la lai them mot nguon lam lech chieu cao. */}
        <p className="muted-2 mt-1 truncate text-xs">
          {tax.styleLabel(outfit.style_slug)}
          {outfit.occasion_slug && ` · ${tax.occasionLabel(outfit.occasion_slug)}`}
          {outfit.total_price_vnd !== null && ` · ${formatVndShort(outfit.total_price_vnd)}`}
        </p>

        {/*
          DANH DAU MAU HOP MENH NGAY TREN THE.

          Truoc day bam nut "uu tien mau hop menh" chi lam thu tu doi — nguoi
          dung khong biet BAI NAO duoc uu tien hay VI SAO. Mot vong tron quanh
          o mau tra loi ca hai, va tra loi ngay o cho mat dang nhin.

          Chi danh dau khi nguoi dung DA nhap ngay sinh va CHUA tat goi y theo
          menh — `hopMenh` rong thi khong ve gi. Khong quang cao mot tinh nang
          ho khong dung.
        */}
        <div className="mt-2 flex items-center gap-1">
          {outfit.color_slugs.slice(0, 5).map((c) => {
            const hop = hopMenh?.includes(c);
            return (
              <span
                key={c}
                className="swatch"
                style={{
                  background: tax.colorHex(c),
                  ...(hop ? { outline: '2px solid var(--fg)', outlineOffset: '2px' } : {}),
                }}
                title={hop ? `${tax.colorLabel(c)} — hợp mệnh của bạn` : tax.colorLabel(c)}
              />
            );
          })}
          {/*
            Nhan noi RO BAC, khong chi noi "hop menh".

            Ca hai truong hop deu la hop, nhung mot cai hop ca bo va mot cai hop
            dung mot mon — va thu tu tren trang phan anh dung khac biet do. Nhan
            chung chung se lam nguoi dung khong hieu vi sao hai the cung "hop"
            ma lai khong dung nhau.
          */}
          {hopMenh && hopMenh.length > 0 && (
            <span className="muted-2 ml-1 text-xs">
              {hopMenh.length >= BAC_HOP_CA_BO ? 'hợp cả bộ' : 'hợp một món'}
            </span>
          )}
        </div>
      </Link>

      {/* Nut them vao gio dang DAY DU, dat ngay duoi phan chu.
          Nut tron o goc anh van con — no danh cho nguoi luot nhanh. Nut nay
          danh cho nguoi da doc ten va gia roi moi quyet dinh, va no khong the
          bi nham voi bat ky thu gi khac vi no co chu. */}
      {/* `mt-auto` day nut xuong day the. Day la manh ghep con lai cua viec
          cho cac hang thang nhau: khong co no thi nut van bam theo do dai cua
          phan chu ngay tren no. */}
      <div className="mt-auto pt-3">
        <SaveButton outfitId={outfit.id} full className="btn-sm w-full" />
      </div>

      {dismissError && <p className="hint-error">{dismissError}</p>}

      {/* KHOI "Vi sao goi y nay" DA BO theo yeu cau cua chu website.
          No hien tren MOI the trong luoi, va noi dung la diem so noi bo — thu
          co ich khi kiem tra thuat toan nhung khong giup nguoi mua quyet dinh
          gi. Diem so van duoc tinh va van quyet dinh thu tu; chi bo phan hien
          ra. Tham so `score` giu nguyen trong giao dien de cac trang goi khong
          phai sua, va de bat lai duoc khi can do thuat toan. */}
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
