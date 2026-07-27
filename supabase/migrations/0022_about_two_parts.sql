-- =============================================================================
-- Trang gioi thieu viet lai thanh HAI PHAN RO RANG, va duong dan chuyen len
-- thanh menu
--
-- VI SAO HAI PHAN CHU KHONG PHAI BON DOAN
--   Ban truoc la bon doan chu chay lien nhau. Doc het thi hieu, nhung nguoi
--   doc phai doc HET moi biet doan nao noi ve minh. Ma website nay phuc vu hai
--   kieu nguoi hoan toan khac nhau: nguoi den de mua, va nguoi den de dang bai
--   lay hoa hong.
--
--   Hai khoi co nhan rieng thi nhin mot cai la biet phan nao la cua minh, va
--   phan kia co the bo qua. Do la khac biet giua "co the doc duoc" va "duoc
--   viet cho nguoi doc".
--
-- CACH VIET VE HOA HONG
--   Chi noi CO CHE ("ban giu toan bo hoa hong san tra"), khong noi so tien va
--   khong hua "kiem them thu nhap". Chu website chua kiem soat duoc san tra bao
--   nhieu, va mot loi hua thu nhap tren trang cong khai la thu co the bi bat be
--   — ca boi nguoi dung lan boi chinh Shopee va TikTok khi dang ky tai khoan
--   tiep thi.
--
-- KHONG CO NUT KEU GOI HANH DONG TRONG TRANG NAY
--   Theo yeu cau cua chu website. Trang nay tra loi mot cau hoi, khong ban gi.
-- =============================================================================

-- --- Duong dan chuyen tu chan trang len thanh menu ---------------------------
insert into site_content (key, page, label, hint, kind, value, sort_order)
values ('nav.about', 'chung', 'Menu — mục Giới thiệu', '', 'text', 'About', 13)
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.style', c.page, c.label || ' — kiểu chữ riêng',
       'Để trống thì ô này theo kiểu chung của cả website (nhóm Kiểu chữ).',
       'style', '', c.sort_order
  from site_content c where c.key = 'nav.about'
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.mobile', c.page, c.label || ' — bản điện thoại',
       'Để trống thì điện thoại dùng lại nội dung của bản máy tính.',
       'text', '', c.sort_order
  from site_content c where c.key = 'nav.about'
on conflict (key) do nothing;

-- O cu cua chan trang khong con cho dung nao. De lai la de mot o ma sua vao
-- khong co gi thay doi — thu te hon la khong co o.
delete from site_content where key like 'about.link_label%';

-- --- Noi dung moi ------------------------------------------------------------
update site_content
   set value = 'PHOOIS ra đời để làm gì?'
 where key = 'about.heading';

-- `about.body` doi vai: tu ca bai chu thanh cau dan mot dong.
update site_content
   set label = replace(label, 'Nội dung', 'Câu dẫn đầu trang'),
       hint = '',
       value = 'Hai việc. Bạn có thể chỉ cần một trong hai.',
       sort_order = 30
 where key like 'about.body%';

insert into site_content (key, page, label, hint, kind, value, sort_order)
values
  ('about.part1_title', 'gioi-thieu', 'Phần 1 — tiêu đề', '', 'text',
   'Gợi ý chọn đồ', 40),
  ('about.part1_body', 'gioi-thieu', 'Phần 1 — nội dung', '', 'textarea',
   'Bạn xem các set đã phối sẵn — áo, quần, giày, phụ kiện đi cùng nhau, không phải '
   || 'từng món rời rạc. Lọc theo phong cách, màu và khoảng giá. Thêm ngày sinh nếu '
   || 'muốn nhận gợi ý màu theo niên mệnh ngũ hành: không bắt buộc, và tắt được bất '
   || 'cứ lúc nào.'
   || E'\n\n'
   || 'Thích món nào thì bấm vào, sang thẳng Shopee hoặc TikTok Shop để mua. '
   || 'Chúng tôi không bán hàng và không giữ tiền của bạn.', 41),
  ('about.part2_title', 'gioi-thieu', 'Phần 2 — tiêu đề', '', 'text',
   'Đăng bài phối của bạn', 50),
  ('about.part2_body', 'gioi-thieu', 'Phần 2 — nội dung', '', 'textarea',
   'Bạn tự phối một set rồi đăng lên đây, gắn liên kết tiếp thị của chính bạn cho '
   || 'từng món.'
   || E'\n\n'
   || 'Hoa hồng sàn trả về thẳng tài khoản của bạn. Chúng tôi không cắt phần trăm nào '
   || 'và không đứng giữa khoản đó. Bài được duyệt trước khi hiển thị công khai.', 51)
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.style', c.page, c.label || ' — kiểu chữ riêng',
       'Để trống thì ô này theo kiểu chung của cả website (nhóm Kiểu chữ).',
       'style', '', c.sort_order
  from site_content c
 where c.key like 'about.part%' and c.key not like '%.style' and c.key not like '%.mobile'
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.mobile', c.page, c.label || ' — bản điện thoại',
       'Để trống thì điện thoại dùng lại nội dung của bản máy tính.',
       c.kind, '', c.sort_order
  from site_content c
 where c.key like 'about.part%' and c.key not like '%.style' and c.key not like '%.mobile'
on conflict (key) do nothing;
