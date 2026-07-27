'use client';

/**
 * Sua noi dung cua cac trang: chu, anh, duong dan.
 *
 * VI SAO KHONG PHAI MOT O SOAN THAO GIAU DINH DANG
 *   O soan thao kieu Word cho phep dan vao chu dam, mau chu, co chu tuy y —
 *   va chi vai tuan la trang mat het tinh dong bo. O day moi o chi nhan chu
 *   THUAN; kieu chu do he thong thiet ke quyet dinh. Nguoi sua lo noi cai gi,
 *   giao dien lo trong the nao.
 *
 * XEM TRUOC
 *   Khoi tren cung dung lai phan mo dau cua trang chu bang GIA TRI DANG GO,
 *   truoc khi luu. Sua tieu de hero ma khong thay no nam tren anh ra sao thi
 *   rat de ra mot cau qua dai, vo dong o dien thoai.
 *
 * LUU TUNG O, KHONG PHAI MOT NUT LUU TAT CA
 *   Mot nut luu tat ca nghia la mot loi mang lam mat toan bo cong sua. Tung o
 *   luu rieng thi hong o nao biet ngay o do.
 */

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks';
import { useContent, heroAppearance, type ContentRow } from '@/lib/content';
import { uploadImage } from '@/lib/storage';
import { IMAGE_LIMITS } from '@/lib/format';
import { UploadButton } from '@/components/UploadButton';
import { FONT_LABEL } from '@/lib/typography';
import { Spinner, EmptyState } from '@/components/site';

/** Nhan tieng Viet cho cac gia tri cua o `choice`. */
const CHOICE_LABELS: Record<string, string> = {
  trang: 'Trắng', den: 'Đen',
  khong: 'Không', nhe: 'Nhẹ', vua: 'Vừa', dam: 'Đậm',
  toi: 'Nền tối', sang: 'Nền sáng', mo: 'Mờ nhẹ',
  'duoi-trai': 'Dưới, canh trái',
  'giua': 'Giữa khung',
  'duoi-giua': 'Dưới, canh giữa',
  'giua-nut-day': 'Giữa khung, nút dưới đáy',
  vien: 'Chỉ viền',

  // Kieu chu
  ...FONT_LABEL,
  'rat-nho': 'Rất nhỏ', nho: 'Nhỏ', lon: 'Lớn', 'rat-lon': 'Rất lớn',
  manh: 'Mảnh', thuong: 'Thường', 'rat-dam': 'Rất đậm',
  'theo-giao-dien': 'Theo giao diện (tự đổi sáng/tối)',
  xam: 'Xám', 'xam-nhat': 'Xám nhạt', nau: 'Nâu',
  'nhu-go': 'Như bạn gõ', 'in-hoa': 'IN HOA TOÀN BỘ',
};

/** Ten nhom hien cho nguoi dung. Khoa la cot `page` trong database. */
const PAGE_LABELS: Record<string, string> = {
  'kieu-chu': 'Kiểu chữ — font, cỡ, màu cho toàn website',
  'chung': 'Dùng chung — logo, tên trang, chân trang',
  'trang-chu': 'Trang chủ',
  'kham-pha': 'Trang khám phá',
  'ho-so': 'Trang hồ sơ',
  'dang-nhap': 'Trang đăng nhập',
  'tao-bai': 'Trang tạo bài',
  'du-lieu': 'Trang dữ liệu cá nhân',
  'outfit': 'Trang chi tiết set đồ',
  'bai-cua-toi': 'Trang bài của tôi',
};

/**
 * Thu tu cac nhom hien tren man hinh.
 *
 * TRUOC DAY THU TU LAY TU DATABASE, tuc la sap theo bang chu cai cua ma nhom.
 * Voi 89 o chia 10 nhom thi nguoi sua phai cuon qua ca danh sach de tim, va
 * nhom quan trong nhat co the nam bat ky dau. Kieu chu va nhung thu dung chung
 * cho ca website len dau; cac trang cu the theo sau.
 */
const PAGE_ORDER = Object.keys(PAGE_LABELS);

export default function ContentAdminPage() {
  const { session } = useAuth();
  const c = useContent();

  // Gia tri dang go, chua luu. Chi chua nhung o nguoi dung da dong vao.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Mac dinh hien TAT CA trang. 47 khoa chia 9 nhom van cuon duoc, va thay
  // het mot luot thi de nhan ra cho nao con bo trong.
  const [activePage, setActivePage] = useState<string>('tat-ca');

  if (c.loading) return <Spinner label="Đang tải nội dung" />;
  if (c.rows.length === 0) {
    return (
      <EmptyState title="Chưa có nội dung nào">
        Chạy <code>npm run db:apply</code> để tạo bảng <code>site_content</code>.
      </EmptyState>
    );
  }

  /** Gia tri hien tai cua mot khoa: uu tien ban dang go. */
  const val = (r: ContentRow) => draft[r.key] ?? r.value;

  const set = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedKey(null);
  };

  const save = async (r: ContentRow) => {
    const sb = getSupabase();
    if (!sb) return;

    setSavingKey(r.key);
    setErr(null);

    const { error } = await sb
      .from('site_content')
      .update({ value: val(r) })
      .eq('key', r.key);

    setSavingKey(null);

    if (error) {
      setErr(`Không lưu được "${r.label}": ${error.message}`);
      return;
    }

    setSavedKey(r.key);
    // Bo ban nhap cua o nay: gio gia tri that da bang gia tri go.
    setDraft((d) => {
      const next = { ...d };
      delete next[r.key];
      return next;
    });
    c.reload();
  };

  const onPickImage = async (r: ContentRow, file: File) => {
    if (!session) return;

    setSavingKey(r.key);
    setErr(null);

    const res = await uploadImage('outfit-images', session.user.id, file);
    if (!res.ok || !res.url) {
      setSavingKey(null);
      setErr(res.message);
      return;
    }

    set(r.key, res.url);
    setSavingKey(null);
  };

  // Nhom nao co trong PAGE_ORDER thi theo thu tu do; nhom la (them sau nay ma
  // quen khai bao) van hien, xep o cuoi — khong bao gio bi mat khoi man hinh.
  const found = [...new Set(c.rows.map((r) => r.page))];
  const pages = [
    ...PAGE_ORDER.filter((p) => found.includes(p)),
    ...found.filter((p) => !PAGE_ORDER.includes(p)),
  ];
  const shown = activePage === 'tat-ca' ? pages : pages.filter((p) => p === activePage);

  // Dien mao tinh tu gia tri DANG GO: doi o chon la ban xem truoc doi ngay.
  // Dung chung ham voi trang chu nen hai noi khong the lech nhau.
  const look = heroAppearance((k, f) => {
    const row = c.rows.find((r) => r.key === k);
    if (!row) return f;
    const v = draft[row.key] ?? row.value;
    return v.trim() === '' ? f : v;
  });

  // Gom cac khoa cua phan mo dau de dung khoi xem truoc.
  const hero = {
    eyebrow: c.rows.find((r) => r.key === 'home.hero.eyebrow'),
    title: c.rows.find((r) => r.key === 'home.hero.title'),
    subtitle: c.rows.find((r) => r.key === 'home.hero.subtitle'),
    cta: c.rows.find((r) => r.key === 'home.hero.cta_label'),
    image: c.rows.find((r) => r.key === 'home.hero.image'),
  };

  return (
    <div>
      <div className="mb-10">
        <h1 className="display-sm mb-3">Nội dung các trang</h1>
        <p className="muted max-w-2xl text-sm leading-relaxed">
          Mỗi ô lưu riêng. Để trống một ô thì trang dùng lại nội dung mặc định viết
          sẵn trong mã nguồn, nên không bao giờ có chỗ trắng.
        </p>
        <p className="muted-2 mt-2 max-w-2xl text-sm leading-relaxed">
          Font, cỡ chữ, độ đậm và màu chữ cho <strong>toàn website</strong> nằm ở nhóm
          đầu tiên — <em>Kiểu chữ</em>. Logo nằm ở nhóm <em>Dùng chung</em>.
        </p>
      </div>

      {err && <div className="notice notice-danger mb-8">{err}</div>}

      {/* Chon trang de sua. Mac dinh hien tat ca. */}
      <div className="mb-10 flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={activePage === 'tat-ca'}
                onClick={() => setActivePage('tat-ca')}>
          Tất cả ({c.rows.length})
        </button>
        {pages.map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={activePage === p}
                  onClick={() => setActivePage(p)}>
            {PAGE_LABELS[p] ?? p} ({c.rows.filter((r) => r.page === p).length})
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Xem truoc phan mo dau trang chu, dung gia tri DANG GO              */}
      {/* ------------------------------------------------------------------ */}
      {hero.title && (
        <div className="mb-12">
          <p className="eyebrow mb-4">Xem trước phần mở đầu trang chủ</p>
          <div
            className={`hero-media flex ${look.alignClass}`}
            style={{ minHeight: '24rem' }}
          >
            {hero.image && val(hero.image) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={val(hero.image)} alt="" aria-hidden="true" />
            )}
            {look.overlay !== 'none' && (
              <div className="absolute inset-0" style={{ background: look.overlay }} aria-hidden="true" />
            )}
            {/* Ban xem truoc phai theo DUNG ca kieu bo cuc, khong chi mau sac.
                Neu no bo qua splitCta thi doi sang kieu "nut duoi day" se thay
                mot dang, ma trang that lai ra mot dang khac — luc do ban xem
                truoc noi doi, va do la kieu loi lam nguoi ta het tin trang
                quan tri. */}
            <div
              className={`hero-body flex w-full flex-col p-8 ${look.splitCta ? 'h-full' : ''}`}
              style={look.textStyle}
            >
              <div className={look.splitCta ? 'flex flex-1 items-center justify-center' : ''}>
                <div className={look.boxStyle ? 'inline-block p-6' : ''} style={look.boxStyle}>
                  {hero.eyebrow && (
                    <p className="eyebrow mb-3" style={{ color: look.dimColor }}>
                      {val(hero.eyebrow)}
                    </p>
                  )}
                  <p className="display-sm whitespace-pre-line">{val(hero.title)}</p>
                  {hero.subtitle && !look.hideSubtitle && (
                    <p className="mt-4 max-w-lg text-sm leading-relaxed">{val(hero.subtitle)}</p>
                  )}
                  {hero.cta && !look.splitCta && (
                    <span className={`btn btn-sm mt-6 ${look.buttonClass}`}>{val(hero.cta)}</span>
                  )}
                </div>
              </div>

              {look.splitCta && hero.cta && (
                <div className="flex justify-center">
                  <span className={`btn btn-sm ${look.buttonClass}`}>{val(hero.cta)}</span>
                </div>
              )}
            </div>
          </div>
          <p className="muted-2 mt-3 text-xs">
            Bản xem trước đổi ngay khi bạn gõ. Trang thật chỉ đổi sau khi bấm Lưu.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Cac o nhap, gom theo trang                                         */}
      {/* ------------------------------------------------------------------ */}
      {shown.map((page) => (
        <section key={page} className="mb-14">
          <h2 className="display-xs mb-6 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
            {PAGE_LABELS[page] ?? page}
          </h2>

          <div className="flex flex-col gap-8">
            {c.rows
              .filter((r) => r.page === page)
              .map((r) => {
                const dirty = draft[r.key] !== undefined && draft[r.key] !== r.value;
                const busy = savingKey === r.key;

                return (
                  <div key={r.key}>
                    <label className="label" htmlFor={r.key}>
                      {r.label}
                    </label>

                    {r.kind === 'image' ? (
                      <div className="flex flex-col gap-3">
                        {val(r) && (
                          <div className="frame" style={{ maxWidth: '22rem' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={val(r)} alt="" />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                          <UploadButton
                            label="Chọn ảnh từ máy"
                            busy={busy}
                            maxBytes={IMAGE_LIMITS.outfit}
                            onPick={(f) => void onPickImage(r, f)}
                          />
                          {val(r) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-quiet"
                              onClick={() => set(r.key, '')}
                            >
                              Bỏ ảnh
                            </button>
                          )}
                        </div>
                      </div>
                    ) : r.kind === 'choice' ? (
                      <select
                        id={r.key}
                        className="field"
                        value={val(r)}
                        onChange={(e) => set(r.key, e.target.value)}
                      >
                        {r.options.map((o) => (
                          <option key={o} value={o}>{CHOICE_LABELS[o] ?? o}</option>
                        ))}
                      </select>
                    ) : r.kind === 'textarea' ? (
                      <textarea
                        id={r.key}
                        className="field"
                        rows={3}
                        value={val(r)}
                        onChange={(e) => set(r.key, e.target.value)}
                      />
                    ) : (
                      <input
                        id={r.key}
                        type="text"
                        className="field"
                        value={val(r)}
                        onChange={(e) => set(r.key, e.target.value)}
                      />
                    )}

                    {r.hint && <p className="hint">{r.hint}</p>}

                    {/* O nay quyet dinh KHOI NAO hien o trang chu va theo thu tu
                        nao. Thu tu bo loc lai nam o cho khac — noi ro ra day de
                        nguoi sua khoi doi o nay roi thac mac sao trang Kham pha
                        khong doi theo. */}
                    {r.key === 'home.styles.list' && (
                      <p className="hint">
                        Thứ tự bộ lọc ở trang Khám phá là một danh sách khác —{' '}
                        <a href="/admin/phong-cach" className="underline">
                          sửa ở trang Phong cách
                        </a>
                        .
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!dirty || busy}
                        onClick={() => void save(r)}
                      >
                        {busy ? 'Đang lưu…' : 'Lưu'}
                      </button>
                      {dirty && !busy && (
                        <button
                          type="button"
                          className="btn btn-sm btn-quiet"
                          onClick={() =>
                            setDraft((d) => {
                              const n = { ...d };
                              delete n[r.key];
                              return n;
                            })
                          }
                        >
                          Hoàn tác
                        </button>
                      )}
                      {savedKey === r.key && (
                        <span className="text-xs" style={{ color: 'var(--color-ok)' }}>
                          Đã lưu
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
