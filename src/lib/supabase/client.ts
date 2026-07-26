/**
 * Client Supabase dung o trinh duyet.
 *
 * BAO MAT — vi sao dat anon key vao frontend la an toan:
 * anon key khong phai secret. No chi noi "toi la khach cua project nay" va moi
 * quyen thuc su do Row Level Security quyet dinh. Ke tan cong co anon key van
 * khong doc duoc du lieu ma RLS khong cho phep.
 *
 * Con SERVICE ROLE key thi TUYET DOI khong duoc xuat hien o day. No bo qua RLS
 * hoan toan. Key do chi nam trong Local Helper tren may ca nhan va trong bien
 * moi truong cua Edge Function.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true neu du bien moi truong de noi database. Dung de hien man hinh huong dan. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

/**
 * Tra ve client Supabase, hoac null neu chua cau hinh bien moi truong.
 * Tra null thay vi nem loi de trang van render duoc va hien huong dan cai dat
 * cho nguoi moi clone repo.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;

  cached = createClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

/** Nem loi neu chua cau hinh. Dung trong cac ham chac chan can database. */
export function requireSupabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) {
    throw new Error(
      'Chưa cấu hình Supabase. Tạo file .env.local với NEXT_PUBLIC_SUPABASE_URL ' +
        'và NEXT_PUBLIC_SUPABASE_ANON_KEY. Xem README.md.',
    );
  }
  return c;
}
