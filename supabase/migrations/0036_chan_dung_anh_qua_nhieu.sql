-- =============================================================================
-- CHAN DUNG ANH QUA NHIEU — o TANG DATABASE, khong phai o trinh duyet
--
-- LO HONG DANG CO
--   Viec chan bam lien tuc hien nam trong `useRateLimit` — no dem so lan trong
--   localStorage cua trinh duyet. Ai mo cong cu nha phat trien xoa mot dong la
--   dem lai tu dau.
--
--   Va moi lan bam dung anh la khoang 0,2 USD tinh vao API key CUA CHU WEBSITE
--   (khi key duoc dung chung) hoac cua chinh nguoi do. Mot nguoi bam ba tram
--   lan trong mot buoi chieu la sau muoi do la.
--
--   Chan o trinh duyet la mot loi nhac, khong phai mot cai khoa. Cai khoa phai
--   nam o noi nguoi dung khong voi tay toi duoc.
--
-- MUC: 5 ANH MOI NGAY cho tai khoan thuong, KHONG GIOI HAN cho quan tri vien.
--   Do la con so chu website chon. Quan tri vien khong bi chan vi ho la nguoi
--   tra tien va la nguoi duyet moi tam anh truoc khi no len trang.
--
-- DEM THEO NGAY UTC.
--   Khong doi mui gio Viet Nam: mot ham chi duoc phep dua vao thu no chac chan
--   biet. `now()` cua Postgres la UTC, va cai nguoi dung can biet la "con bao
--   nhieu luot", khong phai "reset luc may gio". Cau thong bao noi ro so luot
--   con lai chu khong noi gio reset.
-- =============================================================================

create table if not exists ai_usage (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     ai_provider not null,
  -- 'image' hoac 'text'. Chi 'image' bi tinh vao han muc — viet chu gan nhu
  -- khong ton gi va nguoi dung tra bang key cua chinh ho.
  purpose      text not null default 'image',
  /*
    CHI PHI DO NHA CUNG CAP BAO VE, don vi rieng cua ho.

    Khong quy doi ra do la o day: ty gia quy doi la thu cua nha cung cap va co
    the doi, con con so ho tra ve thi khong. Luu nguyen van roi doi don vi luc
    hien la cach duy nhat khong lam sai lich su.
  */
  cost_units   bigint,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_day
  on ai_usage (user_id, created_at desc);

alter table ai_usage enable row level security;

-- Nguoi dung doc duoc luot dung cua CHINH MINH — de giao dien hien "con 3 luot".
create policy ai_usage_read_self on ai_usage
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- KHONG cap quyen INSERT cho ai. Chi Edge Function (service role) duoc ghi.
-- Cho nguoi dung tu ghi nghia la cho ho tu quyet dinh minh da dung bao nhieu.
revoke insert, update, delete on ai_usage from anon, authenticated;

/**
 * Con bao nhieu luot dung anh trong hom nay.
 *
 * Tra ve so am nghia la KHONG GIOI HAN (quan tri vien).
 *
 * SECURITY DEFINER de ham doc duoc ca bang ai_usage lan vai tro nguoi dung ma
 * khong phai noi long RLS cho ai.
 */
create or replace function ai_image_quota_left(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_used integer;
begin
  select role into v_role from profiles where id = p_user;
  if v_role = 'admin' then
    return -1;  -- khong gioi han
  end if;

  select count(*) into v_used
    from ai_usage
   where user_id = p_user
     and purpose = 'image'
     and created_at >= date_trunc('day', now());

  return greatest(0, 5 - v_used);
end;
$$;

comment on function ai_image_quota_left(uuid) is
  'So luot dung anh con lai hom nay. -1 = khong gioi han (quan tri vien).';

grant execute on function ai_image_quota_left(uuid) to authenticated;
