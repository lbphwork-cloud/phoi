-- =============================================================================
-- Trang chu hien du ca chin phong cach
--
-- NAM KHOI LON + BON O NHO
--   Chin khoi lon la chin man hinh phai cuon moi het. Den khoi thu sau thi
--   khong con ai cuon nua, nen bon phong cach cuoi thanh ra vo hinh — te hon
--   la khong dua len. Nam khoi dau giu nguyen kich thuoc cu, bon cai sau xep
--   luoi nho: van moi cai mot anh va mot duong dan rieng.
--
--   Trang chu KHONG co o cau hinh rieng cho "bao nhieu khoi lon". Thu tu trong
--   danh sach duoi day da quyet dinh dieu do: nam cai dau la khoi lon. Them mot
--   o nua thi quan tri vien phai giu hai thu khop nhau bang tay, va se co ngay
--   chung lech.
--
-- PHA CACH NAM TRONG NAM CAI DAU
--   No la phong cach rieng cua website nay — cac trang khac deu co toi gian va
--   smart casual, khong trang nao co muc "phoi lech chuan co chu y". Day xuong
--   luoi nho la vut mat dung cai lam website nay khac di.
-- =============================================================================

update site_content
   set value = 'smart-casual, streetwear, toi-gian, co-dien, pha-cach, '
            || 'thanh-lich, vintage, the-thao, workwear'
 where key = 'home.styles.list'
   -- Chi ghi de neu dang la mot trong hai ban do CHINH TAY TOI dat truoc do.
   -- Neu quan tri vien da tu sap xep lai thi migration nay khong xoa cong ho.
   and value in (
         'toi-gian, streetwear, smart-casual, co-dien, thanh-lich',
         'smart-casual, streetwear, toi-gian, co-dien, thanh-lich, pha-cach'
       );

-- Goi y duoi o nhap phai noi ro quy tac "nam cai dau la khoi lon". Khong noi
-- thi doi thu tu xong lai ngac nhien sao mot phong cach tu dung nho di.
update site_content
   set hint = 'Ngăn cách bằng dấu phẩy. NĂM phong cách đầu hiện thành khối lớn, '
           || 'các phong cách sau xếp thành lưới nhỏ ở cuối trang. '
           || 'Đổi thứ tự ở đây là đổi luôn cái nào lớn cái nào nhỏ.'
 where key = 'home.styles.list';

-- O chu nho cho phan luoi cuoi. Them moi nen dung insert ... on conflict.
insert into site_content (key, page, label, hint, kind, value, sort_order)
values (
  'home.styles.more_eyebrow', 'trang-chu',
  'Chữ nhỏ trên lưới phong cách cuối trang',
  'Hiện phía trên nhóm ô nhỏ ở cuối phần phong cách',
  'text', 'Còn nữa', 995
)
on conflict (key) do nothing;
