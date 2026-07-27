'use client';

/**
 * Hang chinh kieu chu, dat ngay duoi o chu ma no thuoc ve.
 *
 * VI SAO PHAI DAT NGAY TAI DAY
 *   Bon vai tro chu dung chung ("Tieu de lon", "Chu thuong"...) la mot he thong
 *   dung nhung truu tuong: nhin vao o "Tieu de phan mo dau" khong co gi cho
 *   biet no thuoc vai tro nao, nen muon doi thi phai doan roi thu. Dat ngay
 *   duoi o dang sua thi khong con gi de doan.
 *
 * THU GON MAC DINH
 *   Phan lon o se khong ai doi kieu chu. Mo san nam o chon duoi moi o chu se
 *   lam trang quan tri dai gap ba va che mat viec chinh nhu cau chinh la sua
 *   NOI DUNG. Dong lai thi van thay ngay o nao da bi doi — nhan dong ghi ro.
 *
 * "THEO KIEU CHUNG" LA MOT LUA CHON THAT
 *   Moi o chon deu co muc dau tien la de trong, nghia la khong ghi de gi ca.
 *   Khong co no thi mot khi da dung vao se khong bao gio quay lai duoc trang
 *   thai ban dau — chi co the doan lai gia tri cu.
 */

import { useState } from 'react';
import {
  FONT_LABEL, SIZE_SCALE, WEIGHT, TEXT_COLOR, contrastWarning,
  encodeFieldStyle, parseFieldStyle, fieldStyleCss, type FieldStyle,
} from '@/lib/typography';

const SIZE_LABEL: Record<string, string> = {
  'rat-nho': 'Rất nhỏ', nho: 'Nhỏ', vua: 'Vừa', lon: 'Lớn', 'rat-lon': 'Rất lớn',
};

const WEIGHT_LABEL: Record<string, string> = {
  manh: 'Mảnh', thuong: 'Thường', vua: 'Vừa', dam: 'Đậm', 'rat-dam': 'Rất đậm',
};

const COLOR_LABEL: Record<string, string> = {
  den: 'Đen', xam: 'Xám', 'xam-nhat': 'Xám nhạt', nau: 'Nâu', trang: 'Trắng',
};

export function FieldStyleRow({
  value,
  sampleText,
  saving,
  saved,
  onChange,
  onSave,
}: {
  /** Chuoi ma hoa dang luu, hoac dang go. */
  value: string;
  /** Chu that cua o, de dung khung xem truoc. */
  sampleText: string;
  saving: boolean;
  saved: boolean;
  onChange: (next: string) => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const st = parseFieldStyle(value);

  const set = (patch: Partial<FieldStyle>) => {
    const next = { ...st, ...patch };
    // Xoa han khoa khi chon "theo kieu chung", thay vi luu chuoi rong: chuoi
    // rong van la mot khoa trong ban ma hoa, va no se de lai rac.
    for (const k of Object.keys(next) as Array<keyof FieldStyle>) {
      if (next[k] === '' || next[k] === false) delete next[k];
    }
    onChange(encodeFieldStyle(next));
  };

  const changed = Object.keys(st).length > 0;
  const warn = st.color ? contrastWarning(st.color) : null;

  return (
    <div className="mt-2">
      {/* NUT NAY PHAI NHIN RA NUT.
          Ban truoc no la kieu `btn-quiet` — khong vien, chu xam nhat — nen chu
          website nhin vao khong biet no bam duoc, va bao la "khong cho chon
          size, font, mau". Dung mot loi da mac o nut viet mo ta bang AI.
          Co vien, co mui ten chi ra day la thu mo duoc, va chu noi thang no
          lam gi thay vi mot cai ten chung chung. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span
            className="inline-block text-xs transition-transform"
            style={open ? { transform: 'rotate(180deg)' } : undefined}
            aria-hidden="true"
          >
            ▾
          </span>
          Đổi font, cỡ, màu, đậm nhạt
        </button>
        {!open && changed && (
          <span className="text-xs" style={{ color: 'var(--color-ok)' }}>
            Ô này đang có kiểu riêng: {describe(st)}
          </span>
        )}
        {!open && !changed && (
          <span className="muted-2 text-xs">Đang theo kiểu chung của website</span>
        )}
      </div>

      {open && (
        <div className="mt-3 border p-4" style={{ borderColor: 'var(--line)' }}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Select label="Font" value={st.font ?? ''} onChange={(v) => set({ font: v })}
                    options={Object.keys(FONT_LABEL)} labels={FONT_LABEL} />
            <Select label="Cỡ" value={st.size ?? ''} onChange={(v) => set({ size: v })}
                    options={Object.keys(SIZE_SCALE)} labels={SIZE_LABEL} />
            <Select label="Độ đậm" value={st.weight ?? ''} onChange={(v) => set({ weight: v })}
                    options={Object.keys(WEIGHT)} labels={WEIGHT_LABEL} />
            <Select label="Màu" value={st.color ?? ''} onChange={(v) => set({ color: v })}
                    options={Object.keys(TEXT_COLOR).filter((k) => k !== 'theo-giao-dien')}
                    labels={COLOR_LABEL} />
            <div>
              <label className="label">Nghiêng</label>
              <select
                className="field"
                value={st.italic ? '1' : ''}
                onChange={(e) => set({ italic: e.target.value === '1' })}
              >
                <option value="">Thẳng (theo kiểu chung)</option>
                <option value="1">Nghiêng</option>
              </select>
            </div>
            <div>
              <label className="label">Chữ hoa</label>
              <select
                className="field"
                value={st.case ?? ''}
                onChange={(e) => set({ case: e.target.value })}
              >
                <option value="">Theo kiểu chung</option>
                <option value="nhu-go">Như bạn gõ</option>
                <option value="in-hoa">IN HOA TOÀN BỘ</option>
              </select>
            </div>
          </div>

          {warn && <p className="hint-error mt-3">{warn}</p>}

          {/* Xem truoc NGAY TAI CHO. Truoc day chi phan mo dau trang chu moi co
              ban xem truoc; cac o khac phai luu roi mo trang that de xem. */}
          <div className="mt-4">
            <p className="eyebrow mb-2">Xem trước</p>
            <div
              className="border p-4"
              style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
            >
              <span style={fieldStyleCss(st)}>{sampleText || '(ô này đang trống)'}</span>
            </div>
            <p className="hint">
              Khung xem trước dùng nền sáng. Chữ nằm trên ảnh thì màu nền là bức ảnh,
              nên trông sẽ khác.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-sm" disabled={saving} onClick={onSave}>
              {saving ? 'Đang lưu…' : 'Lưu kiểu chữ'}
            </button>
            {changed && (
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                disabled={saving}
                onClick={() => onChange('')}
              >
                Trả về kiểu chung
              </button>
            )}
            {saved && (
              <span className="text-xs" style={{ color: 'var(--color-ok)' }}>Đã lưu</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Mo ta ngan cum ghi de, de doc khi hang dang thu gon. */
function describe(s: FieldStyle): string {
  const parts: string[] = [];
  if (s.font) parts.push(FONT_LABEL[s.font]?.split(' —')[0] ?? s.font);
  if (s.size) parts.push(SIZE_LABEL[s.size] ?? s.size);
  if (s.weight) parts.push(WEIGHT_LABEL[s.weight] ?? s.weight);
  if (s.color) parts.push(COLOR_LABEL[s.color] ?? s.color);
  if (s.italic) parts.push('nghiêng');
  if (s.case === 'in-hoa') parts.push('IN HOA');
  if (s.case === 'nhu-go') parts.push('như gõ');
  return parts.join(' · ');
}

function Select({
  label, value, onChange, options, labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels: Record<string, string>;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Theo kiểu chung</option>
        {options.map((o) => (
          <option key={o} value={o}>{labels[o] ?? o}</option>
        ))}
      </select>
    </div>
  );
}
