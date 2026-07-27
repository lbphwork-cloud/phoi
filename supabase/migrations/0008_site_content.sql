-- =============================================================================
-- Noi dung sua duoc tu trang quan tri
--
-- MUC DICH
--   Moi doan chu va moi anh co dinh tren website deu nam o day, de doi ma khong
--   phai sua ma nguon va khong phai deploy lai.
--
-- CACH TRANG DOC
--   Trang lay ca bang nay mot lan roi tra theo khoa. Neu thieu khoa, hoac
--   database khong goi duoc, trang dung gia tri mac dinh viet san trong ma
--   nguon. Nghia la website KHONG BAO GIO trang tron vi loi noi dung — day la
--   ly do ham t() luon nhan mot gia tri du phong.
--
-- VI SAO CHI SUA DUOC COT `value`
--   Quyen cap cot chi mo `value` cho nguoi dung dang nhap. Cac cot `key`,
--   `kind`, `page` la cau truc — chung phai khop voi ma nguon, nen chi doi
--   duoc bang migration. Neu mo ca bang thi mot lan bam nham trong giao dien
--   quan tri co the doi `key` va lam mot chuong tren trang bien mat, rat kho
--   truy nguyen.
--
-- `kind` DE LAM GI
--   Giao dien quan tri doc cot nay de biet ve o nhap kieu gi: mot dong, nhieu
--   dong, o tai anh len, hay o dia chi. Khong co no thi phai viet cung danh
--   sach trong ma nguon, va them mot khoa moi lai phai sua ma.
-- =============================================================================

create table site_content (
  key        text primary key,
  page       text not null,             -- gom nhom trong giao dien quan tri
  label      text not null,             -- ten hien cho nguoi dung, tieng Viet
  hint       text not null default '',  -- cau giai thich ngan duoi o nhap
  kind       text not null default 'text'
             check (kind in ('text', 'textarea', 'image', 'url', 'list')),
  value      text not null default '',
  sort_order int  not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index site_content_page_idx on site_content (page, sort_order);

alter table site_content enable row level security;

-- Ai cung doc duoc: day la noi dung cong khai cua trang.
create policy site_content_select_all on site_content
  for select using (true);

-- Chi quan tri vien duoc sua.
create policy site_content_update_admin on site_content
  for update using (is_admin()) with check (is_admin());

-- Chi mo quyen ghi cot `value`. Xem ly do o dau file.
revoke update on site_content from anon, authenticated;
grant update (value) on site_content to authenticated;

-- Ghi lai ai sua va sua luc nao.
create or replace function touch_site_content()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger trg_site_content_touch
  before update on site_content
  for each row execute function touch_site_content();

-- ---------------------------------------------------------------------------
-- Gia tri ban dau
--
-- Dat DUNG BANG chu dang hien tren trang, de bat bang bang nay khong lam giao
-- dien doi gi ca. Nguoi dung sua dan sau.
-- ---------------------------------------------------------------------------

insert into site_content (key, page, label, hint, kind, value, sort_order) values

-- === Chung: ten trang, chan trang ==========================================
('site.name', 'chung', 'Tên website', 'Hiện ở đầu trang và trong tiêu đề tab', 'text',
 'PHỐI', 10),
('site.tagline', 'chung', 'Câu định vị', 'Câu ngắn mô tả website', 'text',
 'Phối đồ nam theo gu và theo mệnh', 20),
('footer.about', 'chung', 'Giới thiệu ở chân trang', '', 'textarea',
 'PHỐI gợi ý cách phối đồ nam cho thị trường Việt Nam. Chúng tôi không bán hàng và không giữ tiền của bạn.', 30),
('footer.affiliate', 'chung', 'Công bố liên kết tiếp thị', 'Bắt buộc phải có theo quy định quảng cáo', 'textarea',
 'Một số đường dẫn trên trang là liên kết tiếp thị. Khi bạn mua qua đó, người đăng bài có thể nhận hoa hồng từ sàn. Giá bạn trả không thay đổi.', 40),

-- === Trang chu: phan mo dau ================================================
('home.hero.eyebrow', 'trang-chu', 'Dòng chữ nhỏ phía trên tiêu đề', '', 'text',
 'Phối đồ nam · Việt Nam', 100),
('home.hero.title', 'trang-chu', 'Tiêu đề lớn', 'Xuống dòng bằng cách bấm Enter', 'textarea',
 E'Mặc gì hôm nay,\nđã có người phối sẵn.', 110),
('home.hero.subtitle', 'trang-chu', 'Đoạn mô tả dưới tiêu đề', '', 'textarea',
 'Những set đồ hoàn chỉnh trong khoảng 150.000 – 700.000đ mỗi món. Chọn gu của bạn, hệ thống xếp lại thứ tự cho riêng bạn.', 120),
('home.hero.cta_label', 'trang-chu', 'Chữ trên nút chính', '', 'text',
 'Xem tất cả outfit', 130),
('home.hero.cta_href', 'trang-chu', 'Đường dẫn của nút chính', '', 'url',
 '/kham-pha', 140),
('home.hero.image', 'trang-chu', 'Ảnh nền phần mở đầu', 'Ảnh ngang, khuyên dùng tỷ lệ 21:9', 'image',
 '', 150),

-- === Trang chu: cac khoi phong cach ========================================
('home.styles.eyebrow', 'trang-chu', 'Chữ nhỏ trên phần phong cách', '', 'text',
 'Theo phong cách', 200),
('home.styles.list', 'trang-chu', 'Các phong cách hiện ở trang chủ',
 'Mã phong cách, cách nhau bằng dấu phẩy. Bỏ bớt hoặc đổi thứ tự tuỳ ý.', 'list',
 'toi-gian, streetwear, smart-casual, co-dien, thanh-lich', 210),

-- === Trang chu: ba buoc ====================================================
('home.steps.heading', 'trang-chu', 'Tiêu đề phần ba bước', '', 'text',
 'Cách hoạt động', 300),
('home.step1.title', 'trang-chu', 'Bước 1 — tiêu đề', '', 'text', 'Chọn gu', 310),
('home.step1.desc', 'trang-chu', 'Bước 1 — mô tả', '', 'textarea',
 'Phong cách, màu, khoảng giá. Thêm ngày sinh nếu muốn gợi ý theo mệnh — không bắt buộc, và tắt được bất cứ lúc nào.', 320),
('home.step2.title', 'trang-chu', 'Bước 2 — tiêu đề', '', 'text', 'Xem và phản hồi', 330),
('home.step2.desc', 'trang-chu', 'Bước 2 — mô tả', '', 'textarea',
 'Bốn nút: không thích màu, không thích phong cách, không thích cách phối, ẩn outfit. Mỗi lần bấm là thứ tự gợi ý đổi theo.', 340),
('home.step3.title', 'trang-chu', 'Bước 3 — tiêu đề', '', 'text', 'Mua trên sàn', 350),
('home.step3.desc', 'trang-chu', 'Bước 3 — mô tả', '', 'textarea',
 'Bấm vào món bạn muốn để sang Shopee hoặc TikTok Shop. PHỐI không bán hàng và không giữ tiền của bạn.', 360),

-- === Trang kham pha ========================================================
('discover.title', 'kham-pha', 'Tiêu đề trang', '', 'text', 'Khám phá', 400),
('discover.subtitle', 'kham-pha', 'Mô tả dưới tiêu đề', '', 'textarea',
 'Lọc theo phong cách, dịp, màu và khoảng giá. Gu của bạn luôn được ưu tiên hơn gợi ý theo mệnh.', 410),

-- === Trang ho so ===========================================================
('profile.title', 'ho-so', 'Tiêu đề trang', '', 'text', 'Hồ sơ', 500),
('profile.subtitle', 'ho-so', 'Mô tả dưới tiêu đề', '', 'textarea',
 'Chọn gu của bạn. Mọi thiết lập ở đây chỉ ảnh hưởng tới thứ tự gợi ý, và đổi lại được bất cứ lúc nào.', 510),
('profile.saved', 'ho-so', 'Thông báo khi lưu thành công', '', 'text',
 'Đã lưu thay đổi.', 520),

-- === Trang dang nhap =======================================================
('login.title', 'dang-nhap', 'Tiêu đề trang', '', 'text', 'Đăng nhập', 600),
('login.subtitle', 'dang-nhap', 'Mô tả dưới tiêu đề', '', 'textarea',
 'Đăng nhập để lưu gu của bạn, phản hồi outfit và đăng bài của riêng bạn.', 610),

-- === Trang tao bai =========================================================
('create.title', 'tao-bai', 'Tiêu đề trang', '', 'text', 'Tạo set đồ', 700),
('create.subtitle', 'tao-bai', 'Mô tả dưới tiêu đề', '', 'textarea',
 'Dán link Shopee hoặc TikTok Shop của từng món. Link bạn dán là link của bạn, hoa hồng cũng của bạn.', 710),

-- === Trang du lieu ca nhan =================================================
('privacy.title', 'du-lieu', 'Tiêu đề trang dữ liệu cá nhân', '', 'text',
 'Dữ liệu cá nhân của bạn', 800),
('privacy.desc', 'du-lieu', 'Mô tả', '', 'textarea',
 'Bạn có quyền xem, tải về và xoá dữ liệu cá nhân của mình bất cứ lúc nào, không cần chờ quản trị viên xử lý.', 810),
('privacy.warning', 'du-lieu', 'Cảnh báo trước khi xoá', '', 'textarea',
 'Xoá dữ liệu cá nhân sẽ xoá ngày sinh, niên mệnh, gu đã chọn và toàn bộ lịch sử phản hồi. Các bài bạn đã đăng công khai vẫn được giữ lại nhưng chuyển sang khuyết danh, để không làm vỡ những set đồ người khác đang xem.', 820);

-- ---------------------------------------------------------------------------
-- Anh va mo ta cho tung phong cach o trang chu
--
-- Sinh tu bang `styles` thay vi viet cung tung dong: them mot phong cach moi
-- thi chi can them vao `styles` roi chay lai cau lenh nay, khong phai sua
-- migration nay va khong phai sua ma nguon.
-- ---------------------------------------------------------------------------

insert into site_content (key, page, label, hint, kind, value, sort_order)
select 'home.style.' || s.slug || '.image', 'trang-chu',
       'Phong cách ' || s.label || ' — ảnh',
       'Ảnh dọc, khuyên dùng tỷ lệ 4:5',
       'image', '', 1000 + s.sort_order * 10
  from styles s
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select 'home.style.' || s.slug || '.desc', 'trang-chu',
       'Phong cách ' || s.label || ' — mô tả',
       'Một câu ngắn hiện dưới tên phong cách',
       'text', coalesce(nullif(s.description, ''), ''), 1000 + s.sort_order * 10 + 1
  from styles s
on conflict (key) do nothing;
