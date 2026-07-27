'use client';

/**
 * Gio hang: set do da luu de mua sau.
 *
 * KHONG PHAI GIO HANG THAT
 *   PHOI khong ban hang va khong giu tien cua ai. Shopee va TikTok cung khong
 *   cho them hang vao gio cua ho tu mot website ben ngoai — khong co API nao
 *   lam duoc viec do, va neu co thi no cung se doi quyen truy cap tai khoan
 *   nguoi dung, thu website nay co y khong dong den.
 *
 *   Nen day la mot cho danh dau: luu set minh thich, roi mo ra bam lan luot.
 *
 * TAI MOT LAN CHO CA TRANG
 *   Chi tai danh sach MA set do (toi 20 dong), khong tai ca noi dung. The
 *   outfit chi can biet "set nay da luu chua" — mot phep kiem tra trong bo nho.
 */

import { useCallback, useMemo, useState } from 'react';
import { getSupabase } from './supabase/client';
import { useAsyncData, useAuth } from './hooks';

export const SAVED_LIMIT = 20;

export interface SavedRow {
  id: string;
  outfit_id: string;
  created_at: string;
}

export interface SavedState {
  ids: Set<string>;
  rows: SavedRow[];
  loading: boolean;
  full: boolean;
  /** Set do cu nhat trong gio — de goi y bo cai nao khi da day. */
  oldest: SavedRow | null;
  toggle: (outfitId: string) => Promise<{ ok: boolean; message: string }>;
  remove: (outfitId: string) => Promise<{ ok: boolean; message: string }>;
  reload: () => void;
}

export function useSaved(): SavedState {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data, loading, reload } = useAsyncData<SavedRow[]>(
    `saved-${session?.user.id ?? 'khach'}`,
    (sb) =>
      sb
        .from('saved_outfits')
        .select('id, outfit_id, created_at')
        .order('created_at', { ascending: false })
        .then(({ data: r, error }) => ({ data: (r as SavedRow[] | null) ?? [], error })),
    // Khach chua dang nhap khong co gio, nen khong goi mang lam gi.
    Boolean(session),
  );

  const rows = useMemo(() => data ?? [], [data]);
  // Boc trong useMemo: mot Set moi moi lan render se lam `toggle` doi danh tinh
  // moi lan render, va moi nut luu tren trang se render lai theo.
  const ids = useMemo(() => new Set(rows.map((r) => r.outfit_id)), [rows]);

  const remove = useCallback(
    async (outfitId: string) => {
      const sb = getSupabase();
      if (!sb) return { ok: false, message: 'Chưa cấu hình Supabase.' };

      const { error } = await sb.from('saved_outfits').delete().eq('outfit_id', outfitId);
      if (error) return { ok: false, message: `Không bỏ được khỏi giỏ: ${error.message}` };

      reload();
      return { ok: true, message: 'Đã bỏ khỏi giỏ.' };
    },
    [reload],
  );

  const toggle = useCallback(
    async (outfitId: string) => {
      const sb = getSupabase();
      if (!sb) return { ok: false, message: 'Chưa cấu hình Supabase.' };
      if (!session) {
        return { ok: false, message: 'Cần đăng nhập để lưu set đồ vào giỏ.' };
      }
      if (busy) return { ok: false, message: 'Đang xử lý…' };

      setBusy(true);

      if (ids.has(outfitId)) {
        setBusy(false);
        return remove(outfitId);
      }

      const { error } = await sb
        .from('saved_outfits')
        .insert({ user_id: session.user.id, outfit_id: outfitId });

      setBusy(false);

      if (error) {
        // Thong bao cua trigger gioi han 20 da viet san bang tieng Viet, nen
        // dua thang ra chu khong boc them mot lop "Loi:" vo nghia.
        return { ok: false, message: error.message };
      }

      reload();
      return { ok: true, message: 'Đã lưu vào giỏ.' };
    },
    [session, ids, busy, remove, reload],
  );

  return {
    ids,
    rows,
    loading,
    full: rows.length >= SAVED_LIMIT,
    oldest: rows.length ? rows[rows.length - 1] : null,
    toggle,
    remove,
    reload,
  };
}
