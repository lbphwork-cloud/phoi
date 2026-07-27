-- =============================================================================
-- Khoi "Cach hoat dong" thanh mot phan cua chan trang, trang gioi thieu,
-- va sap lai thu tu cac phong cach trong trang quan tri
--
-- KHOI BA BUOC DOI CHU
--   Truoc day no la mot khoi cua rieng trang chu. Gio no nam trong chan trang
--   nen no hien o MOI trang — do la y do, khong phai tac dung phu: mot nguoi
--   vao thang trang chi tiet mot set do qua duong dan ban be gui cung can biet
--   website nay hoat dong the nao, ma ho khong bao gio di qua trang chu.
--
--   Khoa giu nguyen `home.step*`. Doi khoa se lam moi o kieu chu va o dien
--   thoai gan voi no mat lien ket, doi lai duy nhat mot cai ten dep hon trong
--   database ma khong ai nhin thay. Nhan hien cho nguoi dung thi doi.
--
-- THU TU PHONG CACH TRONG TRANG QUAN TRI
--   Danh sach trong trang quan tri dang la: toi-gian, smart-casual, streetwear,
--   thanh-lich, co-dien, vintage, the-thao, workwear, pha-cach.
--   Thu tu that tren trang chu la:      smart-casual, streetwear, toi-gian,
--   co-dien, pha-cach, thanh-lich, vintage, the-thao, workwear.
--
--   Hai danh sach lech nhau vi sort_order duoc dat mot lan luc tao, roi thu tu
--   hien thi bi doi nhieu lan sau do qua o `home.styles.list`. Nguoi sua phai
--   do tung dong de biet minh dang sua khoi nao — va do la cach de sua nham.
--
--   Migration nay sap lai cho khop. Nhung sap mot lan la chua du: chu website
--   con doi `home.styles.list` nua thi lai lech. Nen trang quan tri con duoc
--   sua de TU sap theo gia tri that cua o do luc hien — xem chu thich trong
--   src/app/admin/noi-dung/page.tsx.
-- =============================================================================

-- --- Khoi ba buoc chuyen sang nhom "Dung chung" ------------------------------
update site_content
   set page = 'chung',
       label = replace(label, 'Tiêu đề phần ba bước', 'Chân trang — tiêu đề khối ba bước'),
       sort_order = 40
 where key like 'home.steps.heading%';

update site_content
   set page = 'chung',
       label = 'Chân trang — ' || lower(label),
       sort_order = case
         when key like 'home.step1.title%' then 41
         when key like 'home.step1.desc%'  then 42
         when key like 'home.step2.title%' then 43
         when key like 'home.step2.desc%'  then 44
         when key like 'home.step3.title%' then 45
         when key like 'home.step3.desc%'  then 46
       end
 where key like 'home.step1.%' or key like 'home.step2.%' or key like 'home.step3.%';

-- Khoi cong bo xep ngay sau khoi ba buoc, dung thu tu no hien tren trang.
update site_content set sort_order = 50 where key like 'footer.disclosure_heading%';
update site_content set sort_order = 51 where key like 'footer.affiliate%';
update site_content set sort_order = 52 where key like 'footer.about%';
update site_content set sort_order = 53 where key like 'footer.price_note%';

-- --- Trang gioi thieu --------------------------------------------------------
-- CO Y NGAN. Nguoi vao trang nay dang hoi mot cau duy nhat: "trang nay la gi
-- va co lay tien cua toi khong". Bon doan tra loi xong cau do. Them nua thi
-- khong ai doc het, va phan khong ai doc lai la phan noi ve tien.
insert into site_content (key, page, label, hint, kind, value, sort_order)
values
  ('about.eyebrow', 'gioi-thieu', 'Chữ nhỏ phía trên tiêu đề', '', 'text', 'Giới thiệu', 10),
  ('about.heading', 'gioi-thieu', 'Tiêu đề trang', '', 'text', 'PHỐI là gì', 20),
  ('about.body', 'gioi-thieu', 'Nội dung',
   'Cách nhau một dòng trống thì thành đoạn mới.', 'textarea',
   'PHỐI gợi ý cách phối đồ nam cho thị trường Việt Nam. Mỗi bài là một set hoàn chỉnh — '
   || 'áo, quần, giày, phụ kiện — kèm đường dẫn tới từng món trên Shopee hoặc TikTok Shop.'
   || E'\n\n'
   || 'Bạn chọn phong cách, màu và khoảng giá. Nếu muốn, thêm ngày sinh để nhận gợi ý màu '
   || 'theo niên mệnh ngũ hành — không bắt buộc, và tắt được bất cứ lúc nào.'
   || E'\n\n'
   || 'PHỐI không bán hàng và không giữ tiền của bạn. Bạn mua thẳng trên sàn, giá do sàn '
   || 'quyết định. Các đường dẫn là liên kết tiếp thị: người đăng bài có thể nhận hoa hồng '
   || 'từ sàn, còn giá bạn trả không thay đổi.'
   || E'\n\n'
   || 'Nội dung về ngũ hành chỉ là gợi ý màu sắc mang tính tham khảo trong phối đồ. '
   || 'Đây không phải dự đoán vận mệnh.', 30),
  ('about.link_label', 'chung', 'Chân trang — chữ của đường dẫn trang giới thiệu',
   '', 'text', 'Giới thiệu', 30)
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.style', c.page, c.label || ' — kiểu chữ riêng',
       'Để trống thì ô này theo kiểu chung của cả website (nhóm Kiểu chữ).',
       'style', '', c.sort_order
  from site_content c
 where c.key like 'about.%' and c.key not like '%.style' and c.key not like '%.mobile'
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.mobile', c.page, c.label || ' — bản điện thoại',
       'Để trống thì điện thoại dùng lại nội dung của bản máy tính.',
       c.kind, '', c.sort_order
  from site_content c
 where c.key like 'about.%' and c.key not like '%.style' and c.key not like '%.mobile'
on conflict (key) do nothing;

-- --- Sap lai thu tu phong cach cho khop trang chu ----------------------------
-- Anh la so chan, mo ta la so le ngay sau no — de hai o cua cung mot phong
-- cach luon dung canh nhau.
update site_content
   set sort_order = 1000
     + 10 * case
         when key like 'home.style.smart-casual.%' then 1
         when key like 'home.style.streetwear.%'   then 2
         when key like 'home.style.toi-gian.%'     then 3
         when key like 'home.style.co-dien.%'      then 4
         when key like 'home.style.pha-cach.%'     then 5
         when key like 'home.style.thanh-lich.%'   then 6
         when key like 'home.style.vintage.%'      then 7
         when key like 'home.style.the-thao.%'     then 8
         when key like 'home.style.workwear.%'     then 9
       end
     + case when key like '%.image%' then 0 else 1 end
 where key like 'home.style.%';
