-- =============================================================================
-- Doi ba doan chu tren giao dien, theo yeu cau cua chu website
--
--   home.styles.eyebrow  "BY STYLE"            -> "Khám phá"
--   home.hero.cta_label  "Xem tất cả outfit"   -> "Khám phá bộ sưu tập"
--   nav.my_posts         "My posts"            -> "Your Post"
--
-- VI SAO PHAI SUA O DAY chu khong chi sua trong ma nguon
--   Ba khoa nay deu di qua bang site_content: ma nguon chi mang CHU DU PHONG,
--   dung khi database chua co dong tuong ung. Ba dong nay da co, nen chu du
--   phong khong bao gio duoc dung den — sua mot minh ma nguon thi tren website
--   khong doi gi ca.
--
--   Chu du phong van duoc sua cho khop, trong cung mot lan. De lech nhau nghia
--   la mot ngay nao do co nguoi xoa dong trong database va chu cu quay lai —
--   khong bao loi, khong ai biet.
--
-- VIET THUONG, KHONG VIET HOA
--   Lop .eyebrow va .btn deu dat text-transform: uppercase, nen chu hien ra
--   van la KHÁM PHÁ. Luu ban viet thuong de o nhap trong trang quan tri con
--   doc duoc nhu tieng Viet binh thuong, va de neu sau nay ai do doi kieu chu
--   thi cau van con dung chinh ta.
--
-- CHI SUA DUNG GIA TRI CU. Neu chu website da tu sua chu trong trang quan tri
-- roi thi khong duoc dap len — cau cua ho moi la cau dung.
-- =============================================================================

update site_content set value = 'Khám phá'
 where key in ('home.styles.eyebrow', 'home.styles.eyebrow.mobile')
   and value = 'BY STYLE';

update site_content set value = 'Khám phá bộ sưu tập'
 where key = 'home.hero.cta_label'
   and value = 'Xem tất cả outfit';

update site_content set value = 'Your Post'
 where key = 'nav.my_posts'
   and value = 'My posts';
