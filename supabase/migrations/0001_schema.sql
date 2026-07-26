-- ============================================================================
-- PHOI — 0001_schema.sql
-- Bang, enum, index. Chua co RLS (xem 0002), chua co trigger (xem 0003).
--
-- Nguyen tac thiet ke:
--   1. Ngay sinh KHONG nam trong bang cong khai. Tach han sang user_private.
--   2. Tu vung (phong cach / mau / dip) la bang tra, khong nhap tu do.
--   3. affiliate_links tach khoi products: nhieu nguoi cung ban 1 san pham
--      voi link rieng cua ho, moi nguoi huong hoa hong cua minh.
--   4. Moi bang nghiep vu deu co is_seed de phan biet du lieu mau voi that.
-- ============================================================================

-- Khong can extension nao ca:
--   gen_random_uuid() da nam trong Postgres core tu v13.
--   Bo dau tieng Viet dung translate() trong slugify_vi(), khong dung unaccent.
-- Nho vay migration chay duoc o bat ky Postgres >= 13, khong chi rieng Supabase.

-- ---------------------------------------------------------------------------
-- ENUM
-- ---------------------------------------------------------------------------

create type user_role as enum ('user', 'admin');

create type platform as enum ('shopee', 'tiktok');

-- Danh muc san pham, phu dung pham vi o muc 2 cua de bai
create type product_category as enum (
  'ao', 'quan', 'giay', 'tui', 'dong_ho', 'kinh', 'mu', 'phu_kien'
);

-- Vai tro cua san pham trong mot set do
create type item_role as enum (
  'top', 'outerwear', 'bottom', 'shoes', 'bag', 'watch', 'glasses', 'hat', 'accessory'
);

-- May trang thai kiem duyet (muc 5 cua de bai)
create type outfit_status as enum (
  'draft', 'pending', 'needs_revision', 'approved', 'rejected', 'published', 'hidden'
);

-- Nguu hanh nap am
create type ngu_hanh as enum ('kim', 'moc', 'thuy', 'hoa', 'tho');

create type feedback_kind as enum (
  'dislike_color', 'dislike_style', 'dislike_pairing', 'hide_outfit'
);

create type job_status as enum ('pending', 'claimed', 'done', 'failed', 'cancelled');

create type review_action as enum ('approve', 'reject', 'request_changes');

create type ai_provider as enum ('gemini', 'openai', 'local_comfyui');

-- ---------------------------------------------------------------------------
-- NGUOI DUNG
-- ---------------------------------------------------------------------------

-- Phan CONG KHAI cua ho so. Bat ky ai cung doc duoc.
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Thanh vien',
  avatar_url   text,
  role         user_role not null default 'user',
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Phan RIENG TU. Chi chu so huu doc duoc. Admin cung KHONG doc duoc.
-- Ngay sinh va nien menh nam o day, khong bao gio ra ngoai.
create table user_private (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  birth_date      date,
  lunar_year      integer,          -- nam am lich suy ra tu birth_date
  can_chi         text,             -- vi du 'Giap Tu'
  element         ngu_hanh,         -- nien menh nap am
  element_label   text,             -- vi du 'Hai Trung Kim'
  element_enabled boolean not null default true,  -- nguoi dung tat goi y theo menh
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TU VUNG CHUAN HOA
-- De o dang bang tra thay vi text tu do. Neu de nhap tay, sau 200 bai se co
-- 'streetwear' / 'Street wear' / 'duong pho' la ba gia tri khac nhau va bo loc
-- tro nen vo dung.
-- ---------------------------------------------------------------------------

create table styles (
  slug        text primary key,
  label       text not null,
  description text,
  sort_order  integer not null default 0
);

create table colors (
  slug        text primary key,
  label       text not null,
  hex         text not null,
  -- Mau nay thuoc hanh nao trong ngu hanh. Dung cho goi y theo menh.
  element     ngu_hanh,
  sort_order  integer not null default 0
);

create table occasions (
  slug        text primary key,
  label       text not null,
  description text,
  sort_order  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- SAN PHAM
-- ---------------------------------------------------------------------------

create table products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         product_category not null,
  color_slug       text references colors(slug) on delete set null,
  price_vnd        integer,          -- nullable: co the chua biet gia
  -- Vi khong co API, gia se cu di rat nhanh. Luon hien thi kem moc thoi gian.
  price_checked_at timestamptz,
  image_url        text,             -- da tai ve storage cua minh, KHONG hotlink
  source_platform  platform,
  source_url       text,             -- link goc de doi chieu, khong phai link affiliate
  description      text,
  -- Du lieu tho lay tu the Open Graph, giu lai de doi chieu khi can
  fetched_meta     jsonb,
  created_by       uuid references auth.users(id) on delete set null,
  is_seed          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Nhieu nguoi co the gan link rieng cho cung mot san pham.
-- Nguoi dang huong toan bo hoa hong tu link cua ho.
create table affiliate_links (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  owner_id   uuid references auth.users(id) on delete cascade,
  platform   platform not null,
  url        text not null,
  -- Ket qua resolve link rut gon o phia server. Chong open redirect:
  -- kiem tra ten mien CUOI CUNG sau khi chuyen huong, khong phai chuoi nhap vao.
  resolved_url    text,
  resolved_host   text,
  resolved_at     timestamptz,
  -- Job kiem tra link chet hang tuan cap nhat hai cot nay
  last_checked_at timestamptz,
  is_alive        boolean,
  is_active       boolean not null default true,
  is_seed         boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- OUTFIT
-- ---------------------------------------------------------------------------

create table outfits (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  description    text,
  hero_image_url text,
  style_slug     text references styles(slug) on delete set null,
  occasion_slug  text references occasions(slug) on delete set null,
  -- Mau chu dao cua set do. Dung cho bo loc va cho cham diem theo menh.
  color_slugs    text[] not null default '{}',
  -- Tong gia tam tinh, cache lai de loc theo khoang gia khong phai join
  total_price_vnd integer,
  status         outfit_status not null default 'draft',
  author_id      uuid references auth.users(id) on delete set null,
  -- Bat buoc gan nhan neu anh do AI tao (muc 7 cua de bai)
  ai_generated   boolean not null default false,
  ai_provider    ai_provider,
  is_seed        boolean not null default false,
  -- Ly do admin yeu cau sua, hien cho tac gia thay
  review_note    text,
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  published_at   timestamptz,
  view_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table outfit_items (
  id                uuid primary key default gen_random_uuid(),
  outfit_id         uuid not null references outfits(id) on delete cascade,
  product_id        uuid not null references products(id) on delete restrict,
  -- Link affiliate cu the dung cho san pham nay trong set do nay.
  -- Cho phep null: san pham co the chua co link.
  affiliate_link_id uuid references affiliate_links(id) on delete set null,
  role              item_role not null,
  position          integer not null default 0,
  note              text,
  created_at        timestamptz not null default now(),
  unique (outfit_id, position)
);

-- ---------------------------------------------------------------------------
-- CA NHAN HOA
-- ---------------------------------------------------------------------------

create table user_preferences (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  style_slugs   text[] not null default '{}',
  color_slugs   text[] not null default '{}',
  price_min_vnd integer not null default 150000,
  price_max_vnd integer not null default 700000,
  onboarded_at  timestamptz,
  updated_at    timestamptz not null default now()
);

-- Bon nut phan hoi o muc 3 cua de bai.
-- target_value giu gia tri cu the: slug mau khi dislike_color,
-- slug phong cach khi dislike_style, null khi dislike_pairing / hide_outfit.
create table feedback_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  outfit_id    uuid references outfits(id) on delete cascade,
  kind         feedback_kind not null,
  target_value text,
  created_at   timestamptz not null default now()
);

-- Do luong click. De bai noi giai doan dau chua can thong ke, nhung du lieu
-- qua khu khong the tao nguoc lai duoc — nen van ghi, chi khong lam dashboard.
create table click_events (
  id                uuid primary key default gen_random_uuid(),
  outfit_id         uuid references outfits(id) on delete set null,
  product_id        uuid references products(id) on delete set null,
  affiliate_link_id uuid references affiliate_links(id) on delete set null,
  user_id           uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- KIEM DUYET
-- ---------------------------------------------------------------------------

create table post_reviews (
  id          uuid primary key default gen_random_uuid(),
  outfit_id   uuid not null references outfits(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  action      review_action not null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- HANG DOI VIEC CHO LOCAL HELPER
-- Website chi GHI vao bang nay. May ca nhan tu HOI va tu quyet dinh lam.
-- Website khong bao gio goi duoc vao may ca nhan.
-- ---------------------------------------------------------------------------

create table fetch_jobs (
  id            uuid primary key default gen_random_uuid(),
  requested_by  uuid not null references auth.users(id) on delete cascade,
  source_url    text not null,
  status        job_status not null default 'pending',
  -- Bac nao xu ly duoc: 1 = edge function tren cloud, 2 = local helper
  tier          smallint,
  result        jsonb,       -- { name, price_vnd, image_url, platform, ... }
  error         text,
  attempts      smallint not null default 0,
  claimed_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table ai_jobs (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  outfit_id    uuid references outfits(id) on delete set null,
  provider     ai_provider not null,
  prompt       text not null,
  params       jsonb not null default '{}',
  status       job_status not null default 'pending',
  result_urls  text[] not null default '{}',
  error        text,
  claimed_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- API key cua chinh nguoi dung (BYOK).
-- encrypted_key duoc ma hoa truoc khi luu va bi REVOKE quyen doc o cot
-- (xem 0002). Chi Edge Function voi service role moi giai ma duoc.
create table ai_credentials (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  provider      ai_provider not null,
  encrypted_key text not null,
  key_hint      text not null,   -- vi du 'AIza...9f2c', chi de nhan dien
  is_active     boolean not null default true,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (owner_id, provider)
);

-- ---------------------------------------------------------------------------
-- NHAT KY THAO TAC ADMIN (muc 9 cua de bai)
-- ---------------------------------------------------------------------------

create table admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,          -- 'outfit.publish', 'user.suspend', ...
  entity_type text not null,
  entity_id   uuid,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Yeu cau xoa / sua du lieu ca nhan (Nghi dinh 13/2023)
create table data_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('export', 'delete', 'correct')),
  note         text,
  status       text not null default 'open' check (status in ('open', 'done', 'rejected')),
  handled_by   uuid references auth.users(id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INDEX
-- ---------------------------------------------------------------------------

create index idx_outfits_status_published  on outfits (status, published_at desc);
create index idx_outfits_author            on outfits (author_id);
create index idx_outfits_style             on outfits (style_slug);
create index idx_outfits_occasion          on outfits (occasion_slug);
create index idx_outfits_price             on outfits (total_price_vnd);
create index idx_outfits_colors            on outfits using gin (color_slugs);

create index idx_outfit_items_outfit       on outfit_items (outfit_id, position);
create index idx_outfit_items_product      on outfit_items (product_id);

create index idx_products_category         on products (category);
create index idx_products_color            on products (color_slug);
create index idx_products_created_by       on products (created_by);

create index idx_aff_links_product         on affiliate_links (product_id);
create index idx_aff_links_owner           on affiliate_links (owner_id);
create index idx_aff_links_health          on affiliate_links (is_alive, last_checked_at);

create index idx_feedback_user             on feedback_events (user_id, created_at desc);
create index idx_feedback_user_kind        on feedback_events (user_id, kind);
create index idx_click_outfit              on click_events (outfit_id, created_at desc);

create index idx_fetch_jobs_pending        on fetch_jobs (status, created_at) where status = 'pending';
create index idx_ai_jobs_pending           on ai_jobs (status, created_at) where status = 'pending';

create index idx_audit_created             on admin_audit_log (created_at desc);
