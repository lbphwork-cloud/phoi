-- ============================================================================
-- PHOI — 0004_storage.sql
-- Bucket luu anh + policy.
--
-- Gioi han dinh dang va dung luong duoc dat o CAP BUCKET, khong phai o
-- frontend. Frontend kiem tra them chi de bao loi som cho nguoi dung, nhung
-- lop chan thuc su nam o day.
--
-- Quy uoc duong dan: {user_id}/{ten-file}
-- Nho quy uoc nay ma policy chi can so sanh thu muc dau tien voi auth.uid().
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Anh dai dien cua set do. Anh lon, cho phep 5MB.
  ('outfit-images', 'outfit-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),

  -- Anh san pham, thuong nho hon. 2MB.
  ('product-images', 'product-images', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),

  -- Anh dai dien nguoi dung. 1MB.
  ('avatars', 'avatars', true, 1048576,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- POLICY
-- Doc: cong khai, vi day la anh hien tren trang cong khai.
-- Ghi: chi trong thu muc mang ten user_id cua chinh minh.
-- ---------------------------------------------------------------------------

drop policy if exists storage_public_read       on storage.objects;
drop policy if exists storage_insert_own_folder on storage.objects;
drop policy if exists storage_update_own_folder on storage.objects;
drop policy if exists storage_delete_own_folder on storage.objects;

create policy storage_public_read on storage.objects
  for select
  using (bucket_id in ('outfit-images', 'product-images', 'avatars'));

create policy storage_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('outfit-images', 'product-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_update_own_folder on storage.objects
  for update to authenticated
  using (
    bucket_id in ('outfit-images', 'product-images', 'avatars')
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

create policy storage_delete_own_folder on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('outfit-images', 'product-images', 'avatars')
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
