-- =============================================================================
-- Them phong cach "Pha cach"
--
-- LY DO: website nay ten la PHOI. Bay phong cach hien co deu la cong thuc an
-- toan — toi gian, smart casual, thanh lich... Thieu han cho cho nguoi co y
-- tron lech chuan, ma do moi la phan thu vi cua viec phoi do.
--
-- KHOA `pha-cach` dat o cuoi danh sach (sort_order 90) chu khong xen giua: no
-- la lua chon it nguoi chon nhat, va dat len dau se lam nguoi moi vao boi roi.
-- =============================================================================

insert into styles (slug, label, description, sort_order) values
  ('pha-cach', 'Phá cách',
   'Không theo công thức nào. Trộn chất liệu, tỉ lệ và màu lệch nhau một cách có chủ ý.',
   90)
on conflict (slug) do nothing;

-- Sinh o noi dung cho phong cach moi, giong cach 0008 lam cho cac phong cach cu.
insert into site_content (key, page, label, hint, kind, value, sort_order)
select 'home.style.' || s.slug || '.image', 'trang-chu',
       'Phong cách ' || s.label || ' — ảnh',
       'Ảnh dọc, khuyên dùng tỷ lệ 4:5', 'image', '', 1000 + s.sort_order * 10
  from styles s where s.slug = 'pha-cach'
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select 'home.style.' || s.slug || '.desc', 'trang-chu',
       'Phong cách ' || s.label || ' — mô tả',
       'Một câu ngắn hiện dưới tên phong cách',
       'text', coalesce(s.description, ''), 1000 + s.sort_order * 10 + 1
  from styles s where s.slug = 'pha-cach'
on conflict (key) do nothing;
