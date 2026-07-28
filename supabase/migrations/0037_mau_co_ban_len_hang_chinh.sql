-- =============================================================================
-- DUA CAC MAU QUAN AO CO BAN LEN HANG CHINH, VA THEM MAU CON THIEU
--
-- LOI CUA TOI O 0035
--   Toi gom "Be" vao nhom Nau, "Ghi sang" va "Xam khoi" vao nhom Xam nhat,
--   "Navy" vao Xanh duong, "Olive" vao Xanh la. Nhin tu bang mau hoc thi dung:
--   chung la sac do cua nhung mau do.
--
--   Nhung day khong phai mot bang mau hoc, day la mot trang ban quan ao nam.
--   Be, ghi, navy, olive la MAU CO BAN cua tu do nam Viet Nam — mot nua so ao
--   so mi va quan tay tren san la mot trong bon mau do. Giau chung sau mot nut
--   xo la lam nguoi dung tim khong ra, va chu website noi dung nhu vay: "thieu
--   nhieu mau lam, vi du mau be, mau ghi".
--
--   Bai hoc: cai gi la "chinh" phai theo NGUOI DUNG NHIN, khong theo cach xep
--   loai cho dep.
--
-- SAU MIGRATION NAY
--   17 mau chinh nam hang ngang, la nhung mau ao quan hay gap nhat.
--   Cac sac do it dung hon (do do, cam dat, xanh ngoc, vang bo...) van nam
--   trong nhom xo xuong — chung co that, chi la khong phai thu bam thuong.
--
-- KHONG SLUG NAO DOI. Chi doi `parent_slug` va `sort_order`, nen moi set do va
-- san pham dang gan mau khong bi anh huong gi.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cac mau con thieu that su. Deu la mau co tren san, khong phai mau bia them.
-- ---------------------------------------------------------------------------
insert into colors (slug, label, hex, element, sort_order, parent_slug) values
  ('xanh-than',   'Xanh than',    '#232B3A', 'thuy', 60, 'navy'),
  ('xanh-dam',    'Xanh lá đậm',  '#2C4A32', 'moc',  61, 'xanh-la'),
  ('hong-nhat',   'Hồng nhạt',    '#EBC7CC', 'hoa',  62, 'hong'),
  ('tim-than',    'Tím than',     '#3A3350', 'hoa',  63, 'tim'),
  ('bac',         'Bạc',          '#B8BCC0', 'kim',  64, 'xam-nhat'),
  ('vang-dong',   'Vàng đồng',    '#9C7A3C', 'tho',  65, 'vang'),
  ('nau-ca-phe',  'Nâu cà phê',   '#4B3324', 'tho',  66, 'nau'),
  ('trang-nga',   'Trắng ngà',    '#F2EADB', 'kim',  67, 'trang')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- SAU MAU LEN HANG CHINH. Day la thay doi chinh cua migration nay.
-- ---------------------------------------------------------------------------
update colors set parent_slug = null where slug in
  ('be', 'ghi-sang', 'navy', 'olive', 'xam-dam', 'nau-nhat');

-- ---------------------------------------------------------------------------
-- Thu tu hang chinh: xep theo tong mau — trung tinh sang -> trung tinh toi ->
-- nau/be -> xanh -> mau co. Mat luot mot hang ngang thi thu tu nay doc duoc
-- ngay, khac han voi thu tu bang chu cai hay thu tu them vao.
-- ---------------------------------------------------------------------------
update colors set sort_order =  1 where slug = 'trang';
update colors set sort_order =  2 where slug = 'kem';
update colors set sort_order =  3 where slug = 'ghi-sang';
update colors set sort_order =  4 where slug = 'xam-nhat';
update colors set sort_order =  5 where slug = 'xam-dam';
update colors set sort_order =  6 where slug = 'den';
update colors set sort_order =  7 where slug = 'be';
update colors set sort_order =  8 where slug = 'nau-nhat';
update colors set sort_order =  9 where slug = 'nau';
update colors set sort_order = 10 where slug = 'navy';
update colors set sort_order = 11 where slug = 'xanh-duong';
update colors set sort_order = 12 where slug = 'olive';
update colors set sort_order = 13 where slug = 'xanh-la';
update colors set sort_order = 14 where slug = 'do';
update colors set sort_order = 15 where slug = 'cam';
update colors set sort_order = 16 where slug = 'vang';
update colors set sort_order = 17 where slug = 'hong';
update colors set sort_order = 18 where slug = 'tim';

-- "Kem" gio la mau chinh (no la mau ao thun/so mi rat pho bien).
update colors set parent_slug = null where slug = 'kem';

-- Sac do nam trong nhom, xep sau hang chinh.
update colors set sort_order = 30 where slug = 'trang-nga';
update colors set sort_order = 31 where slug = 'bac';
update colors set sort_order = 32 where slug = 'xam-khoi';
update colors set sort_order = 33 where slug = 'nau-tram';
update colors set sort_order = 34 where slug = 'nau-ca-phe';
update colors set sort_order = 35 where slug = 'xanh-than';
update colors set sort_order = 36 where slug = 'xanh-nhat';
update colors set sort_order = 37 where slug = 'xanh-bien';
update colors set sort_order = 38 where slug = 'reu';
update colors set sort_order = 39 where slug = 'xanh-dam';
update colors set sort_order = 40 where slug = 'mint';
update colors set sort_order = 41 where slug = 'xanh-ngoc';
update colors set sort_order = 42 where slug = 'do-do';
update colors set sort_order = 43 where slug = 'do-gach';
update colors set sort_order = 44 where slug = 'cam-dat';
update colors set sort_order = 45 where slug = 'vang-bo';
update colors set sort_order = 46 where slug = 'vang-dong';
update colors set sort_order = 47 where slug = 'hong-nhat';
update colors set sort_order = 48 where slug = 'tim-than';

-- Gan lai cha cho dung sau khi doi hang chinh.
update colors set parent_slug = 'be'        where slug in ('nau-tram');
update colors set parent_slug = 'nau'       where slug in ('nau-ca-phe');
update colors set parent_slug = 'navy'      where slug in ('xanh-than');
update colors set parent_slug = 'xanh-duong' where slug in ('xanh-nhat', 'xanh-bien');
update colors set parent_slug = 'olive'     where slug in ('reu');
update colors set parent_slug = 'xanh-la'   where slug in ('mint', 'xanh-ngoc', 'xanh-dam');
update colors set parent_slug = 'xam-nhat'  where slug in ('bac', 'xam-khoi');
update colors set parent_slug = 'trang'     where slug in ('trang-nga');
