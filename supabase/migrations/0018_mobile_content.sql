-- =============================================================================
-- Noi dung rieng cho ban dien thoai
--
-- VI SAO CAN TACH
--   Anh ngang dep tren man hinh may tinh thi cat cut het nguoi tren khung doc
--   cua dien thoai. Mot tieu de bay chu vua mot dong o may tinh thi thanh bon
--   dong o dien thoai. Day khong phai chuyen tham my — day la hai khuon hinh
--   khac nhau va chung can hai noi dung khac nhau.
--
-- DE TRONG LA DUNG LAI BAN MAY TINH
--   Moi o ban dien thoai mac dinh rong. Rong nghia la "khong co gi rieng", va
--   trang tu lay noi dung cua ban may tinh. Nho vay them 60 o nay KHONG doi mot
--   ly nao tren trang cho tori khi co nguoi tu dien vao.
--
-- KHONG SINH O KIEU CHU RIENG CHO BAN DIEN THOAI
--   Font va co chu da co he so co gian theo be ngang man hinh, va bon vai tro
--   chung da lo phan do. Nhan doi ca kieu chu nua se thanh 120 o cho mot viec
--   ma he thong hien tai da lam dung.
-- =============================================================================

insert into site_content (key, page, label, hint, kind, value, options, sort_order)
select
  c.key || '.mobile',
  c.page,
  c.label || ' — bản điện thoại',
  'Để trống thì điện thoại dùng lại nội dung của bản máy tính.',
  c.kind,
  '',
  c.options,
  c.sort_order
from site_content c
where c.kind in ('text', 'textarea', 'image', 'list')
  -- Nhom "Kieu chu" la cai dat, khong phai chu hien tren trang.
  and c.page <> 'kieu-chu'
  -- Khong sinh cho chinh cac o phai sinh.
  and c.key not like '%.style'
  and c.key not like '%.mobile'
  -- Chieu cao logo la mot con so ky thuat.
  and c.key <> 'site.logo.height'
on conflict (key) do nothing;

-- Chieu cao logo tren dien thoai thi CO y nghia rieng: thanh menu dien thoai
-- thap hon, logo cao bang ban may tinh se lam thanh menu phinh ra.
insert into site_content (key, page, label, hint, kind, value, sort_order)
values (
  'site.logo.height.mobile', 'chung', 'Logo — chiều cao trên điện thoại (pixel)',
  'Để trống thì dùng lại chiều cao của bản máy tính.',
  'text', '', 4
)
on conflict (key) do nothing;
