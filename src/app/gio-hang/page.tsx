'use client';

/**
 * Gio hang: cac set do da luu, kem toan bo san pham ben trong.
 *
 * VI SAO LIET KE TUNG MON CHU KHONG CHI LIET KE SET
 *   Muc dich cua trang nay la "mua sau mot luot". Neu chi hien anh cac set thi
 *   nguoi dung van phai bam vao tung set, doc lai, roi moi bam mua — dung so
 *   thao tac nhu khong co gio hang. Doi hien tat ca cac mon ra mot danh sach
 *   phang thi ho bam lan luot tu tren xuong.
 *
 *   PHOI khong gop duoc gio hang cua Shopee hay TikTok: hai san khong co cach
 *   nao cho mot website ben ngoai lam viec do, va neu co thi no cung se doi
 *   quyen truy cap tai khoan nguoi dung. Nen "mot luot" o day nghia la mot
 *   danh sach, khong phai mot lan thanh toan.
 *
 * LINK HONG DUOC BAO NGAY TAI DAY
 *   Mot set luu hai tuan roi mo ra bam ma san da go hang thi rat buc. Cong viec
 *   kiem tra link hang tuan da ghi ket qua vao affiliate_links; o day chi viec
 *   hien no ra.
 */

import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAsyncData, useAuth, useTaxonomy } from '@/lib/hooks';
import { useContent } from '@/lib/content';
import { useSaved, SAVED_LIMIT } from '@/lib/saved';
import { EmptyState, SetupNotice, Spinner } from '@/components/site';
import { AffiliateButton } from '@/components/outfit';
import { formatVnd, formatRelative } from '@/lib/format';
import { ITEM_ROLE_LABEL } from '@/lib/supabase/types';
import type { OutfitWithItems } from '@/lib/supabase/types';

export default function CartPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Cart />;
}

function Cart() {
  const { session, loading: authLoading } = useAuth();
  const tax = useTaxonomy();
  const c = useContent();
  const saved = useSaved();

  const savedIds = saved.rows.map((r) => r.outfit_id);

  const { data, loading } = useAsyncData<OutfitWithItems[]>(
    `cart-outfits-${savedIds.join(',')}`,
    (sb) =>
      sb
        .from('outfits')
        .select('*, outfit_items(*, products(*), affiliate_links(*))')
        .in('id', savedIds)
        .then(({ data: r, error }) => ({ data: (r as OutfitWithItems[] | null) ?? [], error })),
    savedIds.length > 0,
  );

  if (authLoading) return <Spinner />;

  if (!session) {
    return (
      <div className="shell-narrow py-20 text-center">
        <p className="eyebrow mb-4">Giỏ hàng</p>
        <h1 className="display-sm mb-6">Cần đăng nhập để dùng giỏ</h1>
        <p className="muted mx-auto mb-8 max-w-md text-sm leading-relaxed">
          Giỏ gắn với tài khoản nên bạn mở lại được trên bất kỳ máy nào. Tối đa{' '}
          {SAVED_LIMIT} set đồ.
        </p>
        <Link href="/dang-nhap" className="btn btn-solid">Đăng nhập</Link>
      </div>
    );
  }

  if (saved.loading || loading) return <Spinner label="Đang tải giỏ" />;

  // Giu dung thu tu da luu: moi nhat len truoc. Truy van `in` khong bao dam
  // thu tu, nen phai sap lai theo danh sach goc.
  const outfits = savedIds
    .map((id) => (data ?? []).find((o) => o.id === id))
    .filter((o): o is OutfitWithItems => Boolean(o));

  return (
    <div className="shell py-12 md:py-16">
      <div className="mb-10">
        <p className="eyebrow mb-4">
          <span style={c.s('cart.title')}>{c.t('cart.title', 'Set đồ đã lưu')}</span>
        </p>
        <h1 className="display-sm mb-4">
          {saved.rows.length} / {SAVED_LIMIT} set
        </h1>
        <p className="muted max-w-2xl text-sm leading-relaxed">
          <span style={c.s('cart.subtitle')}>
            {c.t(
              'cart.subtitle',
              'Những set bạn đánh dấu để mua sau. Tối đa 20 set. ' +
                'PHỐI không bán hàng — mỗi món dẫn thẳng sang Shopee hoặc TikTok Shop.',
            )}
          </span>
        </p>
      </div>

      {/* Gio day thi noi ro SET NAO CU NHAT. Chi bao "da day" la bat nguoi ta
          tu di tim cai de bo. */}
      {saved.full && (
        <div className="notice notice-warn mb-8">
          Giỏ đã đủ {SAVED_LIMIT} set. Muốn thêm set mới thì bỏ bớt một set —
          {saved.oldest && (
            <>
              {' '}cũ nhất là set lưu {formatRelative(saved.oldest.created_at)}, nằm cuối
              danh sách dưới đây.
            </>
          )}
        </div>
      )}

      {outfits.length === 0 ? (
        <EmptyState title={c.t('cart.empty', 'Chưa có set nào trong giỏ.')}>
          Mở <Link href="/kham-pha" className="underline">trang khám phá</Link> và bấm dấu
          cộng ở góc ảnh để lưu set đầu tiên.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-14">
          {outfits.map((o) => {
            const items = [...(o.outfit_items ?? [])].sort((a, b) => a.position - b.position);

            return (
              <section key={o.id}>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Link href={`/outfit/${o.slug}`} className="block w-20 shrink-0">
                      <div className="frame">
                        {o.hero_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.hero_image_url} alt="" loading="lazy" />
                        ) : (
                          <div className="frame frame-empty absolute inset-0">—</div>
                        )}
                      </div>
                    </Link>
                    <div>
                      <Link href={`/outfit/${o.slug}`} className="display-xs">
                        {o.title}
                      </Link>
                      <p className="muted-2 mt-1 text-xs">
                        {tax.styleLabel(o.style_slug)}
                        {o.total_price_vnd !== null && ` · ${formatVnd(o.total_price_vnd)} cả set`}
                        {` · ${items.length} món`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    onClick={() => void saved.remove(o.id)}
                  >
                    Bỏ khỏi giỏ
                  </button>
                </div>

                <div className="flex flex-col">
                  {items.map((it) => {
                    const p = it.products;
                    const link = it.affiliate_links;
                    // Cong viec kiem tra link hang tuan ghi vao cot nay.
                    // `is_alive` la ba trang thai: true / false / null (chua
                    // kiem bao gio). Chi bao hong khi chac chan la false —
                    // "chua kiem" khong phai "da hong".
                    const dead = link?.is_alive === false;

                    return (
                      <div
                        key={it.id}
                        className="flex flex-wrap items-center gap-4 border-b py-3"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        <div className="w-14 shrink-0">
                          <div className="frame frame-square">
                            {p?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" loading="lazy" />
                            ) : (
                              <div className="frame frame-empty absolute inset-0">—</div>
                            )}
                          </div>
                        </div>

                        <div className="min-w-[12rem] flex-1">
                          <p className="text-sm">{p?.name ?? 'Sản phẩm đã bị xoá'}</p>
                          <p className="muted-2 text-xs">
                            {ITEM_ROLE_LABEL[it.role]}
                            {p?.price_vnd ? ` · ${formatVnd(p.price_vnd)}` : ''}
                          </p>
                          {dead && (
                            <p className="hint-error">
                              Lần kiểm tra gần nhất không mở được link này — sàn có thể đã
                              gỡ hàng.
                            </p>
                          )}
                        </div>

                        {link && p && !dead && (
                          <AffiliateButton link={link} productId={p.id} outfitId={o.id} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="muted-2 mt-12 border-t pt-8 text-xs leading-relaxed"
         style={{ borderColor: 'var(--line)' }}>
        Giỏ này chỉ là danh sách đánh dấu của riêng bạn — PHỐI không bán hàng, không giữ
        tiền và không thấy được giỏ Shopee hay TikTok của bạn. Giá hiển thị là giá ghi
        nhận lúc người đăng nhập liệu, kiểm tra lại trên sàn trước khi đặt.
      </p>
    </div>
  );
}
