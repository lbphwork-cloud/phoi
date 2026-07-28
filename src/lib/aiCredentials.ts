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
  activeFor: (provider: AiProvider, purpose: AiKeyPurpose) => AiCredentialPublic | null;
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
        .select('id, owner_id, provider, purpose, key_hint, is_active, last_used_at, created_at')
        .then(({ data: r, error }) => ({
          data: (r as AiCredentialPublic[] | null) ?? [],
          error,
        })),
  );

  const creds = data ?? [];

  return {
    creds,
    loading,
    activeFor: (provider, purpose) =>
      creds.find((c) => c.provider === provider && c.purpose === purpose && c.is_active) ?? null,
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
/**
 * Muc dich cua mot key: viet chu hay dung anh.
 *
 * Tach ra vi voi Google hai viec nay thuoc hai muc gia khac han nhau — key
 * trong du an mien phi viet chu duoc nhung han muc anh bang 0. Nguoi dung
 * thuong muon giu mot key mien phi cho phan chu va chi dung key co tra tien
 * khi that su can anh.
 *
 * Dan cung mot chuoi vao ca hai o cung duoc. Tach ra la MO them lua chon.
 */
export type AiKeyPurpose = 'text' | 'image';

export async function saveAiKey(
  provider: AiProvider,
  rawKey: string,
  purpose: AiKeyPurpose = 'text',
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
      body: { action: 'save', provider, key, purpose },
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

/**
 * Xoa mot key.
 *
 * Bang ai_credentials da duoc cap quyen DELETE cho chinh chu o migration 0002,
 * nen viec nay khong can di qua Edge Function.
 */
export async function deleteAiKey(id: string): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Chưa cấu hình Supabase.' };

  const { error } = await sb.from('ai_credentials').delete().eq('id', id);
  if (error) return { ok: false, message: `Không xoá được key: ${error.message}` };
  return { ok: true, message: 'Đã xoá key.' };
}

/**
 * Goi nha cung cap mot lan that nho de xem key co THAT SU dung duoc khong.
 *
 * Khong tu goi tu trinh duyet: key da duoc ma hoa va chi Edge Function moi giai
 * ma duoc. Chi tiet phep thu o supabase/functions/ai-credentials/index.ts —
 * dang chu y la no goi lenh SINH NOI DUNG chu khong phai lenh liet ke mo hinh,
 * vi mot key co the liet ke duoc mo hinh ma van khong sinh duoc gi.
 */
export async function testAiKey(
  provider: AiProvider,
  purpose: AiKeyPurpose = 'text',
): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Chưa cấu hình Supabase.' };

  try {
    const { data, error } = await sb.functions.invoke('ai-credentials', {
      body: { action: 'test', provider, purpose },
    });
    if (error) throw new Error(error.message);

    const r = data as { ok: boolean; error?: string; note?: string };
    return r?.ok
      ? { ok: true, message: r.note ?? 'Key dùng được.' }
      : { ok: false, message: r?.error ?? 'Key không dùng được, không rõ lý do.' };
  } catch (e) {
    return { ok: false, message: `Không thử được key: ${(e as Error).message}` };
  }
}

/**
 * Loi gan nhat cua mot nha cung cap, lay tu lich su cong viec AI.
 *
 * Key hong va key tot trong y het nhau tren man hinh. Dong loi gan nhat la thu
 * duy nhat phan biet duoc hai truong hop do ma khong phai bam thu.
 */
export function useLastAiError(provider: AiProvider): string | null {
  const { data } = useAsyncData<Array<{ error: string | null }>>(
    `ai-last-error-${provider}`,
    (sb) =>
      sb
        .from('ai_jobs')
        .select('error')
        .eq('provider', provider)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data: r, error }) => ({
          data: (r as Array<{ error: string | null }> | null) ?? [],
          error,
        })),
  );

  return data?.[0]?.error ?? null;
}

/**
 * Trang thai o nhap key dung chung trong trinh soan bai.
 *
 * LUU XONG THI THU LUON.
 *   Bao "da luu" khong noi len dieu gi: key sai, key cua mot du an da bi xoa,
 *   key con han muc bang 0 — tat ca deu luu duoc y het nhau, va chi vo ra dung
 *   luc nguoi dung dang cho mot buc anh. Thu ngay tai day thi biet lien, va
 *   biet trong boi canh vua dan key vao chu khong phai nua tieng sau.
 */
export function useKeyInput(reload: () => void) {
  const [rawKey, setRawKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = useCallback(
    async (provider: AiProvider, purpose: AiKeyPurpose = 'text') => {
      setBusy(true);
      setMessage(null);

      const saved = await saveAiKey(provider, rawKey, purpose);
      if (!saved.ok) {
        setBusy(false);
        setMessage({ ok: false, text: saved.message });
        return;
      }

      // Key da luu roi thi du sao cung giu lai — thu that bai khong phai ly do
      // de vut key di, vi co the chi la loi mang nhat thoi.
      setRawKey('');
      reload();

      const probe = await testAiKey(provider, purpose);
      setBusy(false);
      setMessage({
        ok: probe.ok,
        text: probe.ok ? `Đã lưu key. ${probe.message}` : `Đã lưu key, nhưng: ${probe.message}`,
      });
    },
    [rawKey, reload],
  );

  return { rawKey, setRawKey, busy, message, setMessage, submit };
}
