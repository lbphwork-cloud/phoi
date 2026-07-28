-- =============================================================================
-- THEM MON MAU HOA / MOC / THO, VA DUNG LAI CAC SET DE DU CA NAM MENH
--
-- LUAT MOI: PHAI HAI MAU HOP MOI TINH LA HOP MENH
--   Chu website chot rang mot set chi duoc coi la hop menh khi CA HAI mau chu
--   dao (ao va quan) deu thuoc hanh ban menh hoac hanh tuong sinh. Mot mau hop
--   mot mau khong thi khong tinh.
--
-- DEM THU TREN DU LIEU CU THI LUAT NAY KHONG DUNG DUOC
--   So bai du hai mau hop, tinh tren 72 bai dang co:
--       Thuy 49 · Moc 22 · Kim 13 · Tho 3 · HOA 0
--
--   Hoa bang khong vi trong 28 mon ao quan cua du lieu mau KHONG CO MOT MON NAO
--   mau do, cam, hong hay tim. Chi co den, xam, trang, navy, xanh duong, be,
--   kem, olive, nau.
--
--   Nguoi menh Hoa bam nut uu tien se thay man hinh trong. Tinh nang chay dung
--   luat nhung nhin nhu hong — va khong ai kiem chung duoc no.
--
-- NEN MIGRATION NAY LAM HAI VIEC
--   1. Them mon mau Hoa, Moc, Tho — deu la mau ao quan nam co that ngoai doi,
--      khong bia ra mau nao ky quac chi de lap o trong.
--   2. Chia lai ao/quan cho cac set do 0038 sinh ra, xoay vong qua nam menh, de
--      moi menh co it nhat 6 bai du hai mau hop.
--
-- KHONG DUNG VAO 19 SET DUOC DUNG BANG TAY. Chung co ten rieng va cach phoi co
-- chu dich; xao tung chung de dat mot con so la lam hong thu dang dung.
--
-- TONE TU DONG THEO SAU. Migration 0039 da dat trigger, nen doi mon la
-- color_slugs tu cap nhat — khong cau lenh nao trong file nay ghi tone bang tay.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- MON MOI
--
-- Gia nam trong khoang 150.000-700.000d dung nhu de bai. Chua co anh — buoc
-- tao anh minh hoa chay rieng bang `npm run seed:images -- --thieu`.
-- ---------------------------------------------------------------------------
insert into products (name, category, color_slug, price_vnd, is_seed) values
  -- Hoa: do, cam, hong, tim
  ('Áo thun cotton trơn đỏ gạch',        'ao',   'do-gach',    189000, true),
  ('Áo sơ mi oxford hồng nhạt',          'ao',   'hong-nhat',  329000, true),
  ('Áo polo pique đỏ đô',                'ao',   'do-do',      259000, true),
  ('Áo thun oversize tím than',          'ao',   'tim-than',   199000, true),
  ('Quần short kaki cam đất',            'quan', 'cam-dat',    239000, true),
  ('Quần jogger nỉ tím than',            'quan', 'tim-than',   289000, true),
  ('Quần chinos đỏ đô',                  'quan', 'do-do',      349000, true),
  -- Moc: xanh la
  ('Áo sơ mi linen xanh lá đậm',         'ao',   'xanh-dam',   359000, true),
  ('Áo thun cotton trơn rêu',            'ao',   'reu',        179000, true),
  ('Quần chinos rêu',                    'quan', 'reu',        329000, true),
  ('Quần kaki ống suông xanh lá đậm',    'quan', 'xanh-dam',   339000, true),
  -- Tho: nau, vang, be
  ('Áo thun cotton trơn nâu cà phê',     'ao',   'nau-ca-phe', 189000, true),
  ('Áo sơ mi oxford vàng bơ',            'ao',   'vang-bo',    319000, true),
  ('Quần kaki nâu nhạt',                 'quan', 'nau-nhat',   319000, true),
  ('Quần âu vải tây nâu cà phê',         'quan', 'nau-ca-phe', 389000, true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- CHIA LAI AO / QUAN CHO CAC SET 0038 SINH RA
-- ---------------------------------------------------------------------------
do $$
declare
  v_o          record;
  i            int := 0;
  v_menh       text;
  v_ban        text;
  v_sinh       text;
  v_ao         uuid;
  v_quan       uuid;
  v_anh        text;
  -- Hanh duoc sinh ra boi hanh nao: menh -> hanh tuong sinh voi no.
  -- Kim <- Tho, Moc <- Thuy, Thuy <- Kim, Hoa <- Moc, Tho <- Hoa.
  v_menh_list  text[] := array['kim', 'moc', 'thuy', 'hoa', 'tho'];
begin
  for v_o in
    select o.id, o.title
      from outfits o
     where o.title like '%— set %'
       and o.is_seed
     order by o.style_slug, o.title
  loop
    v_menh := v_menh_list[(i % 5) + 1];
    v_sinh := case v_menh
                when 'kim'  then 'tho'
                when 'moc'  then 'thuy'
                when 'thuy' then 'kim'
                when 'hoa'  then 'moc'
                when 'tho'  then 'hoa'
              end;
    v_ban := v_menh;

    /*
      Chon ao va quan deu thuoc {ban menh, tuong sinh}.

      `offset` xoay theo i de tam bai cua mot menh khong dung chung mot bo ao
      quan. Khong dung `order by random()`: migration phai cho ra cung ket qua
      moi lan chay, neu khong thi khong ai doi chieu duoc.
    */
    select p.id, p.image_url into v_ao, v_anh
      from products p
      join colors c on c.slug = p.color_slug
     where p.category = 'ao'
       and c.element::text in (v_ban, v_sinh)
     order by p.name
    offset (i / 5) % greatest(1, (
       select count(*) from products p2 join colors c2 on c2.slug = p2.color_slug
        where p2.category = 'ao' and c2.element::text in (v_ban, v_sinh)))
     limit 1;

    select p.id into v_quan
      from products p
      join colors c on c.slug = p.color_slug
     where p.category = 'quan'
       and c.element::text in (v_ban, v_sinh)
       -- Ao va quan trung het mau thi set chi con MOT mau chu dao, va luat
       -- "hai mau hop" khong con kiem chung duoc gi.
       and p.color_slug is distinct from (select color_slug from products where id = v_ao)
     order by p.name
    offset (i / 5) % greatest(1, (
       select count(*) from products p2 join colors c2 on c2.slug = p2.color_slug
        where p2.category = 'quan' and c2.element::text in (v_ban, v_sinh)))
     limit 1;

    -- Khong du mon cho menh nay thi bo qua bai, khong lam hong bai dang chay.
    if v_ao is null or v_quan is null then
      i := i + 1;
      continue;
    end if;

    update outfit_items set product_id = v_ao   where outfit_id = v_o.id and role = 'top';
    update outfit_items set product_id = v_quan where outfit_id = v_o.id and role = 'bottom';

    -- Anh bai lay tu ao, dung nhu 0038. Ao moi chua co anh thi giu anh cu.
    if v_anh is not null then
      update outfits set hero_image_url = v_anh where id = v_o.id;
    end if;

    i := i + 1;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Tinh lai tone cho chac. Trigger cua 0039 da chay khi update outfit_items,
-- nhung mot cau lenh ro rang o day khien ket qua khong phu thuoc vao viec
-- trigger co ton tai hay khong.
-- ---------------------------------------------------------------------------
update outfits o
   set color_slugs = tinh_tone_outfit(o.id)
 where not o.tone_thu_cong
   and cardinality(tinh_tone_outfit(o.id)) > 0
   and o.color_slugs is distinct from tinh_tone_outfit(o.id);
