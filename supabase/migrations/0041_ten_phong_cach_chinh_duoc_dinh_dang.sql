-- =============================================================================
-- TEN PHONG CACH: CHINH DUOC CA CHU LAN DINH DANG
--
-- VI SAO
--   Ten phong cach nam trong bang `styles` va duoc ve thang ra trang chu. Sua
--   chu thi lam duoc o trang quan tri Phong cach, nhung DINH DANG thi khong —
--   font, co chu, do dam, mau, in hoa deu bi khoa cung theo lop `display-sm`.
--
--   Moi doan chu khac tren trang chu (tieu de, phu de, mo ta phong cach) deu co
--   mot dong trong `site_content` kem mot dong `.style` di cung, va nho vay
--   chinh duoc dinh dang ngay trong trang Noi dung. Rieng ten phong cach thi
--   khong — day la mot cho bi bo sot chu khong phai mot quyet dinh.
--
-- CACH LAM: them dong noi dung, KHONG doi bang `styles`
--   Bang `styles` van la noi giu ten chinh thuc — no duoc dung o bo loc, o
--   trang admin, trong ten set do sinh tu dong. Dong `site_content` chi ghi de
--   PHAN HIEN TREN TRANG CHU.
--
--   Gia tri mac dinh de TRONG chu khong chep ten hien tai vao. De trong thi ma
--   nguon lay ten tu bang `styles`, nen doi ten o trang Phong cach la trang chu
--   doi theo ngay. Neu chep san vao day thi tu luc do tro di co hai ban ten,
--   va sua mot ben khong con hieu luc — kieu loi rat kho lan ra.
-- =============================================================================

insert into site_content (key, page, label, hint, kind, value, sort_order)
select 'home.style.' || s.slug || '.label', 'trang-chu',
       'Phong cách ' || s.label || ' — tên hiện trên trang chủ',
       'Để trống thì lấy tên trong trang Phong cách. Nút định dạng ngay bên cạnh '
       || 'đổi được font, cỡ chữ, độ đậm, màu và in hoa.',
       'text', '', 1000 + s.sort_order * 10 - 1
  from styles s
on conflict (key) do nothing;
