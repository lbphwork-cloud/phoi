-- =============================================================================
-- Bo chu "Du lieu mau" khoi phan NGUOI XEM DOC DUOC
--
-- MIGRATION 0024 CUA TOI DAT DONG NAY LAM MO TA CHO 18 SET DO:
--     "Dữ liệu mẫu. Nội dung và ảnh sẽ được thay bằng bài thật."
--
--   Luc do toi nghi day la mot ghi chu noi bo. No khong phai: cot `description`
--   hien THANG tren trang chi tiet set do, cho moi nguoi la vao trang. Nua danh
--   muc dang tu gioi thieu la hang gia.
--
-- KHONG XOA TRANG, MA VIET LAI CHO THAT
--   De trong thi trang chi tiet co mot khoang rong, va van khong noi duoc gi ve
--   set do. Thay vao do sinh mot mo ta tu CHINH CAC MON trong set — dung cong
--   thuc ma nut "Viet tu dong" o trang tao bai dang dung
--   (src/lib/outfitNaming.ts), chi viet lai bang SQL.
--
--   Mo ta sinh ra CHI NOI NHUNG GI CO TRONG DU LIEU: ten cac mon, phong cach,
--   dip dung, bang mau. Khong mot tinh tu nao ve chat lieu hay do ben — day la
--   trang gan link tiep thi, va mot loi khen khong ai kiem chung duoc thi khong
--   duoc tu dong sinh ra.
--
-- COT `is_seed` GIU NGUYEN. No khong hien ra man hinh nua nhung van dem duoc,
-- va cac phep kiem chung dang dua vao no de bao ve nhung thu that.
-- =============================================================================

with mo_ta as (
  select
    o.id,
    -- Ten cac mon, theo dung thu tu vi tri trong set. Cat bot phan ten hang bi
    -- nhoi tu khoa: lay den dau cau dau tien, toi da 40 ky tu.
    string_agg(
      lower(trim(left(split_part(p.name, ' - ', 1), 40))),
      ', ' order by oi.position
    ) as cac_mon,
    s.label as phong_cach,
    oc.label as dip
  from outfits o
  join outfit_items oi on oi.outfit_id = o.id
  join products p on p.id = oi.product_id
  left join styles s on s.slug = o.style_slug
  left join occasions oc on oc.slug = o.occasion_slug
  group by o.id, s.label, oc.label
)
update outfits o
   set description =
         'Set gồm ' || m.cac_mon || '.'
         || coalesce(' Kiểu ' || lower(m.phong_cach) || '.', '')
         || coalesce(' Hợp khi ' || lower(m.dip) || '.', '')
  from mo_ta m
 where o.id = m.id
   -- CHI sua dung nhung dong dang mang cau ghi chu do. Bai nao da co mo ta that
   -- — do nguoi dang viet hoac quan tri vien sua — thi khong duoc dong vao.
   and o.description like 'Dữ liệu mẫu.%';
