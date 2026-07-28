/**
 * Edge Function: delete-account
 * Nguoi dung TU XOA TAI KHOAN cua chinh minh.
 *
 * VI SAO PHAI LA MOT FUNCTION RIENG
 *   Xoa mot dong trong `auth.users` chi lam duoc bang service role. Trinh duyet
 *   khong bao gio duoc cam khoa do — nen viec nay bat buoc phai chay o may chu.
 *
 *   Truoc day website chi co `erase_my_personal_data()`: no xoa ngay sinh, gu,
 *   lich su phan hoi va API key, nhung TAI KHOAN VAN CON. Nguoi muon roi han
 *   phai nhan tin nho chu website lam tay — tuc la ho phai tin mot nguoi la se
 *   nho lam, va phai cho.
 *
 * BA BUOC, THEO DUNG THU TU:
 *   1. Xoa du lieu ca nhan (dung lai ham SQL da co — mot cho duy nhat biet
 *      nhung bang nao chua du lieu ca nhan).
 *   2. Go ten khoi cac bai da dang. KHONG xoa bai: mot bai da duoc nguoi khac
 *      luu vao gio hang, da duoc chia se, va no khong mang thong tin ca nhan
 *      nao sau khi go ten. Xoa het se lam hong trai nghiem cua nguoi khac vi
 *      mot quyet dinh khong lien quan den ho.
 *   3. Xoa tai khoan dang nhap. Buoc nay CUOI CUNG, vi sau no thi token khong
 *      con hop le va khong lam duoc gi nua.
 *
 * KHONG CO DUONG QUAY LAI. Giao dien bat go lai dia chi email de xac nhan —
 * mot hop thoai "ban co chac khong" thi ai cung bam Dong y.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ ok: false, error: 'Chỉ nhận POST.' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ ok: false, error: 'Chưa đăng nhập.' }, 401);

  const uid = auth.user.id;
  const email = auth.user.email ?? '';

  /*
    BAT GO LAI EMAIL.

    Khong phai de bao mat — token da chung minh danh tinh roi. La de CHAM LAI:
    go dia chi cua chinh minh la mot hanh dong co y thuc, khac han voi viec bam
    Dong y trong mot hop thoai vua hien ra duoi con tro chuot.
  */
  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Dữ liệu gửi lên không đọc được.' }, 400);
  }

  if ((body.confirm ?? '').trim().toLowerCase() !== email.toLowerCase()) {
    return json(
      { ok: false, error: 'Địa chỉ email gõ vào không khớp với tài khoản đang đăng nhập.' },
      400,
    );
  }

  // --- 1. Du lieu ca nhan, qua chinh ham ma trang "Dữ liệu của tôi" dang dung -
  const { error: eErase } = await userClient.rpc('erase_my_personal_data');
  if (eErase) return json({ ok: false, error: `Không xoá được dữ liệu: ${eErase.message}` }, 500);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- 2. Go ten khoi bai da dang ------------------------------------------
  // Cot author_id cho phep null, va cac bai do van hien binh thuong — chung chi
  // khong con thuoc ve ai.
  await admin.from('outfits').update({ author_id: null }).eq('author_id', uid);
  await admin.from('affiliate_links').update({ owner_id: null }).eq('owner_id', uid);

  // Ghi truoc khi xoa tai khoan: sau khi xoa thi khong con uid de tham chieu.
  await admin.from('data_requests').insert({
    user_id: null,
    kind: 'delete',
    note: `Nguoi dung tu xoa tai khoan (${email})`,
    status: 'done',
  });

  // --- 3. Xoa tai khoan dang nhap ------------------------------------------
  const { error: eDel } = await admin.auth.admin.deleteUser(uid);
  if (eDel) {
    return json(
      {
        ok: false,
        error: `Đã xoá dữ liệu cá nhân nhưng không xoá được tài khoản: ${eDel.message}. `
          + 'Liên hệ quản trị viên để xoá nốt.',
      },
      500,
    );
  }

  return json({ ok: true, message: 'Đã xoá tài khoản và toàn bộ dữ liệu cá nhân.' });
});
