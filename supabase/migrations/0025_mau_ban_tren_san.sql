-- =============================================================================
-- Tach HAI KHAI NIEM MAU khac nhau cua mot mon do
--
-- HAI THU NAY TU TRUOC DEN GIO BI GOP LAM MOT, VA CHUNG KHONG PHAI MOT.
--
--   1. MAU DUNG TRONG SET NAY  (outfit_items.color_slug — da co tu dau)
--      Cai ao mau trang, va set do nay phoi cai ao TRANG do voi quan den.
--      Chi MOT mau. Day la thu di vao bo loc va vao phep tinh hop menh — noi
--      "set nay co mau trang" thi phai la mau that su xuat hien trong set.
--
--   2. MAU CO BAN TREN SAN       (products.available_color_slugs — them o day)
--      Chinh cai link do ban cai ao trong nam mau: trang, den, be, navy, xam.
--      NHIEU mau. Day la thong tin ve gian hang, khong phai ve set do.
--
--   Gop hai thu lam mot thi hong ca hai dau: hoac bo loc "mau trang" tra ve
--   nhung set khong he co mau trang, hoac nguoi mua khong biet mon do con mau
--   nao khac de chon.
--
-- VI SAO DAT TREN `products` CHU KHONG TREN `outfit_items`
--   Danh sach mau co ban la thuoc tinh cua CAI LINK, khong phai cua lan phoi
--   do. Cung mot san pham duoc ba set do khac nhau dung thi danh sach mau van
--   la mot. Dat tren outfit_items se phai luu ba lan va co ngay ba ban lech
--   nhau.
--
-- KHONG DAT RANG BUOC KHOA NGOAI SANG BANG colors
--   Postgres khong cho khoa ngoai tu mot mang. Thay vao do la mot rang buoc
--   kiem tra: moi phan tu phai la mot slug co that trong bang colors. Nho vay
--   khong the luu mot mau khong ton tai, ma van luu duoc nhieu mau mot o.
-- =============================================================================

alter table products
  add column if not exists available_color_slugs text[] not null default '{}';

comment on column products.available_color_slugs is
  'Cac mau ma chinh link ban tren san dang co. Khac voi outfit_items.color_slug '
  '— cot do la mau thuc su duoc dung trong mot set do cu the.';

-- Moi phan tu phai la mot mau co that. Mang rong luon hop le.
create or replace function has_valid_color_slugs(slugs text[])
returns boolean
language sql
stable
as $$
  select coalesce(
    (select bool_and(exists (select 1 from colors c where c.slug = s))
       from unnest(slugs) as s),
    true
  );
$$;

alter table products drop constraint if exists products_available_colors_valid;
alter table products add constraint products_available_colors_valid
  check (has_valid_color_slugs(available_color_slugs));

-- Cot moi phai nam trong quyen ghi cua nguoi dang bai, giong cac cot khac cua
-- products. Quyen cap cot duoc dat o 0002; them cot moi thi phai cap lai, neu
-- khong nguoi dung se nhan loi "permission denied for column" ma khong hieu vi
-- sao — cot vua them ra khong ai ghi duoc.
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
     where table_name = 'products' and privilege_type = 'UPDATE'
       and grantee = 'authenticated'
  ) then
    execute 'grant update (available_color_slugs) on products to authenticated';
  end if;
end $$;
