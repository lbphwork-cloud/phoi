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
import { useContent, type ContentRow } from '@/lib/content';
import { uploadImage } from '@/lib/storage';
import { Spinner, EmptyState } from '@/components/site';

/** Ten nhom hien cho nguoi dung. Khoa la cot `page` trong database. */
const PAGE_LABELS: Record<string, string> = {
  'chung': 'Dùng chung — tên trang, chân trang',
  'trang-chu': 'Trang chủ',
  'kham-pha': 'Trang khám phá',
  'ho-so': 'Trang hồ sơ',
  'dang-nhap': 'Trang đăng nhập',
  'tao-bai': 'Trang tạo bài',
  'du-lieu': 'Trang dữ liệu cá nhân',
};

export default function ContentAdminPage() {
  const { session } = useAuth();
  const c = useContent();

  // Gia tri dang go, chua luu. Chi chua nhung o nguoi dung da dong vao.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const pages = [...new Set(c.rows.map((r) => r.page))];

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
      </div>

      {err && <div className="notice notice-danger mb-8">{err}</div>}

      {/* ------------------------------------------------------------------ */}
      {/* Xem truoc phan mo dau trang chu, dung gia tri DANG GO              */}
      {/* ------------------------------------------------------------------ */}
      {hero.title && (
        <div className="mb-12">
          <p className="eyebrow mb-4">Xem trước phần mở đầu trang chủ</p>
          <div
            className="hero-media flex items-end"
            style={{ minHeight: '24rem' }}
          >
            {hero.image && val(hero.image) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={val(hero.image)} alt="" aria-hidden="true" />
            )}
            <div className="hero-body w-full p-8">
              {hero.eyebrow && (
                <p className="eyebrow mb-3" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {val(hero.eyebrow)}
                </p>
              )}
              <p className="display-sm mb-4 whitespace-pre-line">{val(hero.title)}</p>
              {hero.subtitle && (
                <p className="max-w-lg text-sm leading-relaxed">{val(hero.subtitle)}</p>
              )}
              {hero.cta && (
                <span className="btn btn-onmedia btn-sm mt-6">{val(hero.cta)}</span>
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
      {pages.map((page) => (
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
                          <input
                            id={r.key}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="text-sm"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void onPickImage(r, f);
                            }}
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
