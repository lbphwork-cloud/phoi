-- =============================================================================
-- Giau cot profiles.role khoi khach vang lai
--
-- VAN DE PHAT HIEN KHI KIEM TRA TREN DATABASE THAT
--   File 0002 chi thu hoi quyen SUA cot `role`, khong thu hoi quyen DOC. Bang
--   `profiles` lai co policy `profiles_select_all` cho moi nguoi doc. Ket qua:
--   bat ky ai cung goi duoc
--
--       GET /rest/v1/profiles?select=role
--
--   va biet tai khoan nao la quan tri vien.
--
-- MUC DO NGHIEM TRONG: thap. Cot nay khong phai thong tin dang nhap, biet no
--   khong vao duoc tai khoan nao. Nhung no la buoc do duong cho tan cong nham
--   dich — biet dia chi nao dang la admin thi lam phishing de hon nhieu. Dong
--   lai gan nhu khong ton gi, nen dong.
--
-- VI SAO KHONG DUNG `revoke select (role)`
--   Postgres KHONG tru mot cot ra khoi quyen da cap o cap bang. Phai thu hoi ca
--   bang roi cap lai dung nhung cot duoc phep. Day chinh la loi da tung xay ra
--   voi ai_credentials.encrypted_key.
--
-- PHAM VI CO Y HEP: chi dong voi `anon` (khach chua dang nhap).
--   Role `authenticated` VAN doc duoc cot nay, vi giao dien can biet chinh minh
--   co phai admin khong (src/lib/hooks.ts doc profile.role). He qua con lai:
--   mot nguoi dung DA DANG NHAP van xem duoc role cua nguoi khac.
--
--   Dong not phan do can mot ham SECURITY DEFINER kieu my_role() va phai sua ca
--   phia ung dung. De lai cho giai doan sau, va ghi ro o day thay vi de nguoi
--   doc tuong da dong het.
-- =============================================================================

revoke select on profiles from anon;

grant select (id, display_name, avatar_url, bio, created_at, updated_at)
  on profiles to anon;
