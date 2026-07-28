-- =============================================================================
-- Bu MAU CHU DAO cho cac set do dang de trong
--
-- LOI NAY DO MIGRATION 0024 CUA TOI GAY RA.
--   0024 tao 18 set do de can moi phong cach ve 4 bai, va no ghi
--   `color_slugs = '{}'` — mot mang rong. Luc do toi coi mau la thu chu website
--   se dien sau, cung voi ten va anh.
--
--   Do la mot danh gia sai, vi mau chu dao KHONG phai du lieu trang tri:
--
--     * Bo loc theo mau o trang kham pha doc thang cot nay. Set khong co mau
--       thi khong bao gio hien ra khi ai do loc theo mau.
--     * Phep tinh hop menh doi chieu tung mau trong cot nay voi nien menh cua
--       nguoi xem. Mang rong nghia la set do KHONG BAO GIO duoc tinh la hop
--       menh voi bat ky ai — no chi lang le tut hang.
--
--   Tuc la mot nua danh muc dang vo hinh voi hai tinh nang chinh cua website,
--   ma khong co thong bao loi nao.
--
-- LAY MAU TU DAU
--   Tu chinh cac mon trong set. Moi san pham da co cot `color_slug`, va mau cua
--   ca set dung ra la tap hop mau cua cac mon hop thanh no. Khong bia them mot
--   mau nao — chi gom lai thu da co.
--
-- TOI DA BA MAU
--   Mot set bon mon co the ra bon mau khac nhau, va luc do "mau chu dao" khong
--   con nghia gi — chu dao la thu noi bat, khong phai thu liet ke. Ba mau dau
--   theo thu tu vi tri cua mon trong set: ao truoc, roi quan, roi giay.
--
-- CHI DIEN VAO O DANG TRONG. Set nao da co mau thi giu nguyen — do co the la
-- lua chon co y cua nguoi dang, va mot migration khong duoc ghi de len no.
-- =============================================================================

with mau_theo_set as (
  select
    oi.outfit_id,
    -- Thu tu theo `position` chu khong phai ngau nhien: mon dau tien trong set
    -- la mon quyet dinh an tuong mau, va no phai duoc giu lai khi cat con ba.
    (array_agg(distinct p.color_slug order by p.color_slug))[1:3] as mau
  from outfit_items oi
  join products p on p.id = oi.product_id
  where p.color_slug is not null
  group by oi.outfit_id
)
update outfits o
   set color_slugs = m.mau
  from mau_theo_set m
 where o.id = m.outfit_id
   and o.color_slugs = '{}'
   and array_length(m.mau, 1) > 0;
