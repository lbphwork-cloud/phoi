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
  kind: 'text' | 'textarea' | 'image' | 'url' | 'list';
  value: string;
  sort_order: number;
}

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
      .select('key, page, label, hint, kind, value, sort_order')
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
