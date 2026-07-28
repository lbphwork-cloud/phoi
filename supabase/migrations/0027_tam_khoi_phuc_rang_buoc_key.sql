-- =============================================================================
-- TAM KHOI PHUC rang buoc cu cua ai_credentials
--
-- DAY LA MOT MIGRATION SUA LOI TRINH TU, VA LOI DO LA CUA TOI.
--
-- Migration 0026 bo rang buoc unique (owner_id, provider) de mo duong cho hai
-- key rieng — mot de viet chu, mot de dung anh. Ma nguon cua hai ham may chu
-- da duoc sua theo. NHUNG hai ham dang CHAY tren Supabase van la ban cu, va
-- ban cu ghi bang `on_conflict=owner_id,provider`.
--
-- Postgres doi ON CONFLICT (a, b) phai co mot chi muc duy nhat dung tren (a, b).
-- Bo chi muc do di ma chua trien khai ham moi nghia la MOI LAN LUU API KEY DEU
-- THAT BAI tren website that.
--
-- Thu tu dung phai la: trien khai ham truoc, doi database sau. Toi lam nguoc.
--
-- NEN O DAY QUAY VE TRANG THAI CU.
--   Cot `purpose` GIU LAI — no khong lam hong gi, mac dinh 'text', va ham cu
--   khong dong den no. Giu lai de khi trien khai duoc ham thi chi can dat lai
--   rang buoc, khong phai chuyen du lieu lan nua.
--
--   Doi lai: tam thoi moi nha cung cap van chi mot key. Do la dung trang thai
--   truoc khi co yeu cau nay — khong ai mat gi so voi hom qua.
--
-- BUOC TIEP THEO, khi da co SUPABASE_ACCESS_TOKEN de trien khai ham:
--     supabase functions deploy ai-credentials
--     supabase functions deploy ai-generate
--   roi chay migration 0028 de dat lai rang buoc ba cot.
--
-- KHONG GOP HAI VIEC NAY LAM MOT. Mot migration "tu biet ham da trien khai hay
-- chua" la thu khong ton tai — database khong nhin thay duoc ham. Tach ra
-- thanh hai buoc ro rang, moi buoc chay duoc mot minh, la cach duy nhat dung.
-- =============================================================================

-- Neu da co du lieu voi purpose = 'image' thi phai don truoc, neu khong rang
-- buoc hai cot se tu choi. Hien tai chua the co dong nao nhu vay (ham cu khong
-- ghi purpose), nhung kiem tra van re hon la doan.
delete from ai_credentials a
 where a.purpose = 'image'
   and exists (
     select 1 from ai_credentials b
      where b.owner_id = a.owner_id and b.provider = a.provider
        and b.purpose = 'text'
   );

alter table ai_credentials
  drop constraint if exists ai_credentials_owner_provider_purpose_key;

alter table ai_credentials
  add constraint ai_credentials_owner_id_provider_key
  unique (owner_id, provider);
