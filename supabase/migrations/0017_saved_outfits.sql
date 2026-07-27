-- =============================================================================
-- Gio hang: set do luu de mua sau
--
-- VI SAO KHONG PHAI "GIO HANG" THAT
--   PHOI khong ban hang va khong giu tien cua ai. Shopee va TikTok deu khong
--   cho them hang vao gio cua ho tu mot website ben ngoai. Nen thu duy nhat
--   lam duoc — va cung la thu nguoi dung thuc su can — la mot cho de danh dau
--   nhung set minh thich, roi mo ra bam lan luot.
--
-- GIOI HAN 20 EP O TANG NAY, KHONG CHI O GIAO DIEN
--   Giao dien la thu ai cung sua duoc bang cong cu nha phat trien. Mot vong lap
--   goi API co the nhet vao vai nghin dong trong mot phut. Trigger duoi day la
--   cho duy nhat con so 20 that su co hieu luc.
--
-- DEM SO LAN DUOC LUU
--   Luot xem de thoi phong va khong noi len y dinh. Mot nguoi bo cong luu lai
--   mot set la mot tin hieu manh hon han, va no dung duoc cho viec xep thu tu
--   goi y sau nay.
-- =============================================================================

create table if not exists saved_outfits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  outfit_id  uuid not null references outfits(id)    on delete cascade,
  created_at timestamptz not null default now(),
  -- Luu hai lan cung mot set la vo nghia, va no lam hong phep dem.
  unique (user_id, outfit_id)
);

create index if not exists saved_outfits_user_idx
  on saved_outfits (user_id, created_at desc);

alter table saved_outfits enable row level security;

-- Chi chinh chu doc va sua gio cua minh. Khong co ngoai le cho quan tri vien:
-- danh sach do thich cua mot nguoi khong phai thu can kiem duyet.
create policy saved_outfits_own on saved_outfits
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on saved_outfits from anon;

-- --- Gioi han 20 ------------------------------------------------------------
create or replace function enforce_saved_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  select count(*) into n from saved_outfits where user_id = new.user_id;

  if n >= 20 then
    raise exception
      'Giỏ đã đủ 20 set đồ. Bỏ bớt một set rồi thêm lại.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_saved_limit
  before insert on saved_outfits
  for each row execute function enforce_saved_limit();

-- --- Dem so lan duoc luu ----------------------------------------------------
alter table outfits add column if not exists save_count integer not null default 0;

create or replace function touch_save_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update outfits set save_count = save_count + 1 where id = new.outfit_id;
  elsif tg_op = 'DELETE' then
    -- greatest(...,0): mot con so am o day khong co nghia gi, va no se lam moi
    -- phep sap xep dung cot nay tro nen kho hieu.
    update outfits set save_count = greatest(save_count - 1, 0) where id = old.outfit_id;
  end if;
  return null;
end;
$$;

create trigger trg_save_count
  after insert or delete on saved_outfits
  for each row execute function touch_save_count();

-- Cot nay do trigger giu, khong ai duoc ghi thang.
revoke update (save_count) on outfits from anon, authenticated;

-- =============================================================================
-- Tac gia xoa duoc bai cua minh
--
-- Chinh sach cu chi cho xoa bai o trang thai 'draft'. Nguoi dung gui duyet mot
-- bai roi doi y thi khong con duong nao rut lai — do la ly do trang "Bai cua
-- toi" khong co nut xoa.
--
-- NGOAI LE DUY NHAT: bai bi AN VI VI PHAM. Cho xoa ca bai do thi nguoi vi pham
-- chi can bam xoa la mat dau vet kiem duyet, va bien phap an noi dung tro nen
-- vo nghia.
-- =============================================================================

drop policy if exists outfits_delete_own on outfits;
create policy outfits_delete_own on outfits
  for delete to authenticated
  using ((author_id = auth.uid() and status <> 'hidden') or is_admin());

-- --- O noi dung cho trang gio hang ------------------------------------------
insert into site_content (key, page, label, hint, kind, value, sort_order)
values
  ('cart.title', 'gio-hang', 'Tiêu đề trang giỏ hàng', '', 'text', 'Set đồ đã lưu', 1),
  ('cart.subtitle', 'gio-hang', 'Đoạn mô tả dưới tiêu đề',
   'Nên nói rõ PHỐI không bán hàng, chỉ dẫn sang sàn',
   'textarea',
   'Những set bạn đánh dấu để mua sau. Tối đa 20 set. '
   || 'PHỐI không bán hàng — mỗi món dẫn thẳng sang Shopee hoặc TikTok Shop.', 2),
  ('cart.empty', 'gio-hang', 'Chữ hiện khi giỏ trống', '', 'text',
   'Chưa có set nào trong giỏ.', 3)
on conflict (key) do nothing;

insert into site_content (key, page, label, hint, kind, value, sort_order)
select c.key || '.style', c.page, c.label || ' — kiểu chữ riêng',
       'Để trống thì ô này theo kiểu chung của cả website (nhóm Kiểu chữ).',
       'style', '', c.sort_order
  from site_content c
 where c.page = 'gio-hang' and c.kind in ('text', 'textarea')
on conflict (key) do nothing;
