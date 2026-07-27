'use client';

/**
 * Doc va luu API key AI cua CHINH nguoi dang dang nhap.
 *
 * TACH RA THANH FILE RIENG vi hai noi can: trang Quan tri > AI (quan ly day du)
 * va trinh soan bai (chi can biet "co key chua" va cho nhap nhanh mot cai).
 *
 * VI SAO PHAI CO O NAY NGAY TRONG TRINH SOAN BAI
 *   Truoc day key chi nhap duoc o trang quan tri. Hau qua: nut "Tao anh bang
 *   AI" luon bam duoc, ke ca khi tai khoan chua co key nao — bam xong doi mot
 *   luc roi nhan mot dong bao loi nho xiu. Nguoi dung khong the doan duoc rang
 *   thu minh thieu nam o mot trang khac.
 *
 * KEY THO KHONG BAO GIO O LAI TRINH DUYET
 *   Ham `saveAiKey` gui thang cho Edge Function roi quen. Function ma hoa va
 *   ghi vao bang; cot encrypted_key da bi thu hoi quyen SELECT o migration
 *   0002 nen doc lai la khong the, ke ca chinh chu. Giao dien chi con `key_hint`
 *   — vai ky tu dau va cuoi, du de nhan ra minh dang dung key nao.
 */

import { useCallback, useState } from 'react';
import { getSupabase } from './supabase/client';
import { useAsyncData } from './hooks';
import type { AiCredentialPublic, AiProvider } from './supabase/types';

export interface AiCredentialState {
  creds: AiCredentialPublic[];
  loading: boolean;
  /** Key dang dung duoc cho nha cung cap nay, hoac null. */
  activeFor: (provider: AiProvider) => AiCredentialPublic | null;
  reload: () => void;
}

export function useAiCredentials(): AiCredentialState {
  const { data, loading, reload } = useAsyncData<AiCredentialPublic[]>(
    'ai-credentials',
    (sb) =>
      sb
        .from('ai_credentials')
        // KHONG select('*') — cot encrypted_key bi thu hoi quyen doc, select('*')
        // se loi. Phai liet ke tung cot duoc phep.
        .select('id, owner_id, provider, key_hint, is_active, last_used_at, created_at')
        .then(({ data: r, error }) => ({
          data: (r as AiCredentialPublic[] | null) ?? [],
          error,
        })),
  );

  const creds = data ?? [];

  return {
    creds,
    loading,
    activeFor: (provider) => creds.find((c) => c.provider === provider && c.is_active) ?? null,
    reload,
  };
}

/**
 * Luu mot key moi. Tra ve thong bao tieng Viet de hien thang cho nguoi dung.
 *
 * KHONG DOAN DINH DANG KEY. Tung co ban kiem tra key Gemini phai bat dau bang
 * "AIza" — roi Google phat key dang "AQ.Ab8..." va giao dien tu choi mot key
 * hoan toan hop le. Chi kiem hai thu khong the sai: do dai va khoang trang.
 */
export async function saveAiKey(
  provider: AiProvider,
  rawKey: string,
): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Chưa cấu hình Supabase.' };

  const key = rawKey.trim();

  if (provider !== 'local_comfyui') {
    if (key.length < 20) return { ok: false, message: 'Key quá ngắn, có vẻ chưa dán đủ.' };
    if (/\s/.test(key)) {
      return { ok: false, message: 'Key có khoảng trắng hoặc xuống dòng — kiểm tra lại lúc sao chép.' };
    }
  }

  try {
    const { data, error } = await sb.functions.invoke('ai-credentials', {
      body: { action: 'save', provider, key },
    });

    if (error) throw new Error(error.message);

    const r = data as { ok: boolean; error?: string };
    if (!r?.ok) throw new Error(r?.error ?? 'Không lưu được key.');

    return {
      ok: true,
      message: 'Đã lưu key. Từ giờ chỉ hiện phần gợi nhớ, không đọc lại được key gốc.',
    };
  } catch (e) {
    return {
      ok: false,
      message:
        `${(e as Error).message}. Nếu chưa triển khai Edge Function "ai-credentials", ` +
        'xem hướng dẫn trong supabase/functions/README.md.',
    };
  }
}

/** Trang thai o nhap key dung chung trong trinh soan bai. */
export function useKeyInput(reload: () => void) {
  const [rawKey, setRawKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = useCallback(
    async (provider: AiProvider) => {
      setBusy(true);
      setMessage(null);
      const r = await saveAiKey(provider, rawKey);
      setBusy(false);
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) {
        setRawKey('');
        reload();
      }
    },
    [rawKey, reload],
  );

  return { rawKey, setRawKey, busy, message, submit };
}
