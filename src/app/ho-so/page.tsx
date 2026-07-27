'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SetupNotice, Spinner } from '@/components/site';
import { useAuth, useTaxonomy, useUserContext } from '@/lib/hooks';
import { analyzeBirthDate, explainMenh, NGU_HANH_LABEL } from '@/lib/nguhanh';


export default function ProfilePage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Profile />;
}

/**
 * Lop ngoai: chi lo tai du lieu va cac trang thai cho / chua dang nhap.
 *
 * VI SAO TACH LAM HAI COMPONENT
 *   Truoc day mot component lam ca hai viec, va phai dung ba useEffect de bom
 *   gia tri da luu vao cac o nhap khi du lieu ve. Cach do co hai nhuoc diem
 *   that: setState dong bo trong effect (React 19 canh bao dung), va neu nguoi
 *   dung dang go ma du lieu ve muon thi chu dang go bi ghi de.
 *
 *   Tach ra thi ProfileForm chi duoc dung sau khi du lieu da co, nen no nhan
 *   gia tri ban dau ngay tu lan mount dau tien — khong can effect nao ca.
 *   Thuoc tinh `key` bang user id de doi tai khoan thi form duoc dung lai tu
 *   dau, khong con sot gia tri cua nguoi truoc.
 */
function Profile() {
  const { session, profile, loading: authLoading } = useAuth();
  const { prefs, privateData, loading, reload } = useUserContext();

  if (authLoading || loading) return <Spinner label="Đang tải hồ sơ" />;

  if (!session) {
    return (
      <div className="shell-narrow py-20 text-center">
        <h1 className="display-sm mb-6">Cần đăng nhập</h1>
        <Link href="/dang-nhap" className="btn btn-solid">Đăng nhập</Link>
      </div>
    );
  }

  return (
    <ProfileForm
      key={session.user.id}
      userId={session.user.id}
      initialName={profile?.display_name ?? ''}
      initialStyles={prefs?.style_slugs ?? []}
      initialColors={prefs?.color_slugs ?? []}
      initialPriceMin={prefs?.price_min_vnd ?? 150_000}
      initialPriceMax={prefs?.price_max_vnd ?? 700_000}
      initialBirthDate={privateData?.birth_date ?? ''}
      initialMenhEnabled={privateData?.element_enabled ?? true}
      onSaved={reload}
    />
  );
}

interface ProfileFormProps {
  userId: string;
  initialName: string;
  initialStyles: string[];
  initialColors: string[];
  initialPriceMin: number;
  initialPriceMax: number;
  initialBirthDate: string;
  initialMenhEnabled: boolean;
  onSaved: () => void;
}

function ProfileForm({
  userId,
  initialName,
  initialStyles,
  initialColors,
  initialPriceMin,
  initialPriceMax,
  initialBirthDate,
  initialMenhEnabled,
  onSaved,
}: ProfileFormProps) {
  const tax = useTaxonomy();

  const [name, setName] = useState(initialName);
  const [styles, setStyles] = useState<string[]>(initialStyles);
  const [colors, setColors] = useState<string[]>(initialColors);
  // Khoi chon khoang gia da bo khoi trang nay, nhung gia tri cu VAN duoc gui
  // khi luu — nguoi da dat truoc do khong bi mat thiet lap.
  const [priceMin] = useState(initialPriceMin);
  const [priceMax] = useState(initialPriceMax);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [menhEnabled, setMenhEnabled] = useState(initialMenhEnabled);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // Tinh menh NGAY TAI TRINH DUYET khi nguoi dung go ngay sinh — khong goi
  // may chu, khong goi AI. Nho vay ho thay ket qua truoc khi bam luu.
  const preview = birthDate ? analyzeBirthDate(birthDate) : null;

  const save = async () => {
    const sb = getSupabase();
    if (!sb) { setErr('Chưa cấu hình Supabase.'); return; }

    setSaving(true);
    setMsg(null);
    setErr(null);

    const uid = userId;

    // Chi gui cot duoc phep sua. Cot role da bi thu hoi quyen UPDATE o
    // migration 0002 nen co gui cung bi tu choi.
    const p1 = sb.from('profiles').update({ display_name: name.trim() || 'Thành viên' }).eq('id', uid);

    const p2 = sb.from('user_preferences').upsert({
      user_id: uid,
      style_slugs: styles,
      color_slugs: colors,
      price_min_vnd: Math.min(priceMin, priceMax),
      price_max_vnd: Math.max(priceMin, priceMax),
      onboarded_at: new Date().toISOString(),
    });

    // Ngay sinh va nien menh vao bang RIENG (user_private), khong phai bang
    // profiles cong khai. Ca admin cung khong doc duoc bang nay.
    const menh = birthDate ? analyzeBirthDate(birthDate) : null;
    const p3 = sb.from('user_private').upsert({
      user_id: uid,
      birth_date: birthDate || null,
      lunar_year: menh?.lunar.year ?? null,
      can_chi: menh?.canChi ?? null,
      element: menh?.element ?? null,
      element_label: menh?.elementLabel ?? null,
      element_enabled: menhEnabled,
    });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    setSaving(false);

    const firstError = r1.error ?? r2.error ?? r3.error;
    if (firstError) { setErr(firstError.message); return; }

    if (birthDate && !menh) {
      setErr('Đã lưu gu, nhưng ngày sinh không hợp lệ nên chưa tính được mệnh.');
      onSaved();
      return;
    }

    setMsg('Đã lưu thay đổi.');
    onSaved();
  };

  // eraseData / exportData da chuyen sang src/app/du-lieu-cua-toi/page.tsx

  // eraseData va exportData da chuyen sang src/app/du-lieu-cua-toi/page.tsx

  return (
    <div className="shell-narrow py-12 md:py-16">
      <p className="eyebrow mb-4">Hồ sơ</p>
      <h1 className="display-sm mb-10">Gu của bạn</h1>

      {/* ------------------------------------------------------------------ */}
      <Section title="Tên hiển thị">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
          maxLength={60}
          placeholder="Tên bạn muốn hiện trên bài đăng"
        />
        <p className="hint">Email của bạn không bao giờ hiển thị công khai.</p>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Phong cách bạn thích"
        note="Chọn bao nhiêu cũng được. Đây là yếu tố ảnh hưởng mạnh nhất tới thứ tự gợi ý."
      >
        <div className="flex flex-wrap gap-2">
          {tax.styles.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="chip"
              aria-pressed={styles.includes(s.slug)}
              onClick={() => toggle(styles, s.slug, setStyles)}
              title={s.description ?? undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Màu bạn thích">
        <div className="flex flex-wrap gap-2">
          {tax.colors.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="chip"
              aria-pressed={colors.includes(c.slug)}
              onClick={() => toggle(colors, c.slug, setColors)}
            >
              <span className="swatch" style={{ background: c.hex }} />
              {c.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Khoi "Khoang gia" da bo khoi trang nay theo yeu cau: nguoi dung loc gia
          ngay tren /kham-pha tien hon nhieu. Gia tri cu VAN duoc giu va van gui
          khi luu, nen ai da dat roi thi khong bi mat. */}

      {/* ------------------------------------------------------------------ */}
      {/* Ngu hanh                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Section
        title="Ngày sinh và niên mệnh"
        note="Tuỳ chọn. Chỉ dùng để gợi ý màu, không bao giờ hiển thị công khai."
      >
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="field"
          max="2020-12-31"
          min="1900-01-01"
        />
        <p className="hint">
          Cần đủ ngày tháng năm, không chỉ năm. Người sinh tháng 1 hoặc tháng 2
          dương lịch thường vẫn thuộc năm âm lịch trước đó, nên chỉ lấy năm sinh
          sẽ tính sai mệnh.
        </p>

        {birthDate && !preview && (
          <div className="notice notice-danger mt-4">
            Ngày sinh không hợp lệ, hoặc nằm ngoài khoảng 1900–2199.
          </div>
        )}

        {preview && (
          <div className="notice mt-4">
            <p className="eyebrow mb-2">Kết quả</p>
            <p className="text-sm">{explainMenh(preview)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tax.colors
                .filter((c) => c.element === preview.colors.tuongSinh || c.element === preview.colors.banMenh)
                .map((c) => (
                  <span key={c.slug} className="chip" style={{ cursor: 'default' }}>
                    <span className="swatch" style={{ background: c.hex }} />
                    {c.label}
                  </span>
                ))}
            </div>
            <p className="muted-2 mt-3 text-xs">
              Các màu nên hạn chế (hành {NGU_HANH_LABEL[preview.colors.hanChe]}):{' '}
              {tax.colors.filter((c) => c.element === preview.colors.hanChe).map((c) => c.label).join(', ')}
            </p>
          </div>
        )}

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={menhEnabled}
            onChange={(e) => setMenhEnabled(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            Bật gợi ý theo mệnh
            <span className="muted-2 block text-xs">
              Khi bật, màu hợp mệnh được cộng thêm điểm nhỏ khi xếp thứ tự. Sở thích
              bạn chọn ở trên vẫn luôn quan trọng hơn mệnh. Tắt đi thì mệnh không
              ảnh hưởng gì cả.
            </span>
          </span>
        </label>
      </Section>

      {err && <div className="notice notice-danger mb-6">{err}</div>}

      {/* Man hinh xac nhan sau khi luu.
          Chi hien mot dong chu nho thi rat de bo lo, nhat la khi nut Luu nam
          cuoi mot trang dai — nguoi dung bam xong khong biet da an chua. Khoi
          nay chiem cho han va co duong di tiep ro rang. */}
      {msg ? (
        <div className="notice notice-ok">
          <p className="display-xs mb-2">{msg}</p>
          <p className="muted mb-5 text-sm">
            Gu mới đã được áp dụng. Thứ tự gợi ý sẽ đổi theo ngay từ lần xem tiếp theo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/kham-pha" className="btn btn-sm btn-solid">
              Xem outfit theo gu mới
            </Link>
            <Link href="/" className="btn btn-sm">
              Về trang chủ
            </Link>
            <button type="button" onClick={() => setMsg(null)} className="btn btn-sm btn-quiet">
              Chỉnh tiếp
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={save} disabled={saving} className="btn btn-solid w-full">
          {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      )}

      {/* Khoi quyen du lieu ca nhan da chuyen sang trang rieng /du-lieu-cua-toi.
          Bo khoi trang nay theo yeu cau — nhin nang ne va lam loang muc dich
          chinh cua trang la chon gu. KHONG bo han: Nghi dinh 13/2023 yeu cau
          nguoi dung phai co duong tu xem va tu xoa du lieu ca nhan. */}
      <p className="muted-2 mt-16 border-t pt-8 text-xs" style={{ borderColor: 'var(--line)' }}>
        Muốn tải về hoặc xoá dữ liệu cá nhân?{' '}
        <Link href="/du-lieu-cua-toi" className="underline">
          Dữ liệu của tôi
        </Link>
      </p>
    </div>
  );
}

function Section({
  title, note, children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 border-b pb-10" style={{ borderColor: 'var(--line)' }}>
      <h2 className="display-xs mb-1">{title}</h2>
      {note && <p className="muted-2 mb-4 text-sm">{note}</p>}
      <div className={note ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}
