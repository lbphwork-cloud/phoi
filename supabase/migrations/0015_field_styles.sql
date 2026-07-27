-- =============================================================================
-- Kieu chu rieng cho tung o chu
--
-- VI SAO CAN THEM TANG NAY
--   Bon vai tro o migration 0014 (tieu de lon / tieu de nho / chu thuong / nut)
--   la mot he thong dung nhung TRUU TUONG: nhin vao o "Tieu de phan mo dau"
--   khong co gi cho biet no thuoc vai tro nao, nen muon doi phai doan roi thu.
--
--   Tang nay cho ghi de ngay tai o dang sua. Khong dung vao thi o do theo vai
--   tro; dung vao thi o do tu quyet. Doi font toan site van la mot thao tac,
--   ma van pha cach duoc o cho can.
--
-- MOT DONG CHO CA CUM, KHONG PHAI NAM DONG
--   Neu tach font/co/dam/nghieng/mau thanh nam dong thi bang nay phinh tu 89
--   len hon 300 dong — dung cai me cung ma chu website vua phai loi qua de tim
--   muc "Kieu chu". Ca cum ma hoa vao mot chuoi ngan:
--     font=playfair;size=lon;weight=dam;italic=1;color=trang
--
-- QUY UOC KHOA
--   Khoa cua o kieu chu = khoa cua o chu + ".style". Hai o luon di cung nhau
--   ma khong can them cot lien ket nao, va giao dien tra duoc o nay tu o kia
--   chi bang phep noi chuoi.
--
-- SINH TU CHINH BANG, KHONG LIET KE TAY
--   Liet ke tay 40 khoa la 40 co hoi go sai, va lan sau them o chu moi lai
--   quen. Cach duoi day sinh tu dung nhung dong dang co, nen no luon khop.
-- =============================================================================

-- Cot `kind` co rang buoc liet ke cac kieu hop le. Phai mo rang buoc truoc khi
-- chen, neu khong ca migration bi tu choi — dung nhu lan chay dau tien.
alter table site_content drop constraint if exists site_content_kind_check;
alter table site_content add constraint site_content_kind_check
  check (kind in ('text', 'textarea', 'image', 'url', 'list', 'choice', 'style'));

insert into site_content (key, page, label, hint, kind, value, sort_order)
select
  c.key || '.style',
  c.page,
  c.label || ' — kiểu chữ riêng',
  'Để trống thì ô này theo kiểu chung của cả website (nhóm Kiểu chữ).',
  'style',
  '',
  c.sort_order
from site_content c
where c.kind in ('text', 'textarea')
  -- Nhom "Kieu chu" chinh no la cac o cai dat, khong phai chu hien tren trang.
  and c.page <> 'kieu-chu'
  -- Chieu cao logo la mot con so, khong phai chu.
  and c.key <> 'site.logo.height'
  -- Khong sinh o kieu chu cho chinh o kieu chu.
  and c.key not like '%.style'
on conflict (key) do nothing;

-- --- Bo cuc mo dau: ha ca cum xuong phan duoi anh ---------------------------
-- Doi nhan cua lua chon cho dung viec no lam. Ban truoc dat chu giua khung roi
-- day rieng nut xuong day; chu website thay hai cum cach nhau qua xa va nam
-- qua cao. Gio ca cum dong xuong phan duoi, cach deu nhau.
update site_content
   set hint = 'Kiểu "Dồn xuống dưới" đặt cả cụm chữ và nút ở phần dưới bức ảnh, canh giữa theo chiều ngang, khoảng cách đều nhau. Ở kiểu này đoạn mô tả tạm ẩn.'
 where key = 'home.hero.align';
