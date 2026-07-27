-- =============================================================================
-- Kieu chu toan website, logo tai len duoc, va kieu bo cuc mo dau moi
--
-- BON VAI TRO CHU, KHONG PHAI BON MUOI BAY O
--   Chu website muon doi font, co, mau cho "tat ca cac phan text". Hieu theo
--   nghia den la 47 o noi dung nhan 5 thuoc tinh = gan 240 nut chinh — mot
--   trang quan tri khong ai dung noi, va ket qua chac chan la mot website moi
--   cho mot kieu chu.
--
--   Thay vao do chu tren toan site quy ve BON VAI TRO: tieu de lon, tieu de
--   nho, chu thuong, nut. Doi vai tro nao thi moi cho dung vai tro do doi theo,
--   moi trang cung luc. Hai muoi o thay vi hai tram bon muoi, va khong tao ra
--   duoc mot trang khong dong bo.
--
-- MAC DINH BANG DUNG GIAO DIEN DANG CHAY
--   Moi gia tri mac dinh duoi day bang dung so da viet cung trong globals.css
--   truoc khi co tinh nang nay. Chay migration nay xong, website khong doi mot
--   ly nao cho tori khi co nguoi tu bam.
-- =============================================================================

-- --- Kieu chu ---------------------------------------------------------------
insert into site_content (key, page, label, hint, kind, value, options, sort_order)
values
  -- Tieu de lon: ten trang, tieu de phan mo dau
  ('type.display.font', 'kieu-chu', 'Tiêu đề lớn — kiểu chữ',
   'Tất cả font trong danh sách đều có đầy đủ dấu tiếng Việt',
   'choice', 'be-vietnam',
   array['be-vietnam','inter','manrope','montserrat','playfair','garamond','oswald'], 10),

  ('type.display.size', 'kieu-chu', 'Tiêu đề lớn — cỡ chữ',
   'Là hệ số nhân, không phải số pixel — cỡ chữ vẫn tự co giãn theo bề ngang màn hình',
   'choice', 'vua', array['rat-nho','nho','vua','lon','rat-lon'], 11),

  ('type.display.weight', 'kieu-chu', 'Tiêu đề lớn — độ đậm',
   'Mặc định là nét mảnh, đúng cách các trang thời trang cao cấp đặt tiêu đề',
   'choice', 'manh', array['manh','thuong','vua','dam','rat-dam'], 12),

  ('type.display.color', 'kieu-chu', 'Tiêu đề lớn — màu chữ',
   'Chỉ "Theo giao diện" mới tự đổi theo chế độ sáng/tối. Chọn màu cố định thì một trong hai chế độ sẽ khó đọc',
   'choice', 'theo-giao-dien',
   array['theo-giao-dien','den','xam','xam-nhat','nau','trang'], 13),

  ('type.display.case', 'kieu-chu', 'Tiêu đề lớn — chữ hoa',
   'Viết hoa toàn bộ hay giữ nguyên như bạn gõ',
   'choice', 'nhu-go', array['nhu-go','in-hoa'], 14),

  -- Tieu de nho: tieu de tung phan, ten phong cach, ten set do
  ('type.heading.font', 'kieu-chu', 'Tiêu đề nhỏ — kiểu chữ', '',
   'choice', 'be-vietnam',
   array['be-vietnam','inter','manrope','montserrat','playfair','garamond','oswald'], 20),
  ('type.heading.size', 'kieu-chu', 'Tiêu đề nhỏ — cỡ chữ', '',
   'choice', 'vua', array['rat-nho','nho','vua','lon','rat-lon'], 21),
  ('type.heading.weight', 'kieu-chu', 'Tiêu đề nhỏ — độ đậm', '',
   'choice', 'manh', array['manh','thuong','vua','dam','rat-dam'], 22),
  ('type.heading.color', 'kieu-chu', 'Tiêu đề nhỏ — màu chữ', '',
   'choice', 'theo-giao-dien',
   array['theo-giao-dien','den','xam','xam-nhat','nau','trang'], 23),
  ('type.heading.case', 'kieu-chu', 'Tiêu đề nhỏ — chữ hoa', '',
   'choice', 'nhu-go', array['nhu-go','in-hoa'], 24),

  -- Chu thuong: toan bo phan doc
  ('type.body.font', 'kieu-chu', 'Chữ thường — kiểu chữ',
   'Áp cho toàn bộ phần đọc của website',
   'choice', 'be-vietnam',
   array['be-vietnam','inter','manrope','montserrat','playfair','garamond','oswald'], 30),
  ('type.body.size', 'kieu-chu', 'Chữ thường — cỡ chữ',
   'Cỡ này là gốc của gần như mọi chữ khác — đổi ở đây ảnh hưởng rộng nhất',
   'choice', 'vua', array['rat-nho','nho','vua','lon','rat-lon'], 31),
  ('type.body.weight', 'kieu-chu', 'Chữ thường — độ đậm', '',
   'choice', 'thuong', array['manh','thuong','vua','dam','rat-dam'], 32),
  ('type.body.color', 'kieu-chu', 'Chữ thường — màu chữ',
   'Rất nên để "Theo giao diện": đây là chữ người ta đọc nhiều nhất',
   'choice', 'theo-giao-dien',
   array['theo-giao-dien','den','xam','xam-nhat','nau','trang'], 33),
  ('type.body.case', 'kieu-chu', 'Chữ thường — chữ hoa',
   'Viết hoa cả đoạn văn thì rất khó đọc — chỉ nên dùng cho tiêu đề',
   'choice', 'nhu-go', array['nhu-go','in-hoa'], 34),

  -- Nut bam
  ('type.button.font', 'kieu-chu', 'Nút bấm — kiểu chữ', '',
   'choice', 'be-vietnam',
   array['be-vietnam','inter','manrope','montserrat','playfair','garamond','oswald'], 40),
  ('type.button.size', 'kieu-chu', 'Nút bấm — cỡ chữ', '',
   'choice', 'vua', array['rat-nho','nho','vua','lon','rat-lon'], 41),
  ('type.button.weight', 'kieu-chu', 'Nút bấm — độ đậm', '',
   'choice', 'dam', array['manh','thuong','vua','dam','rat-dam'], 42),
  ('type.button.color', 'kieu-chu', 'Nút bấm — màu chữ',
   'Nút có cả loại nền tối và nền trong suốt — đổi màu cố định dễ làm một loại mất chữ',
   'choice', 'theo-giao-dien',
   array['theo-giao-dien','den','xam','xam-nhat','nau','trang'], 43),
  ('type.button.case', 'kieu-chu', 'Nút bấm — chữ hoa', '',
   'choice', 'in-hoa', array['nhu-go','in-hoa'], 44)
on conflict (key) do nothing;

-- --- Logo --------------------------------------------------------------------
-- HAI O ANH chu khong phai mot: logo PNG tach nen chi co mot mau, nen logo
-- trang tang hinh o che do sang va logo den tang hinh o che do toi. O thu hai
-- de trong thi tu dung lai anh thu nhat.
insert into site_content (key, page, label, hint, kind, value, sort_order)
values
  ('site.logo.light', 'chung', 'Logo — dùng trên nền sáng',
   'PNG tách nền giữ nguyên độ trong suốt. Để trống thì hiện chữ PHỐI như hiện tại.',
   'image', '', 1),
  ('site.logo.dark', 'chung', 'Logo — dùng trên nền tối',
   'Để trống thì dùng lại logo nền sáng. Nếu logo của bạn màu tối thì nên tải thêm bản sáng vào đây.',
   'image', '', 2),
  ('site.logo.height', 'chung', 'Logo — chiều cao (pixel)',
   'Mỗi file một tỷ lệ khác nhau, nên chiều cao chỉnh tay. Mặc định 28.',
   'text', '28', 3)
on conflict (key) do nothing;

-- --- Kieu bo cuc mo dau moi ---------------------------------------------------
-- 'giua-nut-day': chu nam giua khung anh, nut CTA dinh day. O kieu nay doan mo
-- ta duoc an di de tren chi con hai hang chu — noi dung cua no VAN NAM NGUYEN
-- trong database, doi lai kieu khac la hien lai.
update site_content
   set options = array['duoi-trai','giua','duoi-giua','giua-nut-day'],
       hint = 'Kiểu "Giữa, nút dưới đáy" chỉ hiện hai hàng chữ ở trên và đẩy nút xuống đáy ảnh; đoạn mô tả tạm ẩn ở kiểu này.'
 where key = 'home.hero.align';
