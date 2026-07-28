-- =============================================================================
-- MOI PHONG CACH DU TAM SET DO, MAU CHU DAO TRAI DEU NAM HANH
--
-- VI SAO CAN
--   Tinh nang "uu tien mau hop menh" chi kiem chung duoc khi danh muc co du
--   mau. Hien tai Workwear khong con bai nao, Vintage va The thao moi mot bai —
--   bam nut uu tien thi khong co gi de day len, va khong ai biet no co chay
--   hay khong.
--
--   Chu website can 8 bai moi phong cach de THU: bam nut phai thay thu tu doi
--   ro rang. Muon vay thi mau chu dao cua 8 bai do phai trai qua ca nam hanh,
--   khong duoc chum vao mot nhom.
--
-- MAU CHON THEO HANH, KHONG CHON NGAU NHIEN
--   Bang mau moi mau thuoc mot hanh (kim/moc/thuy/hoa/tho). Migration nay xoay
--   vong qua nam hanh khi tao bai, nen tam bai cua mot phong cach chac chan
--   phu het nam hanh — du de moi nien menh deu co bai duoc uu tien va bai bi
--   day xuong.
--
-- ANH BAI LAY TU MON DAU TIEN
--   Khong dung AI (chu website dang gan het han muc, va phan lon anh san pham
--   van la o vuong xam nen dung ra cung khong giong gi). Anh cua mon dau tien
--   la thu that nhat dang co.
--
--   Bai nao khong tim duoc mon co anh thi KHONG TAO — mot the trong tren trang
--   chu con te hon mot phong cach it bai. Do dung la bai hoc cua 0034.
--
-- CHAY LAI DUOC NHIEU LAN
--   Dem so bai hien co roi chi tao phan con thieu. Chay lai lan hai khong tao
--   them gi, va khong dung vao bai that nao.
-- =============================================================================

do $$
declare
  v_style      record;
  v_can        int;
  i            int;
  v_outfit_id  uuid;
  v_slug       text;
  v_title      text;
  v_hanh       text;
  v_mau        text[];
  v_ao         record;
  v_quan       record;
  v_giay       record;
  v_phu        record;
  v_anh        text;
  v_dip        text;
  -- Nam hanh, xoay vong de tam bai cua mot phong cach phu het.
  v_hanh_list  text[] := array['kim', 'moc', 'thuy', 'hoa', 'tho'];
begin
  for v_style in
    select s.slug, s.label,
           (select count(*) from outfits o where o.style_slug = s.slug) as dang_co
      from styles s order by s.sort_order
  loop
    v_can := 8 - v_style.dang_co;
    if v_can <= 0 then continue; end if;

    for i in 1..v_can loop
      v_hanh := v_hanh_list[((i - 1) % 5) + 1];

      /*
        HAI MAU CHU DAO: mot mau thuoc hanh dang xoay toi, mot mau trung tinh.

        Chi mot mau thi bo loc theo mau tra ve qua it bai. Hai mau — mot mau co
        va mot mau trung tinh — dung voi cach nguoi ta mac that: mot mon noi
        bat di voi mot mon trung tinh.

        `order by random()` KHONG dung o day: migration phai cho ra cung ket
        qua moi lan chay. Xoay theo `i` la du da dang ma van doan truoc duoc.
      */
      select array_agg(slug) into v_mau from (
        select slug from colors
         where element = v_hanh::ngu_hanh and parent_slug is null
         order by sort_order
         offset ((i - 1) % greatest(1, (select count(*) from colors
                                         where element = v_hanh::ngu_hanh and parent_slug is null)))
         limit 1
      ) x;

      select array_append(v_mau, slug) into v_mau from (
        select slug from colors
         where slug in ('trang', 'den', 'xam-nhat', 'be', 'kem')
         order by sort_order
         offset ((i - 1) % 5) limit 1
      ) y;

      -- --- Cac mon: ao + quan + giay (+ mot phu kien) ------------------------
      -- Xoay theo `i` de tam bai cua mot phong cach khong trung mon nhau.
      select p.id, p.image_url into v_ao
        from products p where p.category = 'ao' and p.image_url is not null
       order by p.name offset ((i + v_style.dang_co) % greatest(1,
         (select count(*) from products where category = 'ao' and image_url is not null)))
       limit 1;

      select p.id into v_quan
        from products p where p.category = 'quan' and p.image_url is not null
       order by p.name offset ((i * 2 + v_style.dang_co) % greatest(1,
         (select count(*) from products where category = 'quan' and image_url is not null)))
       limit 1;

      select p.id into v_giay
        from products p where p.category = 'giay' and p.image_url is not null
       order by p.name offset ((i * 3) % greatest(1,
         (select count(*) from products where category = 'giay' and image_url is not null)))
       limit 1;

      select p.id into v_phu
        from products p where p.category in ('tui', 'mu', 'kinh', 'dong_ho', 'phu_kien')
                          and p.image_url is not null
       order by p.name offset ((i * 5) % greatest(1,
         (select count(*) from products
           where category in ('tui','mu','kinh','dong_ho','phu_kien') and image_url is not null)))
       limit 1;

      -- Khong du mon thi bo qua bai nay, khong tao mot bai rong.
      if v_ao.id is null or v_quan.id is null then continue; end if;
      v_anh := v_ao.image_url;
      if v_anh is null then continue; end if;

      -- Dip dung: xoay vong cho da dang, de bo loc theo dip cung co gi de loc.
      select slug into v_dip from occasions order by sort_order
       offset ((i - 1) % greatest(1, (select count(*) from occasions))) limit 1;

      v_title := v_style.label || ' — set ' || (v_style.dang_co + i);
      v_slug  := slugify_vi(v_title);

      -- Slug phai duy nhat. Chay lai migration hay trung ten thi them hau to.
      if exists (select 1 from outfits where slug = v_slug) then
        v_slug := v_slug || '-' || substr(md5(v_title || v_style.slug || i::text), 1, 6);
      end if;

      insert into outfits (
        slug, title, description, hero_image_url,
        style_slug, occasion_slug, color_slugs, status, is_seed
      ) values (
        v_slug, v_title, null, v_anh,
        v_style.slug, v_dip, v_mau, 'published', true
      )
      returning id into v_outfit_id;

      insert into outfit_items (outfit_id, product_id, role, position)
      values (v_outfit_id, v_ao.id, 'top', 0),
             (v_outfit_id, v_quan.id, 'bottom', 1);

      if v_giay.id is not null then
        insert into outfit_items (outfit_id, product_id, role, position)
        values (v_outfit_id, v_giay.id, 'shoes', 2);
      end if;

      if v_phu.id is not null then
        insert into outfit_items (outfit_id, product_id, role, position)
        values (v_outfit_id, v_phu.id, 'accessory', 3);
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- MO TA: sinh tu chinh cac mon, dung cong thuc cua nut "Viet tu dong".
-- Khong de trong — cot nay hien thang tren trang chi tiet.
-- ---------------------------------------------------------------------------
with mo_ta as (
  select o.id,
         string_agg(lower(trim(left(split_part(p.name, ' - ', 1), 40))), ', '
                    order by oi.position) as cac_mon,
         s.label as phong_cach, oc.label as dip
    from outfits o
    join outfit_items oi on oi.outfit_id = o.id
    join products p on p.id = oi.product_id
    left join styles s on s.slug = o.style_slug
    left join occasions oc on oc.slug = o.occasion_slug
   group by o.id, s.label, oc.label
)
update outfits o
   set description = 'Set gồm ' || m.cac_mon || '.'
                     || coalesce(' Kiểu ' || lower(m.phong_cach) || '.', '')
                     || coalesce(' Hợp khi ' || lower(m.dip) || '.', '')
  from mo_ta m
 where o.id = m.id and o.description is null;
