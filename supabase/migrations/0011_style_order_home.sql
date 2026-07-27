-- =============================================================================
-- Thu tu phong cach + dua "Pha cach" len trang chu
--
-- BA VIEC, deu la DU LIEU chu khong phai cau truc:
--   1. Doi cho Smart casual va Toi gian trong bang `styles`. Cot sort_order
--      quyet dinh thu tu cua chip loc o trang Kham pha va o chon gu o trang
--      Ho so — doi o day thi ca hai trang cung doi theo.
--   2. Them `pha-cach` vao danh sach khoi phong cach hien o trang chu, va sap
--      xep lai cho khop voi thu tu moi.
--   3. Chuyen ba set do seed sang phong cach `pha-cach`, de nut cua khoi moi
--      khong dan vao mot trang trong.
--
-- VI SAO DOI SORT_ORDER BANG PHEP CONG THAY VI GAN THANG SO
--   Gan `sort_order = 2` cho toi-gian roi `= 1` cho smart-casual chi dung neu
--   hai gia tri hien tai dung la 1 va 2. Cach duoi day doi cho HAI HANG BAT KY
--   dang o dau, nen migration nay van dung neu ai do da sap xep lai truoc do.
-- =============================================================================

-- --- 1. Doi cho hai phong cach ------------------------------------------------
with pair as (
  select
    (select sort_order from styles where slug = 'toi-gian')     as toi_gian,
    (select sort_order from styles where slug = 'smart-casual') as smart_casual
)
update styles s
   set sort_order = case s.slug
                      when 'toi-gian'     then p.smart_casual
                      when 'smart-casual' then p.toi_gian
                    end
  from pair p
 where s.slug in ('toi-gian', 'smart-casual')
   and p.toi_gian is not null
   and p.smart_casual is not null;

-- --- 2. Danh sach khoi phong cach o trang chu ---------------------------------
-- Ghi de gia tri cu vi day la mot thay doi CO CHU Y do chu website yeu cau,
-- khong phai gia tri mac dinh. Chi ghi khi noi dung dung bang ban cu, de neu
-- quan tri vien da tu sap xep lai thi migration nay khong xoa cong cua ho.
update site_content
   set value = 'smart-casual, streetwear, toi-gian, co-dien, thanh-lich, pha-cach'
 where key = 'home.styles.list'
   and value = 'toi-gian, streetwear, smart-casual, co-dien, thanh-lich';

-- --- 3. Ba set do cho phong cach Pha cach -------------------------------------
-- CHON THEO NOI DUNG cua tung set, khong chon bua:
--   denim-tren-denim          — denim chong denim, kieu phoi pha luat kinh dien
--   bomber-toi-mau-buoi-toi   — mot sac den, phai tron chat lieu de khong phang
--   streetwear-oversize-...   — choi ti le rong/hep co chu y
-- Deu la du lieu seed. Quan tri vien doi lai duoc trong trang Kiem duyet.
update outfits
   set style_slug = 'pha-cach'
 where slug in (
         'denim-tren-denim',
         'bomber-toi-mau-buoi-toi',
         'streetwear-oversize-cuoi-tuan'
       )
   and is_seed = true;
