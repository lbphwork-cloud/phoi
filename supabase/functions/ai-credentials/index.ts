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

/**
 * Kiem tra so bo dinh dang key.
 *
 * CO Y KIEM TRA RAT LONG. Ban truoc bat key Gemini phai bat dau bang "AIza",
 * va no da TU CHOI KEY THAT cua nguoi dung — Google phat key theo it nhat hai
 * dinh dang, "AIza..." kieu cu va "AQ.Ab8..." kieu moi, va ho co the doi tiep
 * bat cu luc nao ma khong bao ai.
 *
 * Bai hoc: doan dinh dang cua mot he thong ben ngoai roi CHAN dua tren phong
 * doan do la cach chac chan de mot ngay nao do chan nham nguoi dung that. Chi
 * chan nhung gi chac chan sai — qua ngan, co khoang trang, co xuong dong. Con
 * key co dung khong thi nha cung cap tra loi chinh xac hon ta nhieu, ngay o
 * lan goi dau tien.
 */
function looksValid(provider: string, key: string): string | null {
  if (provider === 'local_comfyui') return null;
  if (key.length < 20) return 'Key quá ngắn, có vẻ không đúng.';
  if (/\s/.test(key)) return 'Key không được chứa khoảng trắng hay xuống dòng.';
  return null;
}

/**
 * Doc va giai ma key da luu cua mot nguoi dung.
 *
 * Dung service role vi cot encrypted_key da bi REVOKE quyen doc cua role
 * authenticated — chinh chu cung khong select ra duoc. Do la co y.
 */
async function decryptStoredKey(
  uid: string,
  provider: string,
  purpose: string,
): Promise<string | null> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data } = await admin
    .from('ai_credentials')
    .select('encrypted_key')
    .eq('owner_id', uid)
    .eq('provider', provider)
    .eq('purpose', purpose)
    .maybeSingle();

  if (!data?.encrypted_key) return null;

  try {
    return await decryptSecret(data.encrypted_key);
  } catch {
    return null;
  }
}

/**
 * Goi nha cung cap mot lan that nho de xem key co THAT SU dung duoc khong.
 *
 * KHONG DUNG LENH LIET KE MO HINH. Ban dau toi viet ham nay goi /v1beta/models
 * — no tra ve "Key dung duoc, 50 mo hinh" trong khi moi lenh tao noi dung cua
 * dung key do deu bi tu choi 429 vi han muc bang 0. Mot phep thu bao dat trong
 * khi thu that hong con te hon la khong thu gi: no lam nguoi dung di tim
 * nguyen nhan o cho khac.
 *
 * Liet ke mo hinh chi chung minh key co ton tai. Cai can biet la key co SINH
 * duoc noi dung khong — nen phai goi dung viec do, du chi mot chu.
 *
 * PHAN BIET BA TINH HUONG, vi viec nguoi dung phai lam khac han nhau:
 *   key sai        -> phai lay key khac
 *   het han muc    -> key dung, phai tao key o du an moi hoac bat thanh toan
 *   khong goi duoc -> loi mang, thu lai
 */
/*
  CAC MO HINH DE THU, THEO DUNG VIEC KEY SE LAM.

  LOI DA SUA, va no tung bao SAI ve mot key TOT.
    Ban truoc thu ca hai muc dich bang dung mot mo hinh: gemini-2.0-flash.
    Key moi cua chu website chay gemini-2.5-flash binh thuong, nhung
    2.0-flash tra 429 "limit: 0" — nen website tuyen bo key hong trong khi no
    dung duoc. Nguoi dung khong co cach nao biet dieu do la sai.

  Nen: thu DUNG nhom mo hinh cua tung viec, va thu lan luot ca nhom. Mot ten
  het han muc khong co nghia la ca key hong.
*/
const PROBE_MODELS: Record<string, string[]> = {
  text: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'],
  image: ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'],
};

/** Cac mo hinh de thu key cua xAI (Grok). */
const PROBE_MODELS_XAI: Record<string, string[]> = {
  text: ['grok-4.5', 'grok-4.3'],
  image: ['grok-imagine-image'],
};

async function probeKey(
  provider: string,
  key: string,
  purpose: 'text' | 'image' = 'text',
): Promise<{ ok: boolean; error?: string; note?: string }> {
  if (provider === 'local_comfyui') {
    return { ok: true, note: 'ComfyUI chạy trên máy bạn, không có key để thử.' };
  }

  try {
    /*
      xAI: thu bang DUNG endpoint ma viec do se dung.

      Viet chu di qua /v1/chat/completions, dung anh di qua /v1/images/edits.
      Thu ca hai bang mot endpoint chung se cho ket qua vo nghia — key co the
      goi duoc chu ma khong con tin dung de dung anh, va nguoc lai.
    */
    if (provider === 'xai') {
      const ungVien = PROBE_MODELS_XAI[purpose] ?? PROBE_MODELS_XAI.text;
      const model = ungVien[0];

      const r = purpose === 'image'
        ? await fetch('https://api.x.ai/v1/images/edits', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: 'a plain white t-shirt on white background' }),
          })
        : await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model, max_tokens: 1, messages: [{ role: 'user', content: 'OK' }],
            }),
          });

      const t = await r.text();

      if (r.ok) {
        return {
          ok: true,
          note: `Key dùng được để ${purpose === 'image' ? 'dựng ảnh' : 'viết chữ'} `
            + `(vừa gọi thử ${model} và xAI trả lời bình thường).`
            + (purpose === 'image' ? ' Mỗi ảnh khoảng 0,2 USD — có tính tiền.' : ''),
        };
      }
      if (r.status === 401 || r.status === 403) {
        return { ok: false, error: 'xAI từ chối key này — sai key, key đã bị xoá, hoặc '
          + 'tài khoản chưa được cấp quyền dùng mô hình. Tạo key mới ở console.x.ai.' };
      }
      if (r.status === 429) {
        return { ok: false, error: 'Key hợp lệ nhưng tài khoản xAI đã hết tín dụng '
          + 'hoặc vượt hạn mức. Nạp thêm ở console.x.ai rồi thử lại.' };
      }
      return { ok: false, error: `xAI trả về ${r.status}: ${t.slice(0, 200)}` };
    }

    if (provider === 'gemini') {
      const ungVien = PROBE_MODELS[purpose] ?? PROBE_MODELS.text;
      let r: Response | null = null;
      let text = '';
      let chay = '';

      for (const ten of ungVien) {
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${ten}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'OK' }] }],
              // Chi gioi han so chu khi thu duong VIET CHU. Duong dung anh
              // khong nhan tham so nay, va gui vao lam Google tu choi.
              ...(purpose === 'text' ? { generationConfig: { maxOutputTokens: 1 } } : {}),
            }),
          },
        );
        text = await r.text();
        chay = ten;

        // 404 = mo hinh khong con; 429 = mo hinh nay khong co han muc. Ca hai
        // deu co the het o ten ke tiep.
        if (r.ok || (r.status !== 404 && r.status !== 429)) break;
      }

      if (r?.ok) {
        return {
          ok: true,
          note: `Key dùng được để ${purpose === 'image' ? 'dựng ảnh' : 'viết chữ'} `
            + `(vừa gọi thử ${chay} và Google trả lời bình thường).`,
        };
      }

      if (r?.status === 429) {
        return {
          ok: false,
          error: purpose === 'image'
            ? 'Key hợp lệ nhưng hạn mức DỰNG ẢNH đang bằng 0 — gói miễn phí của Google '
              + 'không kèm hạn mức ảnh nào. Phải bật thanh toán cho dự án trên Google Cloud. '
              + 'Key này vẫn có thể dùng được cho phần viết chữ.'
            : 'Key hợp lệ nhưng hạn mức viết chữ đang bằng 0. '
              + 'Vào aistudio.google.com/apikey, bấm "Create API key in new project" để lấy key '
              + 'trong một dự án mới, hoặc bật thanh toán cho dự án hiện tại.',
        };
      }
      if (r?.status === 400 || r?.status === 401 || r?.status === 403) {
        return {
          ok: false,
          error:
            'Google từ chối key này — sai key, key đã bị xoá, hoặc dự án chưa bật ' +
            'Generative Language API. Tạo key mới ở aistudio.google.com/apikey.',
        };
      }
      return { ok: false, error: `Google trả về ${r?.status}: ${text.slice(0, 200)}` };
    }

    // OpenAI: chi kiem tra key co hop le khong.
    //
    // KHONG goi thu mot lenh tao noi dung nhu ben Gemini, vi ben OpenAI moi lan
    // goi deu tinh tien that. Bat nguoi dung tra tien de biet key con song la
    // khong on. Doi lai, phep thu nay YEU HON — no khong noi duoc tai khoan con
    // tien hay khong, va cau `note` ben duoi noi ro dieu do thay vi im lang.
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (r.ok) {
      return {
        ok: true,
        note: 'Key hợp lệ. Còn tài khoản có đủ tiền để tạo ảnh hay không thì chỉ biết khi tạo thật.',
      };
    }
    if (r.status === 401) {
      return { ok: false, error: 'OpenAI từ chối key này. Lấy key mới ở platform.openai.com/api-keys.' };
    }
    if (r.status === 429) {
      return { ok: false, error: 'Key đúng nhưng tài khoản OpenAI đã hết hạn mức hoặc hết tiền.' };
    }
    return { ok: false, error: `OpenAI trả về ${r.status}.` };
  } catch (e) {
    return { ok: false, error: `Không gọi được nhà cung cấp: ${(e as Error).message}` };
  }
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

  let body: { action?: string; provider?: string; key?: string; purpose?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Body không phải JSON hợp lệ.' }, 400);
  }

  if (body.action !== 'save' && body.action !== 'test') {
    return json({ ok: false, error: 'Chỉ hỗ trợ action = "save" hoặc "test".' }, 400);
  }

  const provider = String(body.provider ?? '');

  /*
    MUC DICH CUA KEY: viet chu hay dung anh.

    Mac dinh 'text' chu khong bao loi khi thieu: cac ban giao dien cu goi ham
    nay ma khong gui truong nay, va chung deu dang noi ve key viet chu. Bao loi
    se lam chung hong ma khong duoc gi.
  */
  const purpose = body.purpose === 'image' ? 'image' : 'text';
  const rawKey = String(body.key ?? '');

  if (!['gemini', 'openai', 'xai', 'local_comfyui'].includes(provider)) {
    return json({ ok: false, error: `Nhà cung cấp không hợp lệ: ${provider}` }, 400);
  }

  // --- Thu key ------------------------------------------------------------
  // Luu key xong bao "da luu" thi khong noi len dieu gi: key sai, key het han
  // muc, key cua mot du an da bi xoa — tat ca deu luu duoc y het nhau, va chi
  // vo ra luc nguoi dung dang cho mot buc anh. Thu ngay tai day de biet lien.
  if (body.action === 'test') {
    const key = rawKey || (await decryptStoredKey(uid, provider, purpose));
    if (!key) {
      return json({ ok: false, error: 'Chưa có key nào để thử.' }, 400);
    }
    const result = await probeKey(provider, key, purpose as 'text' | 'image');
    return json(result, result.ok ? 200 : 200); // Khong phai loi HTTP: day la ket qua chan doan.
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
      purpose,
      encrypted_key: encrypted,
      key_hint: provider === 'local_comfyui' ? '(máy cá nhân)' : hintOf(rawKey),
      is_active: true,
    },
    { onConflict: 'owner_id,provider,purpose' },
  );

  if (dbErr) return json({ ok: false, error: dbErr.message }, 500);

  await admin.from('admin_audit_log').insert({
    actor_id: uid,
    action: 'ai_credential.save',
    entity_type: 'ai_credential',
    // CO Y khong ghi key hay hint vao nhat ky. Nhat ky la noi de doc lai nhieu
    // lan, khong phai noi de du lieu bi mat nam.
    detail: { provider, purpose },
  });

  return json({ ok: true, provider, purpose, key_hint: hintOf(rawKey) });
});
