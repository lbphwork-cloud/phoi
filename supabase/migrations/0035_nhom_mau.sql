-- =============================================================================
-- BANG MAU: THEM SAC DO CON THIEU, VA GOM THANH NHOM
--
-- VAN DE 1 — THIEU MAU.
--   Bang cu co 17 mau, va no bo qua nhung mau rat pho bien trong thoi trang nam
--   Viet Nam: reu, xanh mint, xanh ngoc, do do, cam dat, xam khoi. Chu website
--   goi ten dung mot cai: "thieu rat nhieu mau, vi du mau reu".
--
--   Hau qua khong chi la thieu lua chon. Mau la dau vao cua BO LOC va cua PHEP
--   TINH HOP MENH. Mot cai ao mau reu bi gan thanh "olive" thi no hien sai cho
--   voi moi nguoi loc theo mau, va tinh sai hanh.
--
-- VAN DE 2 — 17 CAI CHIP MOT HANG LA MOT BUC TUONG.
--   Chon mau chu dao cho mot set do phai luot qua 17 o vuong nam ngang. Gio
--   them 12 mau nua thanh 29 — khong the de nguyen kieu do.
--
--   Nen them cot `parent_slug`: mau nao la MAU CHINH thi de trong, mau nao la
--   sac do cua mot mau chinh thi tro ve mau do. Giao dien hien 10 mau chinh,
--   bam vao mot mau moi xo ra cac sac do cua no.
--
-- VI SAO KHONG DUNG BANG RIENG CHO NHOM
--   Nhom cung la mot mau that — "Xanh la" vua la ten nhom vua la mau chon duoc.
--   Tach ra bang rieng thi phai dong bo hai noi va phai tra loi cau hoi "chon
--   nhom thi luu gi vao outfit". Mot cot tu tro la du, va no giu nguyen moi
--   thu dang chay: cac slug cu KHONG DOI, du lieu cu KHONG PHAI chuyen.
-- =============================================================================

alter table colors
  add column if not exists parent_slug text references colors(slug) on delete set null;

comment on column colors.parent_slug is
  'Mau chinh cua sac do nay. NULL = day la mot mau chinh, hien san o hang dau.';

-- ---------------------------------------------------------------------------
-- Cac mau con thieu.
--
-- Ma mau lay theo cach nguoi ban Viet Nam goi ten, khong theo bang mau quoc te:
-- "reu" o day la xanh reu tram cua ao khoac, khong phai moss green sang cua
-- bang Pantone.
--
-- HANH (ngu hanh) gan theo mau sac chu khong theo ten:
--   xanh la / reu / mint / ngoc  -> moc
--   xanh duong / navy            -> thuy
--   do / cam / hong / tim        -> hoa
--   nau / be / vang / kem        -> tho
--   trang / xam                  -> kim
-- ---------------------------------------------------------------------------
insert into colors (slug, label, hex, element, sort_order, parent_slug) values
  ('xam-khoi',    'Xám khói',     '#8E9296', 'kim',  41, 'xam-nhat'),
  ('ghi-sang',    'Ghi sáng',     '#DDE0E3', 'kim',  42, 'xam-nhat'),
  ('xanh-nhat',   'Xanh nhạt',    '#9FC1DE', 'thuy', 43, 'xanh-duong'),
  ('xanh-bien',   'Xanh biển',    '#1F6F8B', 'thuy', 44, 'xanh-duong'),
  ('reu',         'Xanh rêu',     '#4A5D3A', 'moc',  45, 'xanh-la'),
  ('mint',        'Xanh mint',    '#A8D5BA', 'moc',  46, 'xanh-la'),
  ('xanh-ngoc',   'Xanh ngọc',    '#2E8B77', 'moc',  47, 'xanh-la'),
  ('do-do',       'Đỏ đô',        '#6E1A21', 'hoa',  48, 'do'),
  ('do-gach',     'Đỏ gạch',      '#A44A3F', 'hoa',  49, 'do'),
  ('cam-dat',     'Cam đất',      '#9C5B2E', 'hoa',  50, 'cam'),
  ('nau-tram',    'Nâu trầm',     '#3E2B23', 'tho',  51, 'nau'),
  ('vang-bo',     'Vàng bơ',      '#E8D8A6', 'tho',  52, 'vang')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Gan cac mau CU vao nhom.
--
-- MAU CHINH giu nguyen thu tu 1..10 de hang dau tien khong doi cho — nguoi da
-- quen vi tri cua mau den khong phai di tim lai.
--
-- Nhung mau cu tro thanh SAC DO (kem, be, xam dam, navy, olive, nau nhat) van
-- giu nguyen slug, nen moi set do va san pham dang gan chung KHONG bi anh
-- huong gi.
-- ---------------------------------------------------------------------------
update colors set parent_slug = 'trang',      sort_order = 21 where slug = 'kem';
update colors set parent_slug = 'nau',        sort_order = 22 where slug = 'be';
update colors set parent_slug = 'xam-nhat',   sort_order = 23 where slug = 'xam-dam';
update colors set parent_slug = 'xanh-duong', sort_order = 24 where slug = 'navy';
update colors set parent_slug = 'xanh-la',    sort_order = 25 where slug = 'olive';
update colors set parent_slug = 'nau',        sort_order = 26 where slug = 'nau-nhat';

-- Muoi mau CHINH, theo thu tu tu sang den toi roi den cac mau co.
update colors set sort_order = 1  where slug = 'trang';
update colors set sort_order = 2  where slug = 'xam-nhat';
update colors set sort_order = 3  where slug = 'den';
update colors set sort_order = 4  where slug = 'nau';
update colors set sort_order = 5  where slug = 'xanh-duong';
update colors set sort_order = 6  where slug = 'xanh-la';
update colors set sort_order = 7  where slug = 'do';
update colors set sort_order = 8  where slug = 'cam';
update colors set sort_order = 9  where slug = 'vang';
update colors set sort_order = 10 where slug = 'hong';
update colors set sort_order = 11 where slug = 'tim';
