-- ============================================================================
-- PHOI — 0005_seed_taxonomy.sql
-- Tu vung chuan hoa: phong cach, mau, dip su dung.
--
-- Cot colors.element la ban do mau -> ngu hanh. Day la bang tra DUY NHAT
-- quyet dinh goi y mau theo menh; muon dieu chinh triet ly ngu hanh thi sua
-- o day, khong phai sua code.
-- ============================================================================

insert into styles (slug, label, description, sort_order) values
  ('toi-gian',     'Tối giản',     'Ít chi tiết, ít màu, đường cắt gọn.',            1),
  ('smart-casual', 'Smart casual', 'Lịch sự nhưng không cứng. Đi làm và đi chơi đều được.', 2),
  ('streetwear',   'Streetwear',   'Rộng, thoải mái, nhiều lớp.',                    3),
  ('thanh-lich',   'Thanh lịch',   'Trang trọng, form vừa sát, chất liệu mịn.',      4),
  ('co-dien',      'Cổ điển',      'Kiểu dáng bền theo thời gian, màu trung tính.',  5),
  ('vintage',      'Vintage',      'Cảm hứng cũ, denim và chất liệu thô.',           6),
  ('the-thao',     'Thể thao',     'Ưu tiên vận động và thoáng khí.',                7),
  ('workwear',     'Workwear',     'Chất liệu dày, bền, cảm giác lao động.',         8)
on conflict (slug) do update set label = excluded.label, description = excluded.description;

insert into occasions (slug, label, description, sort_order) values
  ('di-lam',       'Đi làm',           'Môi trường công sở, không quá trang trọng.', 1),
  ('di-hoc',       'Đi học',           'Thoải mái, vận động nhiều.',                 2),
  ('hen-ho',       'Hẹn hò',           'Gọn gàng, có điểm nhấn.',                    3),
  ('cuoi-tuan',    'Đi chơi cuối tuần','Tự do, thoải mái.',                          4),
  ('du-lich',      'Du lịch',          'Nhẹ, thoáng, dễ phối lại.',                  5),
  ('su-kien',      'Sự kiện',          'Tiệc, cưới hỏi, dịp trang trọng.',           6),
  ('the-thao',     'Thể thao',         'Tập luyện và vận động.',                     7),
  ('o-nha',        'Ở nhà',            'Thoải mái tối đa.',                          8)
on conflict (slug) do update set label = excluded.label, description = excluded.description;

-- Ban do mau -> ngu hanh:
--   Kim  : trắng, xám, bạc, ghi
--   Mộc  : xanh lá, olive, xanh rêu
--   Thủy : đen, xanh navy, xanh dương
--   Hỏa  : đỏ, cam, hồng, tím
--   Thổ  : vàng, nâu, be, kem
insert into colors (slug, label, hex, element, sort_order) values
  ('trang',       'Trắng',         '#F7F7F5', 'kim',  1),
  ('kem',         'Kem',           '#EDE3D4', 'tho',  2),
  ('be',          'Be',            '#D8C6A8', 'tho',  3),
  ('xam-nhat',    'Xám nhạt',      '#C6C9CE', 'kim',  4),
  ('xam-dam',     'Xám đậm',       '#585C62', 'kim',  5),
  ('den',         'Đen',           '#141414', 'thuy', 6),
  ('navy',        'Xanh navy',     '#1D2B4A', 'thuy', 7),
  ('xanh-duong',  'Xanh dương',    '#356FA8', 'thuy', 8),
  ('xanh-la',     'Xanh lá',       '#3F7A4A', 'moc',  9),
  ('olive',       'Olive',         '#6B7040', 'moc', 10),
  ('nau',         'Nâu',           '#5C4033', 'tho', 11),
  ('nau-nhat',    'Nâu nhạt',      '#A9825F', 'tho', 12),
  ('vang',        'Vàng',          '#D2A32B', 'tho', 13),
  ('do',          'Đỏ',            '#B12A2F', 'hoa', 14),
  ('cam',         'Cam',           '#CC6A2A', 'hoa', 15),
  ('hong',        'Hồng',          '#D3899A', 'hoa', 16),
  ('tim',         'Tím',           '#5B4B8A', 'hoa', 17)
on conflict (slug) do update
  set label = excluded.label, hex = excluded.hex, element = excluded.element;
