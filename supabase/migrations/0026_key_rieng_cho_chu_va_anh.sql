-- =============================================================================
-- Moi tai khoan giu HAI key rieng: mot de VIET CHU, mot de DUNG ANH
--
-- VI SAO PHAI TACH
--   Voi Google, hai viec nay thuoc hai muc gia khac han nhau. Mot key trong du
--   an mien phi viet chu duoc nhung dung anh thi han muc bang 0; muon dung anh
--   phai bat thanh toan. Rat nhieu nguoi se muon giu dung the: mot key mien phi
--   cho phan chu dung hang ngay, va chi khi nao that su can anh moi dung den
--   key co tra tien.
--
--   Bang cu chi cho MOT key moi nha cung cap (unique owner_id, provider). Nguoi
--   dung phai chon: hoac de key mien phi va khong bao gio dung duoc anh, hoac
--   de key tra tien va moi lan viet mo ta cung tinh vao hoa don. Ca hai lua
--   chon deu te.
--
-- MOT KEY VAN DUNG DUOC CHO CA HAI
--   Chi can dan cung mot chuoi vao ca hai o. Tach ra la MO them lua chon, khong
--   phai bat buoc them viec.
--
-- DU LIEU CU KHONG MAT
--   Cac key da luu duoc gan purpose = 'text'. Chon 'text' chu khong phai
--   'image' vi viet chu la viec chay duoc voi goi mien phi — tuc la lua chon
--   nao cung con dung duoc thi cho no dung tiep.
-- =============================================================================

create type ai_key_purpose as enum ('text', 'image');

alter table ai_credentials
  add column if not exists purpose ai_key_purpose not null default 'text';

-- Rang buoc cu cho MOT key moi nha cung cap. Phai bo truoc khi dat cai moi,
-- neu khong lan luu key thu hai se bi tu choi ma khong ro ly do.
alter table ai_credentials drop constraint if exists ai_credentials_owner_id_provider_key;

-- Mot key cho moi (nguoi dung, nha cung cap, muc dich).
alter table ai_credentials
  add constraint ai_credentials_owner_provider_purpose_key
  unique (owner_id, provider, purpose);

comment on column ai_credentials.purpose is
  'Key nay dung de lam gi: viet chu hay dung anh. Hai viec co muc gia khac nhau '
  'nen nguoi dung thuong muon giu hai key khac nhau.';

-- Quyen cap cot: them cot moi thi phai cap lai quyen ghi, neu khong nguoi dung
-- nhan loi "permission denied for column" cho mot cot vua duoc them vao.
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
     where table_name = 'ai_credentials' and privilege_type = 'UPDATE'
       and grantee = 'authenticated'
  ) then
    execute 'grant update (purpose) on ai_credentials to authenticated';
  end if;
end $$;
