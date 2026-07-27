-- =============================================================================
-- Co chu nhap bang so phan tram, thay cho nam muc chon san
--
-- VI SAO DOI
--   Nam muc cu ("Rat nho" den "Rat lon") chi trai tu 80% den 135%. Chu website
--   dat "Rat lon" cho tieu de trang chu roi van thay nho — va dai do that su
--   khong du: mot tieu de muon that su lon can 200% tro len.
--
--   Dai moi la 50–400%, kep o ca hai dau trong ma nguon nen mot con so go nham
--   khong lam vo bo cuc.
--
-- CHUYEN GIA TRI CU, KHONG BO
--   Cac o dang luu ten muc duoc doi sang so tuong duong. Ham resolveSize trong
--   ma nguon van doc duoc ca hai dang, nen ke ca dong nao sot lai cung khong
--   hong — nhung doi o day thi giao dien hien dung so, khong de nguoi dung
--   nhin thay mot o trong roi tuong minh chua dat gi.
-- =============================================================================

-- --- Kieu chu chung: doi tu o chon sang o go so ------------------------------
update site_content
   set kind = 'text',
       options = '{}',
       value = case value
                 when 'rat-nho' then '80'
                 when 'nho'     then '90'
                 when 'vua'     then '100'
                 when 'lon'     then '115'
                 when 'rat-lon' then '135'
                 else value
               end,
       hint = 'Nhập phần trăm: 100 là giữ nguyên, 200 là to gấp đôi. Nhận từ 50 đến 400.'
 where key like 'type.%.size';

-- --- Ghi de tung o: doi phan "size=" trong chuoi ma hoa ----------------------
-- Chuoi co dang "font=playfair;size=rat-lon;weight=dam". Chi phan size doi.
update site_content
   set value = replace(value, 'size=rat-nho', 'size=80')
 where kind = 'style' and value like '%size=rat-nho%';
update site_content
   set value = replace(value, 'size=rat-lon', 'size=135')
 where kind = 'style' and value like '%size=rat-lon%';
update site_content
   set value = replace(value, 'size=nho', 'size=90')
 where kind = 'style' and value like '%size=nho%';
update site_content
   set value = replace(value, 'size=vua', 'size=100')
 where kind = 'style' and value like '%size=vua%';
update site_content
   set value = replace(value, 'size=lon', 'size=115')
 where kind = 'style' and value like '%size=lon%';
