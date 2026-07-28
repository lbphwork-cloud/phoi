/**
 * Edge Function: ai-generate
 * Tao anh minh hoa cho set do bang API key cua chinh nguoi dung (BYOK).
 *
 * LUONG
 *   1. Nhan { provider, prompt, outfitId? } tu trang /admin/ai.
 *   2. Kiem tra nguoi goi la quan tri vien.
 *   3. Ghi mot dong vao ai_jobs (status = 'claimed').
 *   4. Giai ma API key cua nguoi do, goi nha cung cap.
 *   5. Tai anh len Supabase Storage.
 *   6. Cap nhat job -> 'done' kem duong dan anh.
 *
 * BA QUY TAC BAT BUOC VOI ANH AI — khong co cong tac tat
 *   1. Anh chi duoc gan vao outfit o dang BAN NHAP, khong dang ngay.
 *   2. Phai duoc quan tri vien duyet tay truoc khi cong khai.
 *   3. Bai hien nhan "Anh tao boi AI" kem luu y rang anh khong dam bao giong
 *      tuyet doi san pham that.
 *   Function nay chi tao anh va danh dau ai_generated = true. Hai quy tac con
 *   lai do may trang thai kiem duyet trong database dam nhiem.
 *
 * VE DO CHINH XAC CUA ANH AI — noi ro de khong ai ky vong sai
 *   Anh sinh ra la anh MINH HOA PHONG CACH, khong phai anh san pham. No khong
 *   giu duoc chinh xac logo, chu in, hoa tiet nho va thuong lech mau nhe. Do la
 *   gioi han co huu cua mo hinh khuech tan, khong phai loi cau hinh. Vi vay:
 *     - Anh san pham THAT (lay tu link) van la thu nguoi mua dua vao de quyet dinh.
 *     - Anh AI chi de set do trong hap dan hon o trang danh sach.
 *
 * TRIEN KHAI
 *   supabase secrets set AI_KEY_ENCRYPTION_SECRET="$(openssl rand -base64 32)"
 *   supabase functions deploy ai-generate
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------------------------------------------------------------------------
// Giai ma API key
//
// Phai giong y het cach ma hoa trong ai-credentials/index.ts. Neu doi mot ben
// ma quen ben kia thi moi key da luu tro nen khong giai ma duoc — va vi
// encrypted_key khong doc lai duoc, khong co cach nao khoi phuc ngoai nhap lai key.
// ---------------------------------------------------------------------------

async function aesKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('AI_KEY_ENCRYPTION_SECRET');
  if (!secret) {
    throw new Error(
      'Thiếu biến môi trường AI_KEY_ENCRYPTION_SECRET. Đặt bằng: ' +
        'supabase secrets set AI_KEY_ENCRYPTION_SECRET="$(openssl rand -base64 32)"',
    );
  }
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function decryptSecret(stored: string): Promise<string> {
  const key = await aesKey();
  const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}

// ---------------------------------------------------------------------------
// Adapter cho tung nha cung cap
//
// Moi adapter tra ve mang anh dang { mimeType, base64 }. Them nha cung cap moi
// chi can viet mot ham cung dang, khong phai sua gi khac.
// ---------------------------------------------------------------------------

interface GeneratedImage {
  mimeType: string;
  base64: string;
}

/**
 * Google Gemini.
 *
 * Vi sao uu tien nha cung cap nay: co goi mien phi cho tao anh (khoang 500 anh
 * moi ngay), khong can the tin dung. Nhieu hon nhu cau cua mot nguoi van hanh
 * gap nhieu lan.
 *
 * TEN MO HINH CO THE DOI. Google doi ten mo hinh anh kha thuong xuyen
 * (gemini-2.0-flash-exp-image-generation -> gemini-2.5-flash-image-preview ->
 * gemini-2.5-flash-image). Nen ten mo hinh nhan tu tham so `model` de doi duoc
 * ngay trong giao dien, khong phai trien khai lai function.
 */
/**
 * Cac ten mien duoc phep tai anh mau ve.
 *
 * KHONG cho tai anh tu dia chi tuy y. Function nay chay tren may chu cua
 * Supabase; neu no chiu tai bat ky URL nao nguoi dung gui len thi no thanh mot
 * cong cu do quet mang noi bo (SSRF) — go dia chi 169.254.169.254 vao la doc
 * duoc thong tin may chu.
 *
 * Chi hai nhom: Storage cua chinh project nay, va CDN anh cua hai san. Ca hai
 * deu la noi anh san pham that su nam.
 */
function isAllowedImageHost(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  const own = new URL(Deno.env.get('SUPABASE_URL') ?? 'https://invalid').hostname;
  if (host === own) return true;
  return [
    'down-vn.img.susercontent.com',
    'cf.shopee.vn',
    'p16-oec-va.ibyteimg.com',
    'p16-oec-sg.ibyteimg.com',
  ].some((d) => host === d || host.endsWith('.' + d));
}

/**
 * Tai anh mau ve va doi sang dang inline cho Gemini.
 *
 * Anh nao tai khong duoc thi BO QUA chu khong lam hong ca lan tao: mat mot anh
 * tham chieu chi lam ket qua kem chinh xac hon, con bao loi thi nguoi dung
 * khong tao duoc gi ca.
 */
async function loadReferenceImages(
  urls: string[],
): Promise<Array<{ inline_data: { mime_type: string; data: string } }>> {
  const out: Array<{ inline_data: { mime_type: string; data: string } }> = [];

  for (const raw of urls.slice(0, 6)) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' || !isAllowedImageHost(u)) continue;

      const res = await fetch(u.toString(), { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;

      const type = res.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) continue;

      const buf = new Uint8Array(await res.arrayBuffer());
      // Bo anh qua lon: moi anh vao thang so token cua lan goi.
      if (buf.byteLength > 4 * 1024 * 1024) continue;

      let bin = '';
      for (const b of buf) bin += String.fromCharCode(b);
      out.push({ inline_data: { mime_type: type.split(';')[0], data: btoa(bin) } });
    } catch { /* bo qua anh nay */ }
  }

  return out;
}

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  model: string,
  referenceUrls: string[] = [],
): Promise<GeneratedImage[]> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Khoa o header, khong o query string: query string de lot vao log truy cap
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      // Anh mau di TRUOC cau lenh. Gemini doc cac phan theo thu tu, va dat anh
      // truoc giup mo hinh coi chung la tham chieu cho cau lenh phia sau chu
      // khong phai mot yeu cau roi rac.
      contents: [{ parts: [...(await loadReferenceImages(referenceUrls)), { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const text = await res.text();

  if (!res.ok) {
    // Doc thong bao loi cua Google va dich sang cau nguoi dung hieu duoc
    let detail = text.slice(0, 400);
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message ?? detail;
    } catch { /* giu nguyen text tho */ }

    if (res.status === 400 && /API key not valid/i.test(detail)) {
      throw new Error('API key của Gemini không hợp lệ. Kiểm tra lại key trong trang AI.');
    }
    if (res.status === 429) {
      /*
        GIU NGUYEN VAN CAU CUA GOOGLE, khong viet lai thanh "het han muc hom nay".

        Cau cu doan sai theo hai huong cung mot luc:

          1. No khang dinh "goi mien phi khoang 500 anh/ngay". Sai: han muc anh
             cua goi mien phi bang 0. Khong phai it — la khong co.
          2. No noi "thu lai sau", trong khi truong hop pho bien nhat la du an
             cua key KHONG CO han muc nao ca. Doi den sang mai cung khong doi.

        Phan biet hai truong hop do nam trong chinh chuoi tra ve cua Google —
        `limit: 0` hay `limit: <so duong>` — va ben client (withQuotaHelp trong
        src/lib/aiImage.ts) doc duoc no de noi dung viec can lam. Viet de len
        cau goc o day la XOA MAT thu duy nhat phan biet duoc, va client chi con
        cach doan.
      */
      throw new Error(`Gemini từ chối vì hạn mức (429): ${detail}`);
    }
    if (res.status === 404) {
      throw new Error(
        `Không tìm thấy mô hình "${model}". Google đổi tên mô hình ảnh khá thường ` +
          'xuyên — đổi tên mô hình trong trang AI rồi thử lại.',
      );
    }
    throw new Error(`Gemini trả về lỗi ${res.status}: ${detail}`);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('Gemini trả về dữ liệu không phải JSON.');
  }

  const parts =
    (body as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }> })
      ?.candidates?.[0]?.content?.parts ?? [];

  const images: GeneratedImage[] = [];
  for (const p of parts) {
    const inline = (p.inlineData ?? p.inline_data) as
      | { mimeType?: string; mime_type?: string; data?: string }
      | undefined;
    if (inline?.data) {
      images.push({
        mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png',
        base64: inline.data,
      });
    }
  }

  if (images.length === 0) {
    // Thuong xay ra khi bo loc noi dung cua Google tu choi cau lenh
    const reason =
      (body as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]
        ?.finishReason ?? 'không rõ';
    throw new Error(
      `Gemini không trả về ảnh nào (lý do: ${reason}). ` +
        'Thường là do bộ lọc nội dung — thử diễn đạt lại mô tả, tránh nhắc tên ' +
        'thương hiệu thật hoặc người thật.',
    );
  }

  return images;
}

/**
 * OpenAI. Tao anh la dich vu TRA TIEN, tinh theo tung anh — khong co goi mien phi.
 * Giu adapter nay de ban co lua chon, nhung Gemini nen la mac dinh.
 */
async function generateWithOpenAI(
  apiKey: string,
  prompt: string,
  model: string,
): Promise<GeneratedImage[]> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: '1024x1024',
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const text = await res.text();

  if (!res.ok) {
    let detail = text.slice(0, 400);
    try {
      detail = JSON.parse(text)?.error?.message ?? detail;
    } catch { /* giu nguyen */ }

    if (res.status === 401) throw new Error('API key của OpenAI không hợp lệ.');
    if (res.status === 429) {
      throw new Error('OpenAI báo vượt hạn mức hoặc hết tín dụng trong tài khoản.');
    }
    throw new Error(`OpenAI trả về lỗi ${res.status}: ${detail}`);
  }

  const data = (JSON.parse(text) as { data?: Array<{ b64_json?: string; url?: string }> })
    ?.data ?? [];

  const images: GeneratedImage[] = [];
  for (const d of data) {
    if (d.b64_json) {
      images.push({ mimeType: 'image/png', base64: d.b64_json });
    } else if (d.url) {
      // Mot so mo hinh tra URL thay vi base64 — tai ve roi luu lai o storage cua
      // minh, vi URL cua OpenAI het han sau vai gio.
      const img = await fetch(d.url, { signal: AbortSignal.timeout(30_000) });
      const buf = new Uint8Array(await img.arrayBuffer());
      let bin = '';
      for (const b of buf) bin += String.fromCharCode(b);
      images.push({
        mimeType: img.headers.get('content-type') ?? 'image/png',
        base64: btoa(bin),
      });
    }
  }

  if (images.length === 0) throw new Error('OpenAI không trả về ảnh nào.');
  return images;
}

/**
 * Mo hinh viet chu. Khac han mo hinh tao anh.
 *
 * Duong sinh chu dung chung function nay thay vi tach function moi. Ly do:
 * khoa API da duoc ma hoa va giai ma o day roi; tach ra nghia la nhan doi doan
 * ma cham vao khoa, ma cang it noi cham vao khoa cang tot.
 */
// gemini-2.5-flash da bi Google ngung cap cho tai khoan MOI (tra 404 kem loi
// "no longer available to new users"), nen mac dinh la 2.0-flash. Ten mo hinh
// van nhan tu tham so `model` de doi duoc ma khong phai trien khai lai.
const DEFAULT_TEXT_MODEL: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
};

/**
 * Goi mo hinh ngon ngu de viet mot doan chu. Tra ve chu thuan.
 *
 * KHONG ghi vao ai_jobs nhu duong tao anh: mot doan mo ta khong ton chi phi
 * luu tru, khong can duyet, va nguoi dung se sua lai truoc khi luu. Ghi job
 * cho no chi lam bang ai_jobs day nhung dong khong ai doc.
 */
async function generateText(
  provider: string,
  apiKey: string,
  prompt: string,
  model: string,
): Promise<string> {
  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    if (!res.ok) throw new Error(`Gemini trả về ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const text = j?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text ?? '').join('') ?? '';
    if (!text.trim()) throw new Error('Gemini không trả về chữ nào.');
    return text;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`OpenAI trả về ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const text = j?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('OpenAI không trả về chữ nào.');
  return text;
}

const DEFAULT_MODEL: Record<string, string> = {
  gemini: 'gemini-2.5-flash-image',
  openai: 'gpt-image-1',
};

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ ok: false, error: 'Chỉ nhận POST.' }, 405);

  // --- Xac thuc nguoi goi -------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ ok: false, error: 'Chưa đăng nhập.' }, 401);
  const uid = auth.user.id;

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return json(
      { ok: false, error: 'Giai đoạn này chỉ quản trị viên được tạo ảnh bằng AI.' },
      403,
    );
  }

  // --- Doc tham so --------------------------------------------------------
  let body: {
    provider?: string;
    prompt?: string;
    outfitId?: string | null;
    model?: string;
    /** 'image' (mac dinh) hoac 'text' de viet mo ta bang tieng Viet. */
    mode?: string;
    /** Anh cua tung mon, dung lam mau tham chieu cho mo hinh anh. */
    referenceUrls?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Body không phải JSON hợp lệ.' }, 400);
  }

  const provider = String(body.provider ?? 'gemini');
  const prompt = String(body.prompt ?? '').trim();
  const outfitId = body.outfitId ?? null;
  const mode = body.mode === 'text' ? 'text' : 'image';
  const referenceUrls = Array.isArray(body.referenceUrls)
    ? body.referenceUrls.filter((x): x is string => typeof x === 'string')
    : [];
  const model = String(
    body.model ?? (mode === 'text' ? DEFAULT_TEXT_MODEL[provider] : DEFAULT_MODEL[provider]) ?? '',
  );

  if (!['gemini', 'openai'].includes(provider)) {
    return json(
      {
        ok: false,
        error:
          `Nhà cung cấp "${provider}" chưa được hỗ trợ ở đây. ` +
          'ComfyUI trên máy cá nhân đi qua hàng đợi ai_jobs, không qua function này.',
      },
      400,
    );
  }
  if (prompt.length < 20) {
    return json(
      { ok: false, error: 'Mô tả quá ngắn. Viết rõ phong cách, bối cảnh và bố cục.' },
      400,
    );
  }
  if (prompt.length > 4000) {
    return json({ ok: false, error: 'Mô tả quá dài (giới hạn 4000 ký tự).' }, 400);
  }

  // Service role cho cac buoc ghi: cot encrypted_key da bi thu hoi quyen doc
  // cua role authenticated, va bang ai_jobs can ghi ke ca khi phien het han
  // giua luc tao anh.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- Tao job de co dau vet, ke ca khi that bai --------------------------
  const { data: job, error: jobErr } = await admin
    .from('ai_jobs')
    .insert({
      requested_by: uid,
      outfit_id: outfitId,
      provider,
      prompt,
      params: { model },
      status: 'claimed',
      claimed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    return json({ ok: false, error: `Không tạo được yêu cầu: ${jobErr?.message}` }, 500);
  }

  const fail = async (message: string, status = 400) => {
    await admin
      .from('ai_jobs')
      .update({
        status: 'failed',
        error: message.slice(0, 1000),
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return json({ ok: false, jobId: job.id, error: message }, status);
  };

  try {
    // --- Lay va giai ma key ----------------------------------------------
    const { data: cred } = await admin
      .from('ai_credentials')
      .select('encrypted_key, is_active')
      .eq('owner_id', uid)
      .eq('provider', provider)
      /*
        LAY DUNG KEY CHO DUNG VIEC.

        `mode` da noi day la lan goi viet chu hay dung anh, va moi tai khoan gio
        giu hai key rieng cho hai viec do (migration 0026). Voi Google, hai viec
        nay thuoc hai muc gia khac han: key trong du an mien phi viet chu duoc
        nhung han muc anh bang 0.

        Lay nham key thi loi bao ve se la "het han muc" — mot cau dan nguoi dung
        di sai huong hoan toan, vi key ho vua nap tien van con nguyen.
      */
      .eq('purpose', mode)
      .maybeSingle();

    if (!cred) {
      const viec = mode === 'text' ? 'viết chữ' : 'dựng ảnh';
      return await fail(
        `Chưa có API key ${provider} cho việc ${viec}. Nhập key vào ô ngay cạnh nút bạn vừa bấm.`,
        400,
      );
    }
    if (!cred.is_active) {
      return await fail(`API key cho ${provider} đang bị tắt. Bật lại trong trang AI.`, 400);
    }

    let apiKey: string;
    try {
      apiKey = await decryptSecret(cred.encrypted_key as string);
    } catch {
      return await fail(
        'Không giải mã được API key. Thường là do AI_KEY_ENCRYPTION_SECRET đã bị ' +
          'thay đổi sau khi lưu key. Xoá key cũ trong trang AI rồi nhập lại.',
        500,
      );
    }

    // --- Duong viet chu: tra ve ngay, khong dung toi storage --------------
    if (mode === 'text') {
      const text = await generateText(provider, apiKey, prompt, model);
      await admin
        .from('ai_jobs')
        .update({ status: 'done', finished_at: new Date().toISOString() })
        .eq('id', job.id);
      return json({ ok: true, text, jobId: job.id });
    }

    // --- Goi nha cung cap -------------------------------------------------
    const images =
      provider === 'gemini'
        ? await generateWithGemini(apiKey, prompt, model, referenceUrls)
        : await generateWithOpenAI(apiKey, prompt, model);

    // --- Tai anh len storage ----------------------------------------------
    // Duong dan phai bat dau bang user id de khop policy trong 0004_storage.sql.
    const urls: string[] = [];

    for (const [i, img] of images.entries()) {
      const ext = img.mimeType.includes('jpeg') ? 'jpg'
        : img.mimeType.includes('webp') ? 'webp' : 'png';
      const path = `${uid}/ai-${job.id}-${i}.${ext}`;

      const bytes = Uint8Array.from(atob(img.base64), (c) => c.charCodeAt(0));

      const { error: upErr } = await admin.storage
        .from('outfit-images')
        .upload(path, bytes, {
          contentType: img.mimeType,
          cacheControl: '31536000',
          upsert: true,
        });

      if (upErr) return await fail(`Không lưu được ảnh: ${upErr.message}`, 500);

      urls.push(
        admin.storage.from('outfit-images').getPublicUrl(path).data.publicUrl,
      );
    }

    // --- Hoan tat ---------------------------------------------------------
    await admin
      .from('ai_jobs')
      .update({
        status: 'done',
        result_urls: urls,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    await admin
      .from('ai_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('owner_id', uid)
      .eq('provider', provider)
      .eq('purpose', mode);

    // CO Y khong tu gan anh vao outfit. Quan tri vien phai xem roi tu chon —
    // day la mot phan cua quy tac "anh AI luon qua kiem duyet tay".
    await admin.from('admin_audit_log').insert({
      actor_id: uid,
      action: 'ai.generate',
      entity_type: 'ai_job',
      entity_id: job.id,
      // Khong ghi API key vao nhat ky, chi ghi nha cung cap va mo hinh
      detail: { provider, model, images: urls.length, outfit_id: outfitId },
    });

    return json({
      ok: true,
      jobId: job.id,
      urls,
      note:
        'Ảnh đã lưu ở dạng bản nháp. Xem rồi tự chọn gán vào set đồ — ảnh AI luôn ' +
        'phải qua kiểm duyệt tay.',
    });
  } catch (e) {
    return await fail((e as Error).message, 502);
  }
});
