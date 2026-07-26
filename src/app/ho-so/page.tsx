'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SetupNotice, Spinner } from '@/components/site';
import { useAuth, useTaxonomy, useUserContext } from '@/lib/hooks';
import { analyzeBirthDate, explainMenh, NGU_HANH_LABEL } from '@/lib/nguhanh';
import { formatVnd } from '@/lib/format';

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
      email={session.user.email ?? null}
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
  email: string | null;
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
  email,
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
  const [priceMin, setPriceMin] = useState(initialPriceMin);
  const [priceMax, setPriceMax] = useState(initialPriceMax);
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

    setMsg('Đã lưu.');
    onSaved();
  };

  /** Xoa du lieu ca nhan. Di qua ham SQL de xoa dung va day du trong 1 giao dich. */
  const eraseData = async () => {
    const sb = getSupabase();
    if (!sb) return;
    if (!window.confirm(
      'Xoá toàn bộ dữ liệu cá nhân: ngày sinh, niên mệnh, gu đã chọn và lịch sử phản hồi.\n\n' +
      'Các bài bạn đã đăng vẫn được giữ nhưng chuyển sang khuyết danh.\n\nTiếp tục?'
    )) return;

    setSaving(true);
    const { error } = await sb.rpc('erase_my_personal_data');
    setSaving(false);

    if (error) { setErr(error.message); return; }
    setMsg('Đã xoá dữ liệu cá nhân.');
    setBirthDate('');
    setStyles([]);
    setColors([]);
    onSaved();
  };

  /** Xuat du lieu ca nhan ra file JSON, khong can cho admin xu ly. */
  const exportData = async () => {
    const sb = getSupabase();
    if (!sb) return;

    const uid = userId;
    const [pr, pf, pv, fb, ou] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      sb.from('user_preferences').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('user_private').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('feedback_events').select('*').eq('user_id', uid),
      sb.from('outfits').select('*').eq('author_id', uid),
    ]);

    const blob = new Blob(
      [JSON.stringify({
        xuat_luc: new Date().toISOString(),
        email,
        ho_so: pr.data,
        so_thich: pf.data,
        du_lieu_rieng: pv.data,
        phan_hoi: fb.data,
        bai_dang: ou.data,
      }, null, 2)],
      { type: 'application/json' },
    );

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phoi-du-lieu-ca-nhan-${uid.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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

      {/* ------------------------------------------------------------------ */}
      <Section title="Khoảng giá cả set" note="Tổng tạm tính của tất cả các món trong một set.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="pmin">Từ</label>
            <input
              id="pmin"
              type="number"
              min={0}
              step={50_000}
              value={priceMin}
              onChange={(e) => setPriceMin(Number(e.target.value))}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="pmax">Đến</label>
            <input
              id="pmax"
              type="number"
              min={0}
              step={50_000}
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              className="field"
            />
          </div>
        </div>
        <p className="hint">
          Hiện tại: {formatVnd(Math.min(priceMin, priceMax))} – {formatVnd(Math.max(priceMin, priceMax))}
        </p>
      </Section>

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

      {msg && <div className="notice notice-ok mb-6">{msg}</div>}
      {err && <div className="notice notice-danger mb-6">{err}</div>}

      <button type="button" onClick={save} disabled={saving} className="btn btn-solid w-full">
        {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Quyen doi voi du lieu ca nhan (Nghi dinh 13/2023)                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-20 border-t pt-10" style={{ borderColor: 'var(--line)' }}>
        <p className="eyebrow mb-4">Dữ liệu cá nhân của bạn</p>
        <p className="muted mb-6 text-sm">
          Bạn có quyền xem, tải về và xoá dữ liệu cá nhân của mình bất cứ lúc nào,
          không cần chờ quản trị viên xử lý.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={exportData} className="btn btn-sm">
            Tải dữ liệu của tôi (JSON)
          </button>
          <button type="button" onClick={eraseData} disabled={saving} className="btn btn-sm btn-danger">
            Xoá dữ liệu cá nhân
          </button>
        </div>
        <p className="muted-2 mt-4 text-xs leading-relaxed">
          Xoá dữ liệu cá nhân sẽ xoá ngày sinh, niên mệnh, gu đã chọn và toàn bộ
          lịch sử phản hồi. Các bài bạn đã đăng công khai vẫn được giữ lại nhưng
          chuyển sang khuyết danh, để không làm vỡ những set đồ người khác đang xem.
        </p>
      </div>
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
