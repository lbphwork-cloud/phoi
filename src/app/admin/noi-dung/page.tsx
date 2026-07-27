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
import { FONT_LABEL, fieldStyleCss, parseFieldStyle } from '@/lib/typography';
import { FieldStyleRow } from '@/components/FieldStyleRow';
import { PreviewPane, usePreviewWidth } from '@/components/PreviewPane';
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
  // Nhom nay dung dau vi no chua nhung thu nguoi ngoai nhin thay TRUOC KHI mo
  // trang: tieu de tren tab, bieu tuong tab, doan mo ta trong ket qua Google.
  // Truoc day chung nam lan trong nhom "Dung chung" cung 60 o khac va chu
  // website tuong la chua co — mot tinh nang khong tim thay thi bang khong co.
  'nhan-dien': 'Nhận diện website — tiêu đề, biểu tượng tab, mô tả, logo',
  'kieu-chu': 'Kiểu chữ — font, cỡ, màu cho toàn website',
  'chung': 'Dùng chung — chữ trên thanh menu và chân trang',
  'trang-chu': 'Trang chủ',
  'gioi-thieu': 'Trang giới thiệu',
  'kham-pha': 'Trang khám phá',
  'ho-so': 'Trang hồ sơ',
  'dang-nhap': 'Trang đăng nhập',
  'tao-bai': 'Trang tạo bài',
  'du-lieu': 'Trang dữ liệu cá nhân',
  'outfit': 'Trang chi tiết set đồ',
  'bai-cua-toi': 'Trang bài của tôi',
  'gio-hang': 'Trang giỏ hàng',
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
  /** O nao dang sua ban dien thoai. Mac dinh moi o deu o ban may tinh. */
  const [variant, setVariant] = useState<Record<string, 'pc' | 'mobile'>>({});
  /** O dang duoc go. Quyet dinh khung ben canh dang hien cai gi. */
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = usePreviewWidth();

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

  /**
   * Ghi mot gia tri vao CA HAI ban.
   *
   * Ghi tuan tu chu khong song song: neu ban thu hai loi thi nguoi dung can
   * biet ban thu nhat da vao roi, de ho khong bam lai va ghi de mot lan nua.
   */
  const saveBoth = async (pc: ContentRow, mobile: ContentRow, value: string) => {
    const sb = getSupabase();
    if (!sb) return;

    setSavingKey(pc.key);
    setErr(null);

    for (const row of [pc, mobile]) {
      const { error } = await sb.from('site_content').update({ value }).eq('key', row.key);
      if (error) {
        setSavingKey(null);
        setErr(`Không lưu được "${row.label}": ${error.message}`);
        return;
      }
    }

    setSavingKey(null);
    setSavedKey(pc.key);
    setDraft((d) => {
      const n = { ...d };
      delete n[pc.key];
      delete n[mobile.key];
      return n;
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

  /**
   * Kieu chu rieng cua mot o, tinh tu gia tri DANG GO.
   *
   * Khong dung c.s() vi ham do doc gia tri da luu — ban xem truoc phai doi ngay
   * khi nguoi dung chon, truoc khi bam Luu.
   */
  const styleOf = (key: string) => {
    const row = c.rows.find((r) => r.key === `${key}.style`);
    if (!row) return undefined;
    return fieldStyleCss(parseFieldStyle(draft[row.key] ?? row.value));
  };

  /**
   * Thu tu hien cua cac o "Phong cach X" — bam theo thu tu THAT tren trang chu.
   *
   * VI SAO PHAI TINH LUC HIEN CHU KHONG DUA VAO sort_order
   *   Thu tu cac phong cach o trang chu do o `home.styles.list` quyet dinh, va
   *   o do sua duoc. sort_order trong database thi dat mot lan luc tao. Hai thu
   *   nay lech nhau ngay lan dau tien co nguoi doi thu tu tren trang chu — va
   *   lech roi thi khong co gi keo chung ve nhau nua.
   *
   *   Migration 0021 da sap lai mot lan cho khop. Nhung sap mot lan chi chua
   *   duoc trieu chung; doc thang tu `home.styles.list` moi la chua nguyen
   *   nhan. Chu website doi thu tu tren trang chu bao nhieu lan cung duoc, danh
   *   sach ben nay tu theo.
   */
  const styleRank = new Map(
    (c.rows.find((r) => r.key === 'home.styles.list')?.value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((slug, i) => [slug, i] as const),
  );

  /** Khoa sap xep cua mot dong. Dong thuong thi giu nguyen sort_order. */
  const rowRank = (key: string, sortOrder: number) => {
    const m = key.match(/^home\.style\.(.+?)\.(image|desc)/);
    if (!m) return sortOrder;
    const rank = styleRank.get(m[1]);
    // Phong cach khong nam trong danh sach trang chu (da bo khoi trang chu
    // nhung o noi dung van con) xep sau cung, khong bi mat.
    if (rank === undefined) return 1900 + sortOrder;
    return 1000 + rank * 10 + (m[2] === 'image' ? 0 : 1);
  };

  // Gom cac khoa cua phan mo dau de dung khoi xem truoc.
  const hero = {
    eyebrow: c.rows.find((r) => r.key === 'home.hero.eyebrow'),
    title: c.rows.find((r) => r.key === 'home.hero.title'),
    subtitle: c.rows.find((r) => r.key === 'home.hero.subtitle'),
    cta: c.rows.find((r) => r.key === 'home.hero.cta_label'),
    image: c.rows.find((r) => r.key === 'home.hero.image'),
  };

  /**
   * Khoi xem truoc phan mo dau trang chu.
   *
   * Dung tu gia tri DANG GO, va dung chung ham `heroAppearance` voi trang that
   * nen hai noi khong the lech nhau. Neu chung tu tinh rieng thi som muon ban
   * xem truoc se noi doi — kieu loi lam nguoi ta het tin ca trang quan tri.
   */
  const heroPreview = hero.title ? (
          <div>
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
                    {/* Ban xem truoc phai ap CA kieu chu rieng cua tung o, dung
                        cach trang that lam: len the <span> ben trong, khong len
                        the mang lop. Neu khong thi doi co chu roi mo xem truoc se
                        thay mot dang, ma trang that lai ra mot dang khac. */}
                    {hero.eyebrow && (
                      <p className="eyebrow mb-3" style={{ color: look.dimColor }}>
                        <span style={styleOf(hero.eyebrow.key)}>{val(hero.eyebrow)}</span>
                      </p>
                    )}
                    <p className="display-sm whitespace-pre-line">
                      <span style={styleOf(hero.title.key)}>{val(hero.title)}</span>
                    </p>
                    {hero.subtitle && !look.hideSubtitle && (
                      <p className="mt-4 max-w-lg text-sm leading-relaxed">
                        <span style={styleOf(hero.subtitle.key)}>{val(hero.subtitle)}</span>
                      </p>
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
          </div>
  ) : null;

  /**
   * Xem truoc rieng cho o dang go, cho nhung o khong thuoc phan mo dau.
   *
   * Phan mo dau co khoi rieng vi no can ca anh nen, lop phu va bo cuc. Cac o
   * con lai chi la chu, nen chi can dung lai dung kieu chu cua chung tren dung
   * mau nen cua trang.
   */
  const focusedRow = focusedKey ? c.rows.find((r) => r.key === focusedKey) : undefined;
  const focusedIsHero = Boolean(focusedKey && focusedKey.startsWith('home.hero.'));

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
          Tất cả ({c.rows.filter((r) => r.kind !== 'style' && !r.key.endsWith('.mobile')).length})
        </button>
        {pages.map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={activePage === p}
                  onClick={() => setActivePage(p)}>
            {PAGE_LABELS[p] ?? p} (
            {c.rows.filter((r) => r.page === p && r.kind !== 'style' && !r.key.endsWith('.mobile')).length})
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Xem truoc phan mo dau trang chu, dung gia tri DANG GO              */}
      {/* ------------------------------------------------------------------ */}

      {/* ------------------------------------------------------------------ */}
      {/* Hai cot: o nhap ben trai, khung xem truoc dinh man hinh ben phai   */}
      {/*                                                                     */}
      {/* Duoi 1024px thi ve mot cot va khung xem truoc len tren — o do khong */}
      {/* du cho cho hai cot, va mot khung dinh man hinh se an mat chinh cai  */}
      {/* o dang go.                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-10 lg:grid-cols-[1fr_30rem] lg:items-start">
      <div>
      {shown.map((page) => (
        <section key={page} className="mb-14">
          <h2 className="display-xs mb-6 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
            {PAGE_LABELS[page] ?? page}
          </h2>

          <div className="flex flex-col gap-8">
            {c.rows
              // O kieu chu khong hien thanh muc rieng: no duoc gan ngay duoi o
              // chu ma no thuoc ve. Hien ca hai se thanh mot danh sach dai gap
              // doi ma mot nua khong doc duoc ten.
              .filter(
                (r) =>
                  r.page === page &&
                  // Hai loai o nay khong hien thanh muc rieng: chung duoc gan
                  // ngay duoi o chu ma chung thuoc ve. Hien ca ba se thanh mot
                  // danh sach dai gap ba ma hai phan ba khong doc duoc ten.
                  r.kind !== 'style' &&
                  !r.key.endsWith('.mobile'),
              )
              // Sap lai theo thu tu that tren trang chu. `toSorted` chu khong
              // `sort`: `sort` sua thang mang goc, ma mang o day den tu c.rows
              // dung chung cho ca trang — sua no la sua ca khoi xem truoc.
              .toSorted((a, b) => rowRank(a.key, a.sort_order) - rowRank(b.key, b.sort_order))
              .map((r) => {
                // Quy uoc khoa: o kieu chu = khoa + ".style", o dien thoai =
                // khoa + ".mobile". Nho quy uoc nay ma khong can them cot lien
                // ket nao trong database.
                const styleRow = c.rows.find((x) => x.key === `${r.key}.style`);
                const mobileRow = c.rows.find((x) => x.key === `${r.key}.mobile`);

                // O DANG SUA: ban may tinh hay ban dien thoai.
                const onMobile = variant[r.key] === 'mobile' && Boolean(mobileRow);
                const active = onMobile && mobileRow ? mobileRow : r;

                const dirty = draft[active.key] !== undefined && draft[active.key] !== active.value;
                const busy = savingKey === active.key;

                return (
                  <div key={r.key}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                      <label className="label mb-0" htmlFor={active.key}>
                        {r.label}
                      </label>

                      {/* CHUYEN BAN MAY TINH / DIEN THOAI.
                          Chi hien khi o do THAT SU co ban dien thoai — o chon,
                          o dia chi va cac o cai dat thi khong. Hien mot cai nut
                          khong lam gi con te hon la khong co nut. */}
                      {mobileRow && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="chip"
                            aria-pressed={!onMobile}
                            onClick={() => setVariant((v) => ({ ...v, [r.key]: 'pc' }))}
                          >
                            Máy tính
                          </button>
                          <button
                            type="button"
                            className="chip"
                            aria-pressed={onMobile}
                            onClick={() => setVariant((v) => ({ ...v, [r.key]: 'mobile' }))}
                          >
                            Điện thoại
                            {mobileRow.value.trim() !== '' && ' ·'}
                          </button>
                        </div>
                      )}
                    </div>

                    {active.kind === 'image' ? (
                      <div className="flex flex-col gap-3">
                        {val(active) && (
                          <div className="frame" style={{ maxWidth: '22rem' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={val(active)} alt="" />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                          <UploadButton
                            label="Chọn ảnh từ máy"
                            busy={busy}
                            maxBytes={IMAGE_LIMITS.outfit}
                            onPick={(f) => void onPickImage(active, f)}
                          />
                          {val(active) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-quiet"
                              onClick={() => set(active.key, '')}
                            >
                              Bỏ ảnh
                            </button>
                          )}
                        </div>
                      </div>
                    ) : active.kind === 'choice' ? (
                      <select
                        id={active.key}
                        onFocus={() => setFocusedKey(active.key)}
                        className="field"
                        value={val(active)}
                        onChange={(e) => set(active.key, e.target.value)}
                      >
                        {active.options.map((o) => (
                          <option key={o} value={o}>{CHOICE_LABELS[o] ?? o}</option>
                        ))}
                      </select>
                    ) : active.kind === 'textarea' ? (
                      <textarea
                        id={active.key}
                        onFocus={() => setFocusedKey(active.key)}
                        className="field"
                        rows={3}
                        value={val(active)}
                        onChange={(e) => set(active.key, e.target.value)}
                      />
                    ) : (
                      <input
                        id={active.key}
                        onFocus={() => setFocusedKey(active.key)}
                        type="text"
                        className="field"
                        value={val(active)}
                        onChange={(e) => set(active.key, e.target.value)}
                      />
                    )}

                    {active.hint && <p className="hint">{active.hint}</p>}

                    {onMobile && (
                      <p className="hint">
                        Để trống ô này thì điện thoại dùng lại nội dung của bản máy tính.
                      </p>
                    )}

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

                    {/* Kieu chu KHONG tach hai ban. Co chu da tu co gian theo be
                        ngang man hinh, va bon vai tro chung da lo phan do — nhan
                        doi ca kieu chu se thanh mot rung nut cho mot viec he
                        thong hien tai da lam dung. */}
                    {styleRow && (
                      <FieldStyleRow
                        value={val(styleRow)}
                        sampleText={val(active)}
                        saving={savingKey === styleRow.key}
                        saved={savedKey === styleRow.key}
                        onChange={(next) => set(styleRow.key, next)}
                        onSave={() => void save(styleRow)}
                      />
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!dirty || busy}
                        onClick={() => void save(active)}
                      >
                        {busy ? 'Đang lưu…' : onMobile ? 'Lưu bản điện thoại' : 'Lưu'}
                      </button>

                      {/* AP DUNG CHO CA HAI BAN.
                          Phan lon o se giong nhau o hai ban — chi vai o thuc su
                          can khac. Khong co nut nay thi moi lan sua mot cau chu
                          la hai lan go va mot co hoi quen mot ben. */}
                      {mobileRow && (
                        <button
                          type="button"
                          className="btn btn-sm btn-quiet"
                          disabled={busy}
                          onClick={() => void saveBoth(r, mobileRow, val(active))}
                        >
                          Áp dụng cho cả hai bản
                        </button>
                      )}

                      {dirty && !busy && (
                        <button
                          type="button"
                          className="btn btn-sm btn-quiet"
                          onClick={() =>
                            setDraft((d) => {
                              const n = { ...d };
                              delete n[active.key];
                              return n;
                            })
                          }
                        >
                          Hoàn tác
                        </button>
                      )}
                      {savedKey === active.key && (
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

      {/* --- Cot phai: khung xem truoc --------------------------------- */}
      <PreviewPane
        width={previewWidth}
        onWidthChange={setPreviewWidth}
        note={
          focusedRow
            ? `Đang xem: ${focusedRow.label}. Khung đổi ngay khi bạn gõ; trang thật chỉ đổi sau khi bấm Lưu.`
            : 'Bấm vào một ô bên trái để xem trước ô đó. Khung đổi ngay khi bạn gõ; trang thật chỉ đổi sau khi bấm Lưu.'
        }
      >
        {/* Phan mo dau can ca anh nen, lop phu va bo cuc nen co khoi rieng.
            Mac dinh cung hien no, vi do la thu duoc sua nhieu nhat. */}
        {(focusedIsHero || !focusedRow) && heroPreview}

        {focusedRow && !focusedIsHero && (
          <div className="p-6" style={{ background: 'var(--bg)' }}>
            <p className="eyebrow mb-3">{focusedRow.label}</p>

            {focusedRow.kind === 'image' ? (
              val(focusedRow) ? (
                <div className="frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={val(focusedRow)} alt="" />
                </div>
              ) : (
                <p className="muted-2 text-sm">Ô này chưa có ảnh.</p>
              )
            ) : (
              <p className="whitespace-pre-line leading-relaxed">
                <span style={styleOf(focusedRow.key.replace(/\.mobile$/, ''))}>
                  {val(focusedRow) || '(ô này đang trống)'}
                </span>
              </p>
            )}
          </div>
        )}
      </PreviewPane>
      </div>
    </div>
  );
}
