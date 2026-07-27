-- =============================================================================
-- O chon san cho noi dung, va mo rong cac trang sua duoc
--
-- HAI VIEC TRONG MOT FILE
--   1. Them kieu o `choice` — mot danh sach chon san thay vi go tu do. Dung cho
--      nhung thu ma go sai la vo giao dien: mau chu, do dam lop phu, vi tri.
--   2. Them khoa noi dung cho cac trang con lai. Truoc day 31/47 khoa thuoc
--      trang chu, cac trang khac chi co tieu de va mo ta — nen nhin vao trang
--      quan tri tuong nhu chi sua duoc trang chu.
--
-- VI SAO KHONG DE GO TU DO MA MAU
--   Go "#fff" hay "trang" hay "white" deu la y dinh giong nhau nhung ket qua
--   khac nhau, va mot lan go sai la chu bien mat tren nen anh. Danh sach chon
--   san thi khong bao gio ra trang thai vo nghia.
--
-- VI SAO MAU CHU PHAI DOI DUOC
--   Anh nen do nguoi dung tu chon. Anh toi thi chu trang doc duoc, anh sang thi
--   chu trang bien mat. Khong co mot lua chon nao dung cho moi anh, nen day
--   phai la thiet lap chu khong phai hang so trong ma nguon.
-- =============================================================================

alter table site_content
  add column if not exists options text[] not null default '{}';

comment on column site_content.options is
  'Cac gia tri hop le khi kind = ''choice''. Rong voi cac kieu khac.';

alter table site_content drop constraint if exists site_content_kind_check;
alter table site_content add constraint site_content_kind_check
  check (kind in ('text', 'textarea', 'image', 'url', 'list', 'choice'));

-- ---------------------------------------------------------------------------
-- Mau va bo cuc cua phan mo dau trang chu
-- ---------------------------------------------------------------------------

insert into site_content (key, page, label, hint, kind, value, options, sort_order) values

('home.hero.text_color', 'trang-chu', 'Màu chữ phần mở đầu',
 'Ảnh nền tối thì chọn trắng, ảnh sáng thì chọn đen.', 'choice',
 'trang', array['trang', 'den'], 152),

('home.hero.overlay', 'trang-chu', 'Độ tối của lớp phủ trên ảnh',
 'Lớp phủ giúp chữ đọc được. Ảnh càng sáng càng cần đậm.', 'choice',
 'vua', array['khong', 'nhe', 'vua', 'dam'], 154),

('home.hero.box', 'trang-chu', 'Khung nền sau chữ',
 'Khi ảnh nhiều chi tiết, một khung nền sau chữ dễ đọc hơn là tăng lớp phủ toàn ảnh.', 'choice',
 'khong', array['khong', 'toi', 'sang', 'mo'], 156),

('home.hero.align', 'trang-chu', 'Vị trí khối chữ',
 '', 'choice',
 'duoi-trai', array['duoi-trai', 'giua', 'duoi-giua'], 158),

('home.hero.button_style', 'trang-chu', 'Kiểu nút chính',
 '', 'choice',
 'sang', array['sang', 'toi', 'vien'], 160)

on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Noi dung cho cac trang con lai
--
-- Truoc day moi trang chi co tieu de va mo ta. Them nhung doan chu that su
-- hien tren man hinh: nhan nut, trang thai rong, ghi chu cuoi trang.
-- ---------------------------------------------------------------------------

insert into site_content (key, page, label, hint, kind, value, sort_order) values

-- === Kham pha ==============================================================
('discover.heading', 'kham-pha', 'Tiêu đề lớn', '', 'text', 'Tất cả outfit', 402),
('discover.empty_title', 'kham-pha', 'Tiêu đề khi không có kết quả', '', 'text',
 'Không có outfit nào khớp', 404),
('discover.filter_hint', 'kham-pha', 'Ghi chú dưới bộ lọc', '', 'textarea',
 'Bấm vào từng nhóm để mở rộng lựa chọn.', 406),
('discover.price_note', 'kham-pha', 'Ghi chú cuối trang về giá', '', 'textarea',
 'Giá hiển thị là tổng tạm tính của cả set, ghi nhận tại thời điểm nhập.', 408),

-- === Trang chi tiet outfit =================================================
('outfit.buy_label', 'outfit', 'Chữ trên nút dẫn sang sàn',
 'Dùng chung cho cả Shopee và TikTok Shop.', 'text', 'Xem sản phẩm', 900),
('outfit.items_heading', 'outfit', 'Tiêu đề danh sách món', '', 'text',
 'Các món trong set', 902),
('outfit.feedback_heading', 'outfit', 'Tiêu đề khối phản hồi', '', 'text',
 'Phản hồi để gợi ý sát hơn', 904),
('outfit.affiliate_note', 'outfit', 'Ghi chú về liên kết tiếp thị', '', 'textarea',
 'Đường dẫn tới sàn có thể là liên kết tiếp thị. Giá bạn trả không thay đổi.', 906),

-- === Bai cua toi ===========================================================
('myposts.title', 'bai-cua-toi', 'Tiêu đề trang', '', 'text', 'Bài của tôi', 1500),
('myposts.subtitle', 'bai-cua-toi', 'Mô tả dưới tiêu đề', '', 'textarea',
 'Bài nháp, bài chờ duyệt và bài đã đăng của bạn.', 1502),
('myposts.empty', 'bai-cua-toi', 'Chữ khi chưa có bài nào', '', 'textarea',
 'Bạn chưa tạo set đồ nào. Bấm Tạo set đồ để bắt đầu.', 1504)

on conflict (key) do nothing;
