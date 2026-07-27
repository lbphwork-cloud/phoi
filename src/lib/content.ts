'use client';

/**
 * Noi dung sua duoc tu trang quan tri.
 *
 * NGUYEN TAC QUAN TRONG NHAT: LUON CO GIA TRI DU PHONG
 *   `t(key, fallback)` khong bao gio tra ve chuoi rong khi chua tai xong hoac
 *   khi database khong goi duoc — no tra ve `fallback` viet san trong ma nguon.
 *
 *   Ly do: neu khong lam vay, moi lan mang cham hoac database ngu la trang chu
 *   hien ra mot khung trang khong chu. Mot he thong noi dung khong duoc phep
 *   lam website hong khi chinh no hong.
 *
 *   He qua thuc te: ma nguon van chua nguyen van ban goc. Do la co y — no vua
 *   la ban du phong, vua la tai lieu cho biet o do dang le hien cai gi.
 *
 * TAI MOT LAN CHO CA TRANG
 *   Bang nay nho (khoang 50 dong) nen tai het mot lan roi tra theo khoa trong
 *   bo nho. Tai rieng tung khoa se thanh vai chuc luot goi mang cho mot trang.
 */

import { useMemo } from 'react';
import { useAsyncData } from './hooks';

export interface ContentRow {
  key: string;
  page: string;
  label: string;
  hint: string;
  kind: 'text' | 'textarea' | 'image' | 'url' | 'list' | 'choice';
  value: string;
  /** Cac gia tri hop le khi kind = 'choice'. Rong voi cac kieu khac. */
  options: string[];
  sort_order: number;
}

/**
 * Bang tra tu lua chon sang lop CSS / gia tri that.
 *
 * Dat o day thay vi trong component: ca trang chu lan trang xem truoc trong
 * quan tri deu dung, va hai noi do phai ra KET QUA GIONG HET NHAU — neu khong
 * thi ban xem truoc noi doi.
 */
export const HERO_TEXT_COLOR: Record<string, string> = {
  trang: '#ffffff',
  den: '#14120f',
};

export const HERO_OVERLAY: Record<string, string> = {
  khong: 'none',
  nhe: 'linear-gradient(to top, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0) 85%)',
  vua: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.34) 42%, rgba(0,0,0,0.06) 78%)',
  dam: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.58) 45%, rgba(0,0,0,0.28) 85%)',
};

export const HERO_BOX: Record<string, string> = {
  khong: '',
  toi: 'rgba(12,11,9,0.72)',
  sang: 'rgba(250,249,246,0.88)',
  mo: 'rgba(12,11,9,0.34)',
};

export const HERO_ALIGN: Record<string, string> = {
  'duoi-trai': 'items-end justify-start text-left',
  'giua': 'items-center justify-center text-center',
  'duoi-giua': 'items-end justify-center text-center',
};

export interface Content {
  /** Lay noi dung theo khoa. `fallback` la bat buoc — xem chu thich dau file. */
  t: (key: string, fallback: string) => string;
  /** Nhu `t` nhung cat theo dau phay, dung cho `kind = 'list'`. */
  list: (key: string, fallback: string) => string[];
  rows: ContentRow[];
  loading: boolean;
  reload: () => void;
}

export function useContent(): Content {
  const { data, loading, reload } = useAsyncData<ContentRow[]>('site-content', (sb) =>
    sb
      .from('site_content')
      .select('key, page, label, hint, kind, value, options, sort_order')
      .order('page')
      .order('sort_order'),
  );

  const rows = useMemo(() => data ?? [], [data]);

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.key, r.value);
    return m;
  }, [rows]);

  return useMemo(() => {
    // Chuoi rong trong database cung tinh la "chua dat" -> dung ban du phong.
    // Nguoi dung xoa het chu trong o nhap thuong la muon quay ve mac dinh,
    // khong phai muon mot khoang trong.
    const t = (key: string, fallback: string) => {
      const v = map.get(key);
      return v === undefined || v.trim() === '' ? fallback : v;
    };

    const list = (key: string, fallback: string) =>
      t(key, fallback)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return { t, list, rows, loading, reload };
  }, [map, rows, loading, reload]);
}

/**
 * Tinh dien mao phan mo dau tu cac lua chon cua quan tri vien.
 *
 * DUNG CHUNG cho trang chu VA cho ban xem truoc trong /admin/noi-dung. Neu hai
 * noi tu tinh rieng thi som muon cung lech nhau, va luc do ban xem truoc noi
 * doi — do la kieu loi lam nguoi dung mat long tin vao ca trang quan tri.
 */
export function heroAppearance(t: (k: string, f: string) => string) {
  const colorKey = t('home.hero.text_color', 'trang');
  const fg = HERO_TEXT_COLOR[colorKey] ?? HERO_TEXT_COLOR.trang;
  const light = colorKey === 'trang';

  const boxKey = t('home.hero.box', 'khong');
  const boxBg = HERO_BOX[boxKey] ?? '';

  const buttonKey = t('home.hero.button_style', 'sang');

  return {
    /** Mau chu chinh. Ap cho ca tieu de va doan mo ta. */
    textStyle: {
      color: fg,
      // Bong do chi co nghia khi chu sang nam tren anh. Chu toi tren nen sang
      // ma them bong do thi nhin ban.
      textShadow: light ? '0 1px 24px rgba(0,0,0,0.45)' : 'none',
    } as React.CSSProperties,

    /** Mau cho chu phu: nhat hon chu chinh nhung van cung tong. */
    dimColor: light ? 'rgba(255,255,255,0.76)' : 'rgba(20,18,15,0.68)',

    overlay: HERO_OVERLAY[t('home.hero.overlay', 'vua')] ?? HERO_OVERLAY.vua,

    boxStyle: boxBg
      ? ({ background: boxBg, backdropFilter: 'blur(2px)' } as React.CSSProperties)
      : undefined,

    alignClass: HERO_ALIGN[t('home.hero.align', 'duoi-trai')] ?? HERO_ALIGN['duoi-trai'],

    buttonClass:
      buttonKey === 'toi' ? 'btn-solid'
      : buttonKey === 'vien' ? 'btn-ghost-onmedia'
      : 'btn-onmedia',
  };
}
