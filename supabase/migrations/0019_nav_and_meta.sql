-- =============================================================================
-- Chu tren thanh menu, va phan nhan dien website (bieu tuong tab + mo ta)
--
-- CHU THANH MENU
--   Truoc day nam cung trong ma nguon. Doi mot chu la mot lan sua code va mot
--   lan dung lai trang — vo ly voi thu ma chu website muon tu doi.
--
-- BIEU TUONG TAB VA MO TA
--   Hai thu nay chua co cho doi. Chung khong hien tren trang nen de bi quen,
--   nhung chung LA thu nguoi ta thay dau tien: bieu tuong tren tab trinh duyet,
--   va doan mo ta trong ket qua tim kiem Google hay khi ai do chia se link.
--
--   MOT DIEU PHAI NOI RO: hai o nay duoc doc luc DUNG TRANG, khong phai luc
--   nguoi dung mo trang. Sua xong phai trien khai lai thi Google va Facebook
--   moi thay. Trinh duyet thi thay bieu tuong moi ngay, vi no duoc dat lai luc
--   chay. Su that nay duoc viet vao chinh goi y cua o, khong giau trong code.
-- =============================================================================

insert into site_content (key, page, label, hint, kind, value, sort_order)
values
  ('nav.discover',   'chung', 'Menu — mục Khám phá',    '', 'text', 'Discover',  10),
  ('nav.cart',       'chung', 'Menu — mục Giỏ hàng',    '', 'text', 'Cart',      11),
  ('nav.create',     'chung', 'Menu — mục Tạo bài',     '', 'text', 'Create',    12),
  ('nav.my_posts',   'chung', 'Menu — mục Bài của tôi', '', 'text', 'My posts',  13),
  ('nav.admin',      'chung', 'Menu — mục Quản trị',
   'Chỉ hiện với tài khoản quản trị', 'text', 'Admin', 14),
  ('nav.profile',    'chung', 'Menu — mục Hồ sơ',
   'Chữ chung cho mọi tài khoản, không phải tên người đăng nhập', 'text', 'Profile', 15),
  ('nav.sign_out',   'chung', 'Menu — mục Đăng xuất',   '', 'text', 'Log out',   16),
  ('nav.sign_in',    'chung', 'Menu — mục Đăng nhập',   '', 'text', 'Sign in',   17),
  ('nav.theme_auto', 'chung', 'Menu — chế độ Tự động',  '', 'text', 'Auto',      18),
  ('nav.theme_light','chung', 'Menu — chế độ Sáng',     '', 'text', 'Light',     19),
  ('nav.theme_dark', 'chung', 'Menu — chế độ Tối',      '', 'text', 'Dark',      20),

  ('site.description', 'chung', 'Mô tả website',
   'Hiện trong kết quả tìm kiếm Google và khi ai đó chia sẻ link. Khoảng 150–160 ký tự là vừa. '
   || 'Sửa xong phải triển khai lại trang thì Google mới thấy.',
   'textarea',
   'Gợi ý phối đồ nam trong khoảng 150.000 – 700.000đ, cá nhân hoá theo phong cách, '
   || 'màu sắc và niên mệnh ngũ hành. Mua trên Shopee và TikTok Shop.', 30)
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
values
  ('site.favicon', 'chung', 'Biểu tượng trên tab trình duyệt',
   'Ảnh vuông, PNG tách nền được. Khuyên dùng 512×512. Trình duyệt thấy ngay; '
   || 'kết quả tìm kiếm Google cần triển khai lại trang.',
   'image', '', 31),
  ('site.share_image', 'chung', 'Ảnh khi chia sẻ link',
   'Hiện khi dán link lên Facebook, Zalo, Messenger. Ảnh ngang, khuyên dùng 1200×630. '
   || 'Sửa xong phải triển khai lại trang.',
   'image', '', 32)
on conflict (key) do nothing;

-- Sinh o kieu chu va o ban dien thoai cho cac o vua them, dung quy uoc cu.
insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.style', c.page, c.label || ' — kiểu chữ riêng',
       'Để trống thì ô này theo kiểu chung của cả website (nhóm Kiểu chữ).',
       'style', '', c.sort_order
  from site_content c
 where c.kind in ('text', 'textarea')
   and (c.key like 'nav.%' or c.key = 'site.description')
   and c.key not like '%.style' and c.key not like '%.mobile'
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, options, sort_order)
select c.key || '.mobile', c.page, c.label || ' — bản điện thoại',
       'Để trống thì điện thoại dùng lại nội dung của bản máy tính.',
       c.kind, '', c.options, c.sort_order
  from site_content c
 where c.kind in ('text', 'textarea', 'image')
   and (c.key like 'nav.%' or c.key in ('site.description', 'site.favicon', 'site.share_image'))
   and c.key not like '%.style' and c.key not like '%.mobile'
on conflict (key) do nothing;
