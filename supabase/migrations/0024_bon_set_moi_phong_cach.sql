-- =============================================================================
-- Can moi phong cach ve dung 4 set do
--
-- HIEN TRANG (do truoc khi viet migration nay)
--   toi-gian 6 · smart-casual 3 · pha-cach 3 · streetwear 2 · thanh-lich 2
--   co-dien 2 · vintage 1 · the-thao 1 · workwear 0        -> tong 20
--   Trang chu hien 9 phong cach nhung workwear khong co bai nao: bam vao la ra
--   mot trang rong. Do la loi nang nhat trong danh sach tren.
--
-- CACH LAM: XOA 2, TAO 18.
--
-- KHONG BIA MOT SAN PHAM NAO
--   De bai co mot rang buoc cung: "Khong duoc tu bia ten, gia hoac thong tin
--   san pham." Tao 18 set moi ma nghi ra 72 mon hang khong ton tai la vi pham
--   thang rang buoc do — va te hon, no tao ra nhung dong gia co ve that nam
--   canh du lieu that.
--
--   Nen 18 set nay GHEP LAI tu 47 san pham mau da co san. Khong mot ten, mot
--   gia, mot duong dan nao duoc sinh ra o day. Cai moi duy nhat la CACH GHEP.
--
-- TEN DAT TRUNG TINH, CO Y
--   "Workwear — set 1" chu khong phai mot cai ten nghe nhu that. Chu website
--   se thay thong tin va them anh sau; mot cai ten hay se lam nguoi doc tuong
--   day la bai da hoan chinh, va se khong ai di sua no.
--
-- TAT CA DEU is_seed = true va status = 'published'
--   Giong het 20 set dang co, nen chung hien tren trang va bi cac phep kiem
--   chung dem la du lieu mau — dung nhu ban chat cua chung.
-- =============================================================================

-- --- 1. Xoa 2 set thua cua toi-gian ------------------------------------------
-- Chon hai set nay vi chung trung y nhieu nhat voi bon set con lai cua chinh
-- phong cach do. outfit_items co "on delete cascade" nen cac mon tu di theo.
delete from outfits
 where slug in ('du-lich-bien', 'olive-diu-mat')
   and is_seed;

-- --- 2. Tao 18 set con thieu -------------------------------------------------
-- Bang ke: moi dong la mot set can tao, kem dip su dung va mot so thu tu de
-- chon mon. So thu tu (`pick`) quyet dinh lay mon thu may trong kho cua tung
-- vai tro — dat lech nhau nen 18 set khong ai giong ai.
with can_them (style_slug, occasion_slug, stt, pick) as (
  values
    ('co-dien',      'di-lam',     1, 0), ('co-dien',      'su-kien',    2, 5),
    ('pha-cach',     'di-hoc',     1, 1),
    ('smart-casual', 'hen-ho',     1, 2),
    ('streetwear',   'cuoi-tuan',  1, 3), ('streetwear',   'di-hoc',     2, 8),
    ('thanh-lich',   'di-lam',     1, 4), ('thanh-lich',   'su-kien',    2, 9),
    ('the-thao',     'cuoi-tuan',  1, 5), ('the-thao',     'o-nha',      2, 10),
    ('the-thao',     'du-lich',    3, 15),
    ('vintage',      'cuoi-tuan',  1, 6), ('vintage',      'hen-ho',     2, 11),
    ('vintage',      'du-lich',    3, 16),
    ('workwear',     'di-lam',     1, 7), ('workwear',     'di-hoc',     2, 12),
    ('workwear',     'cuoi-tuan',  3, 17), ('workwear',     'du-lich',   4, 2)
),
-- Kho san pham theo tung vai tro, danh so on dinh de ket qua khong doi giua
-- cac lan chay. Lay tu chinh cac mon dang duoc dung, nen chac chan la san
-- pham that trong du lieu mau chu khong phai dong mo coi.
kho as (
  select oi.role,
         oi.product_id,
         min(oi.affiliate_link_id::text)::uuid as affiliate_link_id,
         row_number() over (partition by oi.role order by oi.product_id) - 1 as rn,
         count(*) over (partition by oi.role) as n
    from outfit_items oi
   group by oi.role, oi.product_id
),
moi as (
  insert into outfits (
    slug, title, description, style_slug, occasion_slug, color_slugs,
    status, is_seed, published_at
  )
  select
    t.style_slug || '-set-' || t.stt,
    s.label || ' — set ' || t.stt,
    'Dữ liệu mẫu. Nội dung và ảnh sẽ được thay bằng bài thật.',
    t.style_slug,
    t.occasion_slug,
    '{}'::text[],
    'published',
    true,
    now()
  from can_them t
  join styles s on s.slug = t.style_slug
  returning id, slug
)
insert into outfit_items (outfit_id, product_id, affiliate_link_id, role, position)
select m.id, k.product_id, k.affiliate_link_id, k.role, v.position
  from moi m
  join can_them t on t.style_slug || '-set-' || t.stt = m.slug
  -- Bon vai tro co dinh: ao, quan, giay, phu kien. Quan va giay la bat buoc
  -- theo phep kiem chung "moi set du 4 mon va co quan + giay".
  join (values ('top'::item_role, 0), ('bottom'::item_role, 1),
               ('shoes'::item_role, 2), ('accessory'::item_role, 3))
       as v(role, position) on true
  join kho k on k.role = v.role and k.rn = (t.pick + v.position * 3) % k.n;

-- --- 3. Tong gia do trigger tu tinh -------------------------------------------
-- Bang outfits co trigger cong tong gia tu cac mon. Cham nhe vao tung dong de
-- trigger chay lai — re hon nhieu so voi tu tinh lai o day, va khong bao gio
-- lech voi cach he thong van tinh.
update outfits set updated_at = now() where slug like '%-set-%' and is_seed;
