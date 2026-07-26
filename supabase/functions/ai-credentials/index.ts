/**
 * Edge Function: ai-credentials
 * Nhan API key tho tu nguoi dung, ma hoa, roi luu.
 *
 * VI SAO PHAI CO HAM NAY THAY VI GHI THANG TU TRINH DUYET
 *   Neu trinh duyet ghi thang vao bang thi key phai di qua REST API o dang tho,
 *   va quan trong hon: khoa ma hoa se phai nam trong ma JavaScript gui tori
 *   trinh duyet — tuc la khong con la khoa nua. Chi may chu moi giu duoc khoa.
 *
 * MO HINH MA HOA
 *   AES-256-GCM. Khoa lay tu bien moi truong AI_KEY_ENCRYPTION_SECRET qua
 *   SHA-256. IV ngau nhien 12 byte moi lan ma hoa, luu kem ban ma.
 *   Dinh dang luu: base64(iv ‖ ciphertext ‖ tag)
 *
 * GIOI HAN THAT SU CUA CACH NAY
 *   Day la ma hoa "khi luu tru" (at rest), khong phai ma hoa dau cuoi. Ai co ca
 *   quyen doc database VA bien moi truong cua Edge Function thi giai ma duoc.
 *   No bao ve truoc: ro ri ban sao luu database, nham select ra key, va nguoi
 *   dung khac doc key cua nhau. No KHONG bao ve neu toan bo project Supabase
 *   bi chiem quyen. Voi muc do rui ro cua mot website affiliate mot nguoi van
 *   hanh thi day la muc hop ly; khong nen quang cao no manh hon thuc te.
 *
 * TRIEN KHAI
 *   npx supabase secrets set AI_KEY_ENCRYPTION_SECRET="$(openssl rand -base64 32)"
 *   npx supabase functions deploy ai-credentials
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const enc = new TextEncoder();
const dec = new TextDecoder();

async function aesKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('AI_KEY_ENCRYPTION_SECRET');
  if (!secret) {
    throw new Error(
      'Thiếu biến môi trường AI_KEY_ENCRYPTION_SECRET. Đặt bằng: ' +
        'npx supabase secrets set AI_KEY_ENCRYPTION_SECRET="$(openssl rand -base64 32)"',
    );
  }
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));

  const merged = new Uint8Array(iv.length + ct.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ct), iv.length);

  return btoa(String.fromCharCode(...merged));
}

export async function decryptSecret(stored: string): Promise<string> {
  const key = await aesKey();
  const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return dec.decode(pt);
}

/** Vai ky tu dau va cuoi de nguoi dung nhan dien key, khong du de dung lai. */
function hintOf(key: string): string {
  if (key.length <= 10) return '••••';
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

/** Kiem tra so bo dinh dang key theo tung nha cung cap. */
function looksValid(provider: string, key: string): string | null {
  if (provider === 'local_comfyui') return null;
  if (key.length < 20) return 'Key quá ngắn, có vẻ không đúng.';
  if (/\s/.test(key)) return 'Key không được chứa khoảng trắng.';
  if (provider === 'gemini' && !key.startsWith('AIza')) {
    return 'Key của Google Gemini thường bắt đầu bằng "AIza".';
  }
  if (provider === 'openai' && !key.startsWith('sk-')) {
    return 'Key của OpenAI thường bắt đầu bằng "sk-".';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ ok: false, error: 'Chỉ nhận POST.' }, 405);

  // --- Xac thuc nguoi goi --------------------------------------------------
  // Dung anon key + JWT cua nguoi dung de Supabase tu ap RLS. KHONG dung service
  // role o buoc nay: neu dung, moi kiem tra quyen se phai tu viet tay va rat de sai.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: auth, error: authErr } = await userClient.auth.getUser();
  if (authErr || !auth?.user) {
    return json({ ok: false, error: 'Chưa đăng nhập.' }, 401);
  }
  const uid = auth.user.id;

  // --- Giai doan dau: chi admin duoc luu key ------------------------------
  // Mo cho nguoi dung thuong la mot trach nhiem phap ly that (neu ro ri, ho mat
  // tien). Schema da san sang, chi can doi dieu kien nay khi ban san sang.
  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return json(
      {
        ok: false,
        error:
          'Giai đoạn này chỉ quản trị viên được lưu API key. Bạn vẫn tải ảnh lên tay được bình thường.',
      },
      403,
    );
  }

  let body: { action?: string; provider?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Body không phải JSON hợp lệ.' }, 400);
  }

  if (body.action !== 'save') {
    return json({ ok: false, error: 'Chỉ hỗ trợ action = "save".' }, 400);
  }

  const provider = String(body.provider ?? '');
  const rawKey = String(body.key ?? '');

  if (!['gemini', 'openai', 'local_comfyui'].includes(provider)) {
    return json({ ok: false, error: `Nhà cung cấp không hợp lệ: ${provider}` }, 400);
  }

  const formatError = looksValid(provider, rawKey);
  if (formatError) return json({ ok: false, error: formatError }, 400);

  // --- Ma hoa va ghi ------------------------------------------------------
  // Buoc GHI dung service role, vi cot encrypted_key da bi REVOKE quyen ghi
  // cua role authenticated — dung y do la de chi duong nay ghi duoc.
  let encrypted: string;
  try {
    encrypted = await encryptSecret(rawKey || 'local');
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: dbErr } = await admin.from('ai_credentials').upsert(
    {
      owner_id: uid,
      provider,
      encrypted_key: encrypted,
      key_hint: provider === 'local_comfyui' ? '(máy cá nhân)' : hintOf(rawKey),
      is_active: true,
    },
    { onConflict: 'owner_id,provider' },
  );

  if (dbErr) return json({ ok: false, error: dbErr.message }, 500);

  await admin.from('admin_audit_log').insert({
    actor_id: uid,
    action: 'ai_credential.save',
    entity_type: 'ai_credential',
    // CO Y khong ghi key hay hint vao nhat ky. Nhat ky la noi de doc lai nhieu
    // lan, khong phai noi de du lieu bi mat nam.
    detail: { provider },
  });

  return json({ ok: true, provider, key_hint: hintOf(rawKey) });
});
