-- =============================================================================
-- DAT LAI rang buoc ba cot cho ai_credentials — buoc con lai cua 0026/0027
--
-- CHAY MIGRATION NAY SAU KHI DA TRIEN KHAI HAI HAM MAY CHU, khong phai truoc:
--     supabase functions deploy ai-credentials
--     supabase functions deploy ai-generate
--
-- Ca hai ham do da duoc trien khai (26/07/2026) va ban dang chay ghi bang
--     on_conflict=owner_id,provider,purpose
-- Postgres doi ON CONFLICT (a, b, c) phai co mot chi muc duy nhat dung tren
-- (a, b, c). Chua co chi muc do thi MOI LAN LUU API KEY DEU THAT BAI.
--
-- Nen tu luc ham moi len den luc migration nay chay, viec luu key dang hong.
-- Do la khoang thoi gian phai ngan nhat co the — va do cung la ly do lan truoc
-- toi lam sai: 0026 bo chi muc cu TRUOC khi trien khai ham, nen huong hong bi
-- dao nguoc va keo dai nhieu ngay.
--
-- SAU MIGRATION NAY: moi nguoi dung co the giu HAI key cho cung mot nha cung
-- cap — mot de viet chu, mot de dung anh. Voi Google do la hai muc gia khac
-- han nhau: key trong du an mien phi viet chu duoc nhung han muc anh bang 0.
--
-- KHONG XOA CHI MUC CU TRUOC KHI TAO CHI MUC MOI. Tao truoc, xoa sau: giua hai
-- lenh do van luon ton tai mot chi muc phuc vu duoc ON CONFLICT cua ham cu,
-- nen khong co khe nao ma ca hai phien ban ham deu hong.
-- =============================================================================

-- Chi muc ba cot. Chua co dong 'image' nao (rang buoc hai cot dang chan) nen
-- khong the vuong trung lap o day.
alter table ai_credentials
  add constraint ai_credentials_owner_provider_purpose_key
  unique (owner_id, provider, purpose);

-- Gio moi bo chi muc hai cot — chinh no la thu dang chan nguoi dung luu key
-- thu hai cho cung mot nha cung cap.
alter table ai_credentials
  drop constraint if exists ai_credentials_owner_id_provider_key;

comment on constraint ai_credentials_owner_provider_purpose_key on ai_credentials is
  'Moi (nguoi dung, nha cung cap, muc dich) mot key. Ham ai-credentials ghi bang '
  'ON CONFLICT tren dung ba cot nay — doi thu tu hay bo cot la lam hong viec luu key.';
