'use client';

/**
 * Chon mau — gom theo NHOM, khong bay het ra mot hang.
 *
 * VI SAO PHAI GOM
 *   Bang mau co 29 mau. Bay ca 29 cai chip ra cung luc thi hang mau dai hon ca
 *   phan noi dung con lai cua khoi, va mat khong doc — no luot. Chu website noi
 *   dung hai dieu cung luc: "thieu rat nhieu mau" va "giao dien kho xai". Hai
 *   dieu do nghe nguoc nhau nhung cung mot goc: them mau vao mot danh sach
 *   phang thi cang them cang kho dung.
 *
 *   Gom lai thi 11 mau chinh hien san — vua mot hang, doc duoc bang mot cai
 *   liec. Ai can chinh xac hon thi bam vao mot mau de xo ra cac sac do cua no.
 *
 * BAM VAO MAU CHINH LA CHON MAU CHINH, khong phai "mo nhom ra".
 *   Phan lon nguoi dung chi can "xanh la", khong can biet la reu hay olive hay
 *   mint. Bat ho bam hai lan cho truong hop thuong gap nhat la sai. Nut mui ten
 *   nho ben canh moi la nut mo nhom — mot cho bam rieng cho mot y dinh rieng.
 *
 * DUNG CHUNG cho ca chon MOT mau (mau cua mon do) lan chon NHIEU mau (mau chu
 * dao cua set, cac mau con ban tren san). Ba cho do truoc day co ba giao dien
 * khac nhau — mot cai select, hai cai hang chip — cho cung mot viec.
 */

import { useState } from 'react';
import type { Color } from '@/lib/supabase/types';

/** Gom bang mau phang thanh cay: mau chinh, moi mau chinh kem cac sac do. */
export function nhomMau(colors: Color[]): Array<{ chinh: Color; sacDo: Color[] }> {
  const chinh = colors.filter((c) => !c.parent_slug);
  return chinh.map((c) => ({
    chinh: c,
    sacDo: colors.filter((x) => x.parent_slug === c.slug),
  }));
}

function ChipMau({
  color,
  chon,
  onBam,
  nho = false,
}: {
  color: Color;
  chon: boolean;
  onBam: () => void;
  nho?: boolean;
}) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={chon}
      onClick={onBam}
      title={color.label}
      style={nho ? { fontSize: '0.8125rem', padding: '0.3rem 0.6rem' } : undefined}
    >
      <span className="swatch" style={{ background: color.hex }} />
      {color.label}
    </button>
  );
}

export function ColorPicker({
  colors,
  selected,
  onChange,
  multiple = false,
  max,
}: {
  colors: Color[];
  /** Cac slug dang chon. Che do mot mau thi mang co 0 hoac 1 phan tu. */
  selected: string[];
  onChange: (slugs: string[]) => void;
  multiple?: boolean;
  /** Toi da bao nhieu mau khi chon nhieu. Khong dat = khong gioi han. */
  max?: number;
}) {
  /** Cac nhom dang mo de xem sac do. */
  /** Nhom dang mo. Mot nhom tai mot thoi diem — xem chu thich duoi. */
  const [moRong, setMoRong] = useState<string | null>(null);
  const nhom = nhomMau(colors);

  const bam = (slug: string) => {
    if (!multiple) {
      // Bam lai chinh mau dang chon = bo chon. Khong co no thi khong co cach
      // nao quay ve "khong ro" ma khong phai tai lai trang.
      onChange(selected.includes(slug) ? [] : [slug]);
      return;
    }
    if (selected.includes(slug)) {
      onChange(selected.filter((x) => x !== slug));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, slug]);
    }
  };

  return (
    <div>
      {/*
        HANG NGANG, cuon duoc khi hep.

        Ban truoc xep MOI MAU MOT DONG de con cho xo sac do — 18 dong chip la
        mot cot dai ngoang, va mat phai doc tung dong thay vi liec mot cai.

        Gio: tat ca mau chinh nam tren MOT hang ngang tu xuong dong; bam mot
        mau thi sac do cua no xo XUONG DUOI, ngay ben duoi hang. Mot khoi mo
        tai mot thoi diem — mo hai nhom cung luc thi lai thanh cai cot dai cu.
      */}
      <div className="flex flex-wrap gap-1.5">
        {nhom.map(({ chinh, sacDo }) => {
          const dangMo = moRong === chinh.slug;
          const conChon = sacDo.filter((c) => selected.includes(c.slug));

          return (
            <span key={chinh.slug} className="inline-flex items-center">
              <ChipMau color={chinh} chon={selected.includes(chinh.slug)}
                       onBam={() => bam(chinh.slug)} />

              {sacDo.length > 0 && (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  aria-expanded={dangMo}
                  onClick={() => setMoRong(dangMo ? null : chinh.slug)}
                  title={`${sacDo.length} sắc độ khác của ${chinh.label.toLowerCase()}`}
                  style={{
                    padding: '0.25rem 0.45rem',
                    marginLeft: '-0.25rem',
                    // Cham xanh nho khi ben trong dang co mau duoc chon: khong
                    // co no thi nguoi dung nhin hang ngoai va tuong minh chua
                    // chon gi, trong khi mot sac do dang duoc chon o ben trong.
                    color: conChon.length ? 'var(--fg)' : undefined,
                    fontWeight: conChon.length ? 700 : undefined,
                  }}
                >
                  {dangMo ? '▴' : '▾'}{conChon.length ? ` ${conChon.length}` : ''}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* Khoi sac do — xo XUONG DUOI hang ngang, khong chen vao giua no. */}
      {moRong && (() => {
        const g = nhom.find((x) => x.chinh.slug === moRong);
        if (!g || g.sacDo.length === 0) return null;
        return (
          <div
            className="mt-2 border-l-2 pl-3"
            style={{ borderColor: 'var(--fg)' }}
          >
            <p className="muted-2 mb-1 text-xs">
              Sắc độ khác của {g.chinh.label.toLowerCase()}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.sacDo.map((c) => (
                <ChipMau key={c.slug} color={c} nho
                         chon={selected.includes(c.slug)} onBam={() => bam(c.slug)} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Sac do dang duoc chon nhung nhom cua no dang dong — van phai thay. */}
      {(() => {
        const anChon = colors.filter(
          (c) => c.parent_slug && selected.includes(c.slug) && c.parent_slug !== moRong,
        );
        if (anChon.length === 0) return null;
        return (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="muted-2 text-xs">Đang chọn:</span>
            {anChon.map((c) => (
              <ChipMau key={c.slug} color={c} nho chon onBam={() => bam(c.slug)} />
            ))}
          </div>
        );
      })()}

      {multiple && max && selected.length >= max && (
        <p className="hint">Đã chọn tối đa {max} màu. Bỏ bớt một màu để chọn màu khác.</p>
      )}
    </div>
  );
}
