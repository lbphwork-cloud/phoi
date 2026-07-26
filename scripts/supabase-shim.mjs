/**
 * Nhung thu Supabase co san ma Postgres tran thi khong.
 *
 * VI SAO TACH RA FILE RIENG
 *   Hai script dung chung: verify-schema.mjs (kiem chung migration tren
 *   PGlite) va apply-migrations.mjs (che do --self-test). Truoc day khoi SQL
 *   nay nam trong verify-schema.mjs; de hai ban sao thi chung se lech nhau, va
 *   hau qua rat kho hieu — mot script bao PASS trong khi script kia bao FAIL
 *   tren cung mot migration.
 *
 * PHAM VI CO Y HEP
 *   Chi mo phong dung nhung gi migration cham vao: schema auth va storage, hai
 *   role anon/authenticated, ham auth.uid(), bang storage.buckets/objects, va
 *   ham storage.foldername(). Khong mo phong toan bo Supabase — muc tieu la
 *   kiem tra migration, khong phai chay lai Supabase tren may.
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';

/** Thu muc migration, tinh tu vi tri file nay — khong hardcode duong dan may. */
export const MIGRATIONS_DIR = path.resolve(
  import.meta.dirname,
  '..',
  'supabase',
  'migrations',
);

/** Danh sach file .sql, sap xep theo ten. Ten co tien to so nen sort la dung thu tu. */
export function migrationFiles(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export const SUPABASE_SHIM = `
create schema if not exists auth;
create schema if not exists storage;

-- Supabase co san hai role nay
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Bien phien de gia lap nguoi dung dang dang nhap
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
`;
