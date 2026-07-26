-- ============================================================================
-- PHOI — 0002_rls.sql
-- Row Level Security. Day la lop phan quyen THAT cua he thong.
--
-- Nguyen tac: ngay ca khi frontend co bug hoac bi thay doi, database van tu
-- choi. Khong dua vao code ung dung de bao ve du lieu.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HAM TRO GIUP
-- SECURITY DEFINER de bo qua RLS cua chinh bang profiles, tranh de quy vo han.
-- set search_path de chong tan cong doi search_path.
-- ---------------------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Dang chay trong context TIN CAY hay khong.
--
-- auth.uid() tra ve null co nghia la khong co phien nguoi dung nao: dang chay
-- bang service_role (Local Helper), bang postgres (SQL editor, migration),
-- hoac tu Edge Function. Nhung context nay da bo qua RLS hoan toan, nen cac
-- trigger nghiep vu cung phai nhuong duong — neu khong thi migration va seed
-- se bi chinh trigger cua minh chan lai.
--
-- Khach chua dang nhap cung co auth.uid() = null, nhung ho khong co policy
-- UPDATE nao tren outfits/profiles ca (moi policy ghi deu "to authenticated"),
-- nen khong bao gio cham duoc tori cac trigger dung ham nay.
create or replace function is_trusted_context()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is null or is_admin();
$$;

-- Outfit nay co dang hien cho cong chung khong
create or replace function outfit_is_visible(p_outfit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from outfits o
    where o.id = p_outfit_id
      and (o.status = 'published' or o.author_id = auth.uid() or is_admin())
  );
$$;

-- Toi co quyen sua outfit nay khong
create or replace function outfit_is_mine(p_outfit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from outfits o
    where o.id = p_outfit_id
      and (o.author_id = auth.uid() or is_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- BAT RLS TREN TOAN BO BANG
-- ---------------------------------------------------------------------------

alter table profiles         enable row level security;
alter table user_private     enable row level security;
alter table styles           enable row level security;
alter table colors           enable row level security;
alter table occasions        enable row level security;
alter table products         enable row level security;
alter table affiliate_links  enable row level security;
alter table outfits          enable row level security;
alter table outfit_items     enable row level security;
alter table user_preferences enable row level security;
alter table feedback_events  enable row level security;
alter table click_events     enable row level security;
alter table post_reviews     enable row level security;
alter table fetch_jobs       enable row level security;
alter table ai_jobs          enable row level security;
alter table ai_credentials   enable row level security;
alter table admin_audit_log  enable row level security;
alter table data_requests    enable row level security;

-- ---------------------------------------------------------------------------
-- PROFILES — phan cong khai, ai cung doc duoc
-- Viec chan tu nang quyen len admin do trigger o 0003 lo, khong phai RLS,
-- vi RLS khong kiem soat duoc tung cot.
-- ---------------------------------------------------------------------------

create policy profiles_select_all on profiles
  for select using (true);

create policy profiles_insert_self on profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- USER_PRIVATE — ngay sinh va nien menh
-- CHI chu so huu. Admin CO Y khong duoc doc: admin khong can ngay sinh de
-- lam viec gi ca, nen khong cap quyen.
-- ---------------------------------------------------------------------------

create policy user_private_all_self on user_private
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- TU VUNG — doc cong khai, chi admin sua
-- ---------------------------------------------------------------------------

create policy styles_select_all on styles for select using (true);
create policy styles_write_admin on styles for all to authenticated
  using (is_admin()) with check (is_admin());

create policy colors_select_all on colors for select using (true);
create policy colors_write_admin on colors for all to authenticated
  using (is_admin()) with check (is_admin());

create policy occasions_select_all on occasions for select using (true);
create policy occasions_write_admin on occasions for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- PRODUCTS
-- Doc cong khai co y: day la thong tin san pham cong khai tren san thuong mai
-- dien tu (ten, gia, anh), khong phai du lieu ca nhan. Trang kham pha can
-- join products qua outfit_items nen dong quyen doc o day se lam moi truy van
-- phai chay subquery ton kem ma khong bao ve them duoc gi.
-- ---------------------------------------------------------------------------

create policy products_select_all on products
  for select using (true);

create policy products_insert_own on products
  for insert to authenticated with check (created_by = auth.uid());

create policy products_update_own on products
  for update to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

create policy products_delete_own on products
  for delete to authenticated
  using (created_by = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- AFFILIATE_LINKS
-- Doc cong khai vi link sinh ra la de nguoi xem bam vao.
-- Chi chu so huu duoc sua — day la dam bao "nguoi dang huong toan bo hoa hong
-- tu link cua ho": khong ai doi duoc link cua nguoi khac thanh link cua minh.
-- ---------------------------------------------------------------------------

create policy aff_links_select_all on affiliate_links
  for select using (true);

create policy aff_links_insert_own on affiliate_links
  for insert to authenticated with check (owner_id = auth.uid());

create policy aff_links_update_own on affiliate_links
  for update to authenticated
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

create policy aff_links_delete_own on affiliate_links
  for delete to authenticated
  using (owner_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- OUTFITS
-- Nguoi xem chi thay bai da 'published'. Tac gia thay bai cua minh o moi
-- trang thai. Admin thay tat ca.
-- Tac gia KHONG the tu dat status = 'published' — trigger o 0003 chan viec do.
-- ---------------------------------------------------------------------------

create policy outfits_select_visible on outfits
  for select using (
    status = 'published' or author_id = auth.uid() or is_admin()
  );

create policy outfits_insert_own on outfits
  for insert to authenticated
  with check (author_id = auth.uid() and status in ('draft', 'pending'));

create policy outfits_update_own on outfits
  for update to authenticated
  using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());

create policy outfits_delete_own on outfits
  for delete to authenticated
  using ((author_id = auth.uid() and status = 'draft') or is_admin());

-- ---------------------------------------------------------------------------
-- OUTFIT_ITEMS — theo quyen cua outfit cha
-- ---------------------------------------------------------------------------

create policy outfit_items_select_visible on outfit_items
  for select using (outfit_is_visible(outfit_id));

create policy outfit_items_write_own on outfit_items
  for all to authenticated
  using (outfit_is_mine(outfit_id))
  with check (outfit_is_mine(outfit_id));

-- ---------------------------------------------------------------------------
-- USER_PREFERENCES — chi chu so huu
-- ---------------------------------------------------------------------------

create policy prefs_all_self on user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- FEEDBACK_EVENTS
-- Nguoi dung ghi va doc phan hoi cua chinh minh. Admin doc tat ca de xem
-- outfit nao bi an nhieu.
-- ---------------------------------------------------------------------------

create policy feedback_insert_own on feedback_events
  for insert to authenticated with check (user_id = auth.uid());

create policy feedback_select_own on feedback_events
  for select to authenticated using (user_id = auth.uid() or is_admin());

create policy feedback_delete_own on feedback_events
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- CLICK_EVENTS
-- Khach chua dang nhap cung phai ghi duoc, neu khong thi mat phan lon du lieu.
-- Khong ai doc duoc ngoai admin. Chong spam bang rate limit o tang Edge
-- Function, khong phai o RLS.
-- ---------------------------------------------------------------------------

create policy click_insert_anyone on click_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create policy click_select_admin on click_events
  for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- POST_REVIEWS — tac gia doc duoc nhan xet ve bai cua minh, chi admin ghi
-- ---------------------------------------------------------------------------

create policy reviews_select_related on post_reviews
  for select to authenticated using (outfit_is_mine(outfit_id) or is_admin());

create policy reviews_insert_admin on post_reviews
  for insert to authenticated with check (is_admin());

-- ---------------------------------------------------------------------------
-- FETCH_JOBS / AI_JOBS
-- Nguoi dung chi thay job cua minh. Local Helper dung service role nen bo qua
-- RLS hoan toan — key do chi nam tren may ca nhan, khong bao gio len cloud.
-- ---------------------------------------------------------------------------

create policy fetch_jobs_all_own on fetch_jobs
  for all to authenticated
  using (requested_by = auth.uid() or is_admin())
  with check (requested_by = auth.uid() or is_admin());

create policy ai_jobs_all_own on ai_jobs
  for all to authenticated
  using (requested_by = auth.uid() or is_admin())
  with check (requested_by = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- AI_CREDENTIALS — API key cua chinh nguoi dung
-- RLS cho chu so huu thao tac tren dong cua minh, NHUNG cot encrypted_key
-- bi thu hoi quyen doc o duoi. Nguoi dung nhap key vao roi khong bao gio
-- doc lai duoc; giao dien chi hien key_hint.
-- ---------------------------------------------------------------------------

create policy ai_cred_all_self on ai_credentials
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ADMIN_AUDIT_LOG — chi admin doc. Ghi qua ham SECURITY DEFINER o 0003,
-- khong cap policy INSERT cho ai de log khong the bi lam gia.
-- ---------------------------------------------------------------------------

create policy audit_select_admin on admin_audit_log
  for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- DATA_REQUESTS — yeu cau xuat / xoa / sua du lieu ca nhan
-- ---------------------------------------------------------------------------

create policy data_req_insert_own on data_requests
  for insert to authenticated with check (user_id = auth.uid());

create policy data_req_select_own on data_requests
  for select to authenticated using (user_id = auth.uid() or is_admin());

create policy data_req_update_admin on data_requests
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- QUYEN O CAP COT
--
-- RLS chi loc duoc DONG, khong loc duoc COT. Muon chan mot cot phai dung
-- GRANT/REVOKE.
--
-- CAI BAY: "revoke select (mot_cot) on bang from role" KHONG co tac dung neu
-- role da co GRANT SELECT o cap BANG. Postgres khong tru bot mot cot ra khoi
-- quyen cap bang. Bat buoc phai:
--     1) revoke select tren CA BANG
--     2) grant select tren DANH SACH COT duoc phep
-- Neu chi lam buoc 1 kieu cap cot thi API key van doc duoc qua REST API.
-- ---------------------------------------------------------------------------

-- AI_CREDENTIALS — encrypted_key khong bao gio ra khoi database.
-- Nguoi dung gui key tho cho Edge Function; ham do ma hoa va ghi bang
-- service role. Client chi duoc: doc phan khong bi mat, bat/tat, va xoa.
revoke select, insert, update, delete on ai_credentials from anon, authenticated;
grant select (id, owner_id, provider, key_hint, is_active, last_used_at, created_at)
  on ai_credentials to authenticated;
grant update (is_active) on ai_credentials to authenticated;
grant delete on ai_credentials to authenticated;

-- OUTFITS — danh sach cot tac gia duoc sua.
-- Cac cot con lai (view_count, published_at, submitted_at, reviewed_at,
-- review_note, total_price_vnd, is_seed, author_id) chi trigger va ham
-- SECURITY DEFINER duoc dat. Trigger gan NEW.cot khong can quyen cua nguoi
-- goi, nen viec siet o day khong lam vo may trang thai kiem duyet.
revoke update on outfits from anon, authenticated;
grant update (
  title, description, hero_image_url,
  style_slug, occasion_slug, color_slugs,
  status, slug, ai_generated, ai_provider
) on outfits to authenticated;

-- PROFILES — chan doi role o cap quyen, khong chi dua vao trigger.
-- Hai lop chan doc lap cho cung mot lo hong nang quyen.
revoke update on profiles from anon, authenticated;
grant update (display_name, avatar_url, bio) on profiles to authenticated;

-- ---------------------------------------------------------------------------
-- CHAN TRUY CAP TRUC TIEP VAO CAC BANG KHONG CAN THIET CHO KHACH
-- ---------------------------------------------------------------------------

revoke all on admin_audit_log from anon;
revoke all on ai_credentials  from anon;
revoke all on user_private    from anon;
revoke all on fetch_jobs      from anon;
revoke all on ai_jobs         from anon;
revoke all on data_requests   from anon;
