-- =============================================================================
-- Xoa cac set do CHUA CO ANH DAI DIEN
--
-- 17 set do trong danh muc dang khong co anh nao. Ca 17 deu la du lieu mau do
-- migration 0024 cua toi tao ra de can moi phong cach ve bon bai — va do la mot
-- quyet dinh sai: mot the trong tren trang chu con te hon mot phong cach it bai.
--
-- Nguoi vao trang chu thay mot o xam khong anh se khong bam. Va neu ho bam, ho
-- den mot bai khong co gi de nhin. Do la cach nhanh nhat de mat long tin o lan
-- ghe tham dau tien.
--
-- SAU KHI XOA: 36 -> 19 set do. Phong cach Workwear ve 0 bai, Vintage va The
-- thao con 1. Chu website da biet dieu do va chon xoa het, tu tao lai bang bai
-- that sau.
--
-- XOA HAN, KHONG AN
--   An thi chung van nam trong danh sach quan tri, van bi dem vao cac phep kiem,
--   va van la thu phai luot qua moi lan tim mot bai that. Chung khong mang du
--   lieu gi cua nguoi dung — khong luot xem, khong luot thich, khong binh luan.
--
-- SAN PHAM VA LINK THI GIU LAI
--   `on delete cascade` chi xoa dong noi trong outfit_items. San pham va link
--   tiep thi van con — chung se hien trong muc "San pham mo coi" o trang quan
--   tri, va o do moi co lua chon xoa han. Hai buoc cho hai quyet dinh khac nhau.
--
-- CHI XOA DU LIEU MAU. Dieu kien `is_seed` la chot chan: neu sau nay co bai
-- THAT nao chua kip co anh, migration nay chay lai cung khong dong vao no.
-- =============================================================================

--
-- CHOT CHAN THU HAI: chi xoa khi VAN CON set do mau CO ANH.
--
--   Migration chay lai tu dau tren mot database trong — do la cach bo kiem
--   chung `npm run verify:schema` lam viec. Tren database do, anh chua duoc
--   tai len (viec do do scripts/seed-images.mjs lam sau), nen KHONG set do nao
--   co anh. Khong co dieu kien nay thi cau lenh se xoa sach toan bo danh muc
--   mau, va moi phep kiem phia sau deu sup.
--
--   Dieu kien `exists` bien no thanh dung nghia: "don nhung bai khong co anh
--   RA KHOI mot danh muc da co anh", chu khong phai "xoa het khi chua co gi".
delete from outfits o
 where o.hero_image_url is null
   and o.is_seed = true
   and exists (
     select 1 from outfits x
      where x.is_seed = true and x.hero_image_url is not null
   );
