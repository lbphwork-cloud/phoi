-- =============================================================================
-- Nhan dien website gom mot cho, va don lai chan trang
--
-- VI SAO PHAI TACH NHOM RIENG
--   O sua bieu tuong tab da co tu truoc, nhung no nam lot giua 60 o trong nhom
--   "Dung chung" nen chu website khong tim thay va tuong la chua lam. Mot tinh
--   nang khong tim thay thi bang khong co. Loi nam o cho xep chu khong o cho
--   thieu.
--
--   Nen tat ca thu thuoc ve NHAN DIEN — ten, tieu de tren tab, mo ta, bieu
--   tuong, anh chia se, logo — duoc gom vao mot nhom rieng dat len dau danh
--   sach. Nhom "Dung chung" tu do chi con chu tren thanh menu va chan trang.
--
-- XOA BA O KHONG BAO GIO CO TAC DUNG
--   Migration 0018 sinh may moc ban "dien thoai" cho MOI o chu va o anh. Nhung
--   bieu tuong tab, anh chia se va mo ta duoc doc LUC DUNG TRANG — luc do
--   khong ton tai khai niem dien thoai hay may tinh. Ba o do dien vao khong
--   bao gio co tac dung.
--
--   Mot o hien ra ma khong lam gi con te hon mot o khong co: nguoi dung dien
--   vao, khong thay doi, roi ket luan la website hong.
-- =============================================================================

-- --- Tieu de tren tab trinh duyet -------------------------------------------
-- Truoc day viet cung trong src/app/layout.tsx. Day la dong chu nguoi ta doc
-- dau tien trong ket qua tim kiem Google, va no khong sua duoc.
insert into site_content (key, page, label, hint, kind, value, sort_order)
values (
  'site.title', 'nhan-dien', 'Tiêu đề website',
  'Hiện trên tab trình duyệt và làm dòng tiêu đề trong kết quả tìm kiếm Google. '
  || 'Khoảng 50–60 ký tự là vừa. Sửa xong phải triển khai lại trang thì Google mới thấy.',
  'text', 'PHỐI — Phối đồ nam theo gu và theo mệnh', 1
)
on conflict (key) do nothing;

-- --- Chan trang --------------------------------------------------------------
-- Hai doan nay truoc day viet cung trong ma nguon. Chung la chu hien tren
-- trang, nen chung phai sua duoc — nhat la doan ve gia, vi do la mot loi cam
-- ket voi nguoi mua.
insert into site_content (key, page, label, hint, kind, value, sort_order)
values
  ('footer.disclosure_heading', 'chung', 'Chân trang — nhãn khối công bố',
   '', 'text', 'Công bố', 38),
  ('footer.price_note', 'chung', 'Chân trang — ghi chú về giá',
   '', 'textarea',
   'Giá sản phẩm do sàn quyết định và có thể đã thay đổi so với thời điểm '
   || 'chúng tôi ghi nhận. Vui lòng kiểm tra lại trên sàn trước khi mua.', 42)
on conflict (key) do nothing;

-- --- Gom nhom nhan dien ------------------------------------------------------
update site_content set page = 'nhan-dien' where key like 'site.%';

-- Thu tu doc trong nhom: thu nguoi ngoai nhin thay truoc thi dat truoc.
-- Cac o sinh ra (.style, .mobile) an theo o goc, nen tinh tu phan dau cua khoa.
update site_content
   set sort_order = case
         when key like 'site.title%'       then 1
         when key like 'site.description%' then 2
         when key like 'site.favicon%'     then 3
         when key like 'site.share_image%' then 4
         when key like 'site.logo.light%'  then 10
         when key like 'site.logo.dark%'   then 11
         when key like 'site.logo.height%' then 12
         when key like 'site.name%'        then 20
         when key like 'site.tagline%'     then 21
         else sort_order
       end
 where page = 'nhan-dien';

-- --- Xoa cac o khong bao gio co tac dung -------------------------------------
delete from site_content
 where key in ('site.favicon.mobile', 'site.share_image.mobile', 'site.description.mobile');

-- --- Sinh o kieu chu va o ban dien thoai cho cac o chu vua them --------------
-- site.title CO Y khong duoc sinh hai o nay: no khong hien tren trang nen
-- khong co kieu chu, va no duoc doc luc dung trang nen khong co ban dien thoai.
insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.style', c.page, c.label || ' — kiểu chữ riêng',
       'Để trống thì ô này theo kiểu chung của cả website (nhóm Kiểu chữ).',
       'style', '', c.sort_order
  from site_content c
 where c.key in ('footer.disclosure_heading', 'footer.price_note')
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.mobile', c.page, c.label || ' — bản điện thoại',
       'Để trống thì điện thoại dùng lại nội dung của bản máy tính.',
       c.kind, '', c.sort_order
  from site_content c
 where c.key in ('footer.disclosure_heading', 'footer.price_note')
on conflict (key) do nothing;
