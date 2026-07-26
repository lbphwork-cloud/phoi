-- ============================================================================
-- PHOI — 0003_functions.sql
-- Trigger va ham. Day la noi cac quy tac nghiep vu duoc EP o tang database,
-- khong phai o tang ung dung.
--
-- Quy tac quan trong nhat trong file nay: "bai da duyet ma sua anh, san pham
-- hoac link affiliate thi phai duyet lai" (muc 5 cua de bai). Neu chi lam o
-- frontend thi nguoi dung goi thang REST API la vuot qua duoc.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TIEN ICH
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bo dau tieng Viet bang translate() thay vi extension unaccent, de migration
-- chay duoc o bat ky moi truong Postgres nao ma khong phu thuoc extension.
create or replace function slugify_vi(input text)
returns text language plpgsql immutable as $$
declare s text;
begin
  s := lower(coalesce(input, ''));
  -- Hai chuoi duoi day PHAI dai bang nhau (67 ky tu moi ben). Neu lech mot ky
  -- tu thi toan bo phan sau bi anh xa sai — 'đ' se thanh 'y' chu khong phai
  -- 'd'. scripts/verify-schema.mjs co mot test kiem tra dung dieu nay.
  --   a:17  e:11  i:5  o:17  u:11  y:5  d:1  = 67
  s := translate(
    s,
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  );
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');
  if s = '' then s := 'outfit'; end if;
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- TAO HO SO KHI CO NGUOI DANG KY
-- SECURITY DEFINER vi trigger nay chay tren auth.users, ngoai tam RLS cua
-- schema public.
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'thanh-vien'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into user_private (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- CHAN TU NANG QUYEN LEN ADMIN
-- RLS cho phep nguoi dung UPDATE dong profiles cua minh, nhung khong kiem
-- soat duoc tung cot. Neu khong co trigger nay thi bat ky ai cung tu doi
-- role thanh 'admin' duoc.
-- ---------------------------------------------------------------------------

create or replace function prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not is_trusted_context() then
    raise exception 'Khong duoc tu thay doi quyen tai khoan';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_no_escalation
  before update on profiles
  for each row execute function prevent_role_escalation();

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- SINH SLUG CHO OUTFIT
-- ---------------------------------------------------------------------------

create or replace function outfits_set_slug()
returns trigger language plpgsql as $$
declare base text; candidate text; n integer := 0;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  base := slugify_vi(new.title);
  candidate := base;
  while exists (select 1 from outfits where slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger trg_outfits_slug
  before insert on outfits
  for each row execute function outfits_set_slug();

create trigger trg_outfits_updated_at
  before update on outfits
  for each row execute function set_updated_at();

create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- MAY TRANG THAI KIEM DUYET
--
-- Luong: draft -> pending -> (needs_revision | approved | rejected) -> published
--
-- Tac gia CHI duoc di lai trong {draft, pending}. Moi trang thai con lai la
-- dac quyen cua admin. Khong the tu dang bai cong khai.
-- ---------------------------------------------------------------------------

create or replace function enforce_outfit_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then

    if not is_trusted_context() then
      -- Tac gia chi duoc dat {draft, pending}. Moi trang thai con lai
      -- (approved / published / rejected / hidden) la dac quyen cua admin.
      if new.status not in ('draft', 'pending') then
        raise exception
          'Chi quan tri vien duoc dat trang thai %. Tac gia chi duoc luu nhap hoac gui duyet.',
          new.status;
      end if;

      -- CO Y khong chan old.status o day. Tac gia duoc rut bai da dang ve nhap,
      -- va trigger duyet lai (outfits_require_rereview) cung can dat
      -- published -> pending. Neu chan theo old.status thi hai trigger nay
      -- xung dot: trigger duyet lai dat 'pending' xong thi trigger nay tu choi.
      --
      -- Ngoai le duy nhat: 'hidden' la khoa kiem duyet. Admin an noi dung vi
      -- pham thi tac gia khong tu mo lai duoc.
      if old.status = 'hidden' then
        raise exception
          'Bai dang bi an boi quan tri vien. Lien he quan tri vien de xu ly.';
      end if;
    end if;

    -- Dong moc thoi gian tuong ung
    if new.status = 'pending' then
      new.submitted_at := now();
    elsif new.status in ('approved', 'rejected', 'needs_revision') then
      new.reviewed_at := now();
    end if;

    if new.status = 'published' and old.status <> 'published' then
      new.published_at := coalesce(new.published_at, now());
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_outfits_status
  before update on outfits
  for each row execute function enforce_outfit_status();

-- ---------------------------------------------------------------------------
-- BUOC DUYET LAI KHI SUA NOI DUNG QUAN TRONG
--
-- De bai muc 5: "Neu bai da duyet nhung sua anh, san pham hoac link affiliate
-- thi phai duyet lai."
--
-- Ba nguon thay doi, ba trigger:
--   a) doi hero_image_url tren chinh bang outfits
--   b) them / sua / xoa dong trong outfit_items
--   c) doi url trong affiliate_links dang duoc mot outfit da dang su dung
-- ---------------------------------------------------------------------------

-- (a) Doi anh dai dien
create or replace function outfits_require_rereview()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Admin sua thi khong bat duyet lai, vi chinh admin la nguoi duyet.
  if is_trusted_context() then
    return new;
  end if;

  if old.status in ('published', 'approved')
     and new.status = old.status
     and new.hero_image_url is distinct from old.hero_image_url
  then
    new.status      := 'pending';
    new.submitted_at := now();
    new.review_note := 'Tu dong chuyen ve cho duyet: anh dai dien da thay doi.';
  end if;

  return new;
end;
$$;

create trigger trg_outfits_rereview
  before update on outfits
  for each row execute function outfits_require_rereview();

-- (b) Thay doi danh sach san pham trong set do
create or replace function outfit_items_require_rereview()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target uuid;
begin
  if is_trusted_context() then
    return coalesce(new, old);
  end if;

  target := coalesce(new.outfit_id, old.outfit_id);

  update outfits
     set status       = 'pending',
         submitted_at = now(),
         review_note  = 'Tu dong chuyen ve cho duyet: danh sach san pham da thay doi.'
   where id = target
     and status in ('published', 'approved');

  return coalesce(new, old);
end;
$$;

create trigger trg_outfit_items_rereview
  after insert or update or delete on outfit_items
  for each row execute function outfit_items_require_rereview();

-- (c) Doi link affiliate
create or replace function aff_links_require_rereview()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if is_trusted_context() then
    return new;
  end if;

  if new.url is distinct from old.url then
    -- Moi lan doi link phai resolve lai, khong tin gia tri cu
    new.resolved_url  := null;
    new.resolved_host := null;
    new.resolved_at   := null;

    update outfits o
       set status       = 'pending',
           submitted_at = now(),
           review_note  = 'Tu dong chuyen ve cho duyet: link affiliate da thay doi.'
     where o.status in ('published', 'approved')
       and exists (
         select 1 from outfit_items oi
          where oi.outfit_id = o.id
            and oi.affiliate_link_id = new.id
       );
  end if;

  return new;
end;
$$;

create trigger trg_aff_links_rereview
  before update on affiliate_links
  for each row execute function aff_links_require_rereview();

-- ---------------------------------------------------------------------------
-- TINH LAI TONG GIA CUA SET DO
-- Cache vao outfits.total_price_vnd de loc theo khoang gia khong phai join.
-- ---------------------------------------------------------------------------

create or replace function recalc_outfit_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target uuid;
begin
  target := coalesce(new.outfit_id, old.outfit_id);

  update outfits
     set total_price_vnd = (
       select sum(p.price_vnd)
         from outfit_items oi
         join products p on p.id = oi.product_id
        where oi.outfit_id = target
     )
   where id = target;

  return coalesce(new, old);
end;
$$;

create trigger trg_outfit_items_total
  after insert or update or delete on outfit_items
  for each row execute function recalc_outfit_total();

-- Doi gia san pham thi moi set do chua no phai tinh lai
create or replace function products_price_recalc()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.price_vnd is distinct from old.price_vnd then
    update outfits o
       set total_price_vnd = (
         select sum(p.price_vnd)
           from outfit_items oi
           join products p on p.id = oi.product_id
          where oi.outfit_id = o.id
       )
     where exists (
       select 1 from outfit_items oi
        where oi.outfit_id = o.id and oi.product_id = new.id
     );
  end if;
  return new;
end;
$$;

create trigger trg_products_price_recalc
  after update on products
  for each row execute function products_price_recalc();

-- ---------------------------------------------------------------------------
-- NHAT KY THAO TAC ADMIN
-- Khong cap policy INSERT tren admin_audit_log cho ai. Chi ghi qua ham nay,
-- de log khong the bi lam gia hoac xoa boi client.
-- ---------------------------------------------------------------------------

create or replace function log_admin_action(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid default null,
  p_detail      jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Chi quan tri vien duoc ghi nhat ky';
  end if;

  insert into admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_detail);
end;
$$;

-- Duyet / tu choi / yeu cau sua trong MOT giao dich: doi trang thai, ghi
-- post_reviews, ghi audit log. Tranh truong hop doi trang thai xong nhung
-- quen ghi ly do.
create or replace function review_outfit(
  p_outfit_id uuid,
  p_action    review_action,
  p_reason    text default null
)
returns outfits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result outfits;
begin
  if not is_admin() then
    raise exception 'Chi quan tri vien duoc kiem duyet bai dang';
  end if;

  if p_action = 'request_changes' and coalesce(trim(p_reason), '') = '' then
    raise exception 'Phai nhap ly do khi yeu cau sua bai';
  end if;

  update outfits
     set status = case p_action
                    when 'approve'         then 'published'::outfit_status
                    when 'reject'          then 'rejected'::outfit_status
                    when 'request_changes' then 'needs_revision'::outfit_status
                  end,
         review_note = p_reason,
         reviewed_at = now(),
         published_at = case when p_action = 'approve'
                             then coalesce(published_at, now()) end
   where id = p_outfit_id
  returning * into result;

  if result.id is null then
    raise exception 'Khong tim thay bai dang';
  end if;

  insert into post_reviews (outfit_id, reviewer_id, action, reason)
  values (p_outfit_id, auth.uid(), p_action, p_reason);

  insert into admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'outfit.' || p_action, 'outfit', p_outfit_id,
          jsonb_build_object('reason', p_reason, 'new_status', result.status));

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- DOI QUYEN TAI KHOAN
-- Cot profiles.role da bi REVOKE quyen UPDATE o 0002, nen phai di qua ham nay.
-- Chi admin goi duoc, va khong ai tu ha quyen chinh minh de tranh khoa het
-- admin ra khoi he thong.
-- ---------------------------------------------------------------------------

create or replace function set_user_role(p_user_id uuid, p_role user_role)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Chi quan tri vien duoc doi quyen tai khoan';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Khong the tu ha quyen chinh minh';
  end if;

  update profiles set role = p_role where id = p_user_id;

  insert into admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'user.set_role', 'profile', p_user_id,
          jsonb_build_object('new_role', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- KIEM TRA LINK AFFILIATE CHI THUOC SHOPEE HOAC TIKTOK (muc 9 cua de bai)
--
-- Dat o tang database chu khong chi o frontend: nguoi dung co the goi thang
-- REST API cua Supabase, bo qua toan bo giao dien.
--
-- Hai muc kiem tra:
--   1) Ten mien cua url phai nam trong danh sach cho phep.
--   2) Neu da resolve link rut gon thi resolved_host cung phai nam trong danh
--      sach, VA khong duoc la mot ten mien rut gon nua. Day la cho chan
--      open redirect: shp.ee co the tro di bat ky dau, nen kiem tra chuoi
--      nguoi dung nhap vao la KHONG du.
-- ---------------------------------------------------------------------------

-- Lay ten mien tu url, da bo www.
create or replace function url_host(p_url text)
returns text
language plpgsql
immutable
as $$
declare h text;
begin
  if p_url is null then return null; end if;
  h := lower(trim(p_url));
  -- Bo giao thuc
  h := regexp_replace(h, '^[a-z][a-z0-9+.-]*://', '');
  -- Bo thong tin dang nhap dang user:pass@host (mot ky thuat che ten mien)
  h := regexp_replace(h, '^[^/@]*@', '');
  -- Chi giu phan truoc dau /, ? hoac #
  h := split_part(split_part(split_part(h, '/', 1), '?', 1), '#', 1);
  -- Bo so cong
  h := split_part(h, ':', 1);
  h := regexp_replace(h, '^www\.', '');
  if h = '' then return null; end if;
  return h;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ten mien duoc phep, khop theo TEN MIEN GOC
--
-- VI SAO KHOP THEO TEN MIEN GOC, KHONG PHAI DANH SACH CUNG
--   Ban dau day la danh sach cung liet ke tung ten mien. Nhung link that cua
--   nguoi dung dung `vn.shp.ee` — khong co trong danh sach do, nen he thong tu
--   choi chinh link that. Shopee con nhieu bien the theo quoc gia
--   (th.shp.ee, id.shp.ee, ...) va co the them bat cu luc nao.
--
--   Khop theo ten mien goc bao het cac bien the do ma van an toan: chi Shopee
--   moi tao duoc ten mien con cua shp.ee.
--
-- CHU Y DAU CHAM trong '%.' || d — bo no di thi "evil-shp.ee" se duoc coi la
-- thuoc "shp.ee". Trong LIKE, dau cham la ky tu thuong, khong phai ky tu dac
-- biet, nen '%.shp.ee' bat buoc phai co dau cham ngay truoc shp.ee.
-- ---------------------------------------------------------------------------

create or replace function is_under_domain(p_host text, p_domain text)
returns boolean
language sql
immutable
as $$
  select p_host = p_domain or p_host like ('%.' || p_domain);
$$;

create or replace function is_allowed_affiliate_host(p_host text)
returns boolean
language sql
immutable
as $$
  select p_host is not null and exists (
    select 1
      from unnest(array['shopee.vn', 'shp.ee', 'shope.ee', 'tiktok.com']) as d
     where is_under_domain(p_host, d)
  );
$$;

-- Ten mien rut gon: chap nhan luc nhap, nhung PHAI resolve truoc khi dang bai.
create or replace function is_shortener_host(p_host text)
returns boolean
language sql
immutable
as $$
  select p_host is not null and (
    -- Ten mien cu the
    p_host in ('s.shopee.vn', 'vt.tiktok.com', 'vm.tiktok.com')
    -- Moi ten mien con cua hai ten mien nay deu la link rut gon
    or exists (
      select 1 from unnest(array['shp.ee', 'shope.ee']) as d
       where is_under_domain(p_host, d)
    )
  );
$$;

create or replace function validate_affiliate_link()
returns trigger
language plpgsql
as $$
declare h text; rh text;
begin
  h := url_host(new.url);

  if h is null then
    raise exception 'Link khong hop le: %', new.url;
  end if;

  if not is_allowed_affiliate_host(h) then
    raise exception
      'Chi nhan link Shopee hoac TikTok. Ten mien "%" khong duoc phep.', h;
  end if;

  -- Ten mien phai khop voi nen tang da chon.
  -- Dung is_under_domain thay vi LIKE '%shopee%': chuoi con se cho qua ca
  -- "shopee.evil.com", con is_under_domain thi khong.
  if new.platform = 'shopee'
     and not (is_under_domain(h, 'shopee.vn')
              or is_under_domain(h, 'shp.ee')
              or is_under_domain(h, 'shope.ee')) then
    raise exception 'Link "%" khong phai cua Shopee.', h;
  end if;

  if new.platform = 'tiktok' and not is_under_domain(h, 'tiktok.com') then
    raise exception 'Link "%" khong phai cua TikTok.', h;
  end if;

  -- Neu da resolve thi ket qua cuoi cung cung phai sach.
  -- Day moi la cho chong open redirect thuc su.
  if new.resolved_url is not null then
    rh := url_host(new.resolved_url);
    new.resolved_host := rh;

    if rh is null or not is_allowed_affiliate_host(rh) then
      raise exception
        'Link rut gon chuyen huong ra ngoai Shopee/TikTok (den "%"). Tu choi.', rh;
    end if;
    if is_shortener_host(rh) then
      raise exception
        'Link van con la link rut gon sau khi chuyen huong ("%"). Can resolve tiep.', rh;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_aff_links_validate
  before insert or update of url, resolved_url, platform on affiliate_links
  for each row execute function validate_affiliate_link();

-- ---------------------------------------------------------------------------
-- DEM LUOT XEM
-- Cot view_count da bi REVOKE quyen UPDATE, nen phai di qua ham nay.
-- ---------------------------------------------------------------------------

create or replace function increment_outfit_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update outfits
     set view_count = view_count + 1
   where slug = p_slug and status = 'published';
end;
$$;

-- ---------------------------------------------------------------------------
-- XOA DU LIEU CA NHAN THEO YEU CAU (Nghi dinh 13/2023)
-- Nguoi dung tu goi duoc. Xoa du lieu ca nhan nhung GIU LAI bai da dang
-- duoi dang khuyet danh, de khong lam vo cac set do dang cong khai.
-- ---------------------------------------------------------------------------

create or replace function erase_my_personal_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Chua dang nhap';
  end if;

  delete from user_private     where user_id = uid;
  delete from user_preferences where user_id = uid;
  delete from feedback_events  where user_id = uid;
  delete from ai_credentials   where owner_id = uid;

  update click_events set user_id = null where user_id = uid;

  update profiles
     set display_name = 'Nguoi dung da xoa',
         avatar_url = null,
         bio = null
   where id = uid;

  insert into data_requests (user_id, kind, note, status)
  values (uid, 'delete', 'Nguoi dung tu thuc hien xoa du lieu ca nhan', 'done');
end;
$$;

-- ---------------------------------------------------------------------------
-- CAP QUYEN GOI HAM
-- ---------------------------------------------------------------------------

grant execute on function increment_outfit_view(text)   to anon, authenticated;
grant execute on function review_outfit(uuid, review_action, text) to authenticated;
grant execute on function log_admin_action(text, text, uuid, jsonb) to authenticated;
grant execute on function erase_my_personal_data()      to authenticated;
grant execute on function is_admin()                    to anon, authenticated;
grant execute on function is_trusted_context()           to anon, authenticated;
grant execute on function set_user_role(uuid, user_role) to authenticated;
grant execute on function url_host(text)                 to anon, authenticated;
grant execute on function is_allowed_affiliate_host(text) to anon, authenticated;
grant execute on function is_shortener_host(text)        to anon, authenticated;
grant execute on function is_under_domain(text, text)    to anon, authenticated;
