-- ============================================================================
-- PHOI — 0006_seed_outfits.sql
-- 20 set do mau de co gi ma xem ngay tu dau.
--
-- QUAN TRONG — day la DU LIEU MAU, khong phai du lieu that:
--   * Moi dong deu co is_seed = true va hien badge "Du lieu mau" trong admin.
--   * Ten san pham la ten MO TA theo loai, khong phai ten san pham that cua
--     nguoi ban nao. Gia la khoang gia pho bien, khong phai gia niem yet that.
--   * source_url tro tori trang TIM KIEM that cua Shopee/TikTok cho loai san
--     pham do, khong phai ma san pham bi bia ra.
--   * image_url de trong. Ban tu upload anh trong admin.
--
-- Lam vay vi de bai muc 6 yeu cau "khong duoc tu bia ten, gia hoac thong tin
-- san pham". Du lieu mau phai tu to ra la du lieu mau.
--
-- Cach xoa sach du lieu mau khi khong can nua:
--   delete from outfits  where is_seed;
--   delete from products where is_seed;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 45 SAN PHAM
-- fetched_meta.seed_key la khoa noi bo de noi san pham voi set do ben duoi.
-- ---------------------------------------------------------------------------

insert into products
  (name, category, color_slug, price_vnd, price_checked_at, source_platform, source_url, is_seed, fetched_meta)
values
-- AO
('Áo thun cotton trơn trắng form regular', 'ao', 'trang',      189000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20thun%20nam%20tron%20trang',        true, '{"seed_key":"ao-thun-trang"}'),
('Áo thun cotton trơn đen form regular',   'ao', 'den',        189000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20thun%20nam%20tron%20den',          true, '{"seed_key":"ao-thun-den"}'),
('Áo thun oversize trơn kem',              'ao', 'kem',        215000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20thun%20oversize%20nam%20kem',      true, '{"seed_key":"ao-oversize-kem"}'),
('Áo polo cotton cá sấu navy',             'ao', 'navy',       295000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20polo%20nam%20navy',                true, '{"seed_key":"polo-navy"}'),
('Áo polo pique xám nhạt',                 'ao', 'xam-nhat',   279000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20polo%20nam%20xam',                 true, '{"seed_key":"polo-xam"}'),
('Áo sơ mi oxford trắng dài tay',          'ao', 'trang',      345000, now(), 'shopee', 'https://shopee.vn/search?keyword=so%20mi%20oxford%20nam%20trang',        true, '{"seed_key":"somi-oxford-trang"}'),
('Áo sơ mi linen be ngắn tay',             'ao', 'be',         359000, now(), 'shopee', 'https://shopee.vn/search?keyword=so%20mi%20linen%20nam%20ngan%20tay',    true, '{"seed_key":"somi-linen-be"}'),
('Áo sơ mi flannel kẻ nâu',                'ao', 'nau',        389000, now(), 'shopee', 'https://shopee.vn/search?keyword=so%20mi%20flannel%20nam%20ke',          true, '{"seed_key":"somi-flannel-nau"}'),
('Áo thun in graphic đen',                 'ao', 'den',        235000, now(), 'tiktok', 'https://www.tiktok.com/search?q=ao%20thun%20graphic%20nam',              true, '{"seed_key":"ao-graphic-den"}'),
('Áo hoodie nỉ bông xám đậm',              'ao', 'xam-dam',    429000, now(), 'shopee', 'https://shopee.vn/search?keyword=hoodie%20nam%20xam',                    true, '{"seed_key":"hoodie-xam"}'),
('Áo sweatshirt trơn olive',               'ao', 'olive',      399000, now(), 'shopee', 'https://shopee.vn/search?keyword=sweatshirt%20nam%20olive',              true, '{"seed_key":"sweatshirt-olive"}'),
('Áo khoác bomber nylon đen',              'ao', 'den',        559000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20bomber%20nam%20den',               true, '{"seed_key":"bomber-den"}'),
('Áo khoác denim xanh dương',              'ao', 'xanh-duong', 585000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20khoac%20denim%20nam',              true, '{"seed_key":"khoac-denim"}'),
('Áo cardigan len mỏng nâu nhạt',          'ao', 'nau-nhat',   465000, now(), 'tiktok', 'https://www.tiktok.com/search?q=cardigan%20nam%20len%20mong',            true, '{"seed_key":"cardigan-nau"}'),
('Áo thun raglan trắng phối navy',         'ao', 'trang',      225000, now(), 'shopee', 'https://shopee.vn/search?keyword=ao%20thun%20raglan%20nam',              true, '{"seed_key":"ao-raglan-trang"}'),
('Áo sơ mi denim xanh nhạt',               'ao', 'xanh-duong', 395000, now(), 'shopee', 'https://shopee.vn/search?keyword=so%20mi%20denim%20nam',                 true, '{"seed_key":"somi-denim"}'),
-- QUAN
('Quần jeans slim fit xanh đậm',           'quan', 'navy',      385000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20jeans%20nam%20slim%20fit',      true, '{"seed_key":"jeans-slim-dam"}'),
('Quần jeans straight xanh nhạt',          'quan', 'xanh-duong',399000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20jeans%20nam%20straight',        true, '{"seed_key":"jeans-straight-nhat"}'),
('Quần âu vải tây đen ống suông',          'quan', 'den',       349000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20au%20nam%20den%20ong%20suong',  true, '{"seed_key":"quan-au-den"}'),
('Quần chinos kem ống đứng',               'quan', 'kem',       329000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20chinos%20nam%20kem',            true, '{"seed_key":"chinos-kem"}'),
('Quần chinos olive',                      'quan', 'olive',     335000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20chinos%20nam%20olive',          true, '{"seed_key":"chinos-olive"}'),
('Quần short kaki be',                     'quan', 'be',        245000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20short%20kaki%20nam',            true, '{"seed_key":"short-kaki-be"}'),
('Quần jogger nỉ xám đậm',                 'quan', 'xam-dam',   275000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20jogger%20nam%20xam',            true, '{"seed_key":"jogger-xam"}'),
('Quần tây xám nhạt slim',                 'quan', 'xam-nhat',  365000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20tay%20nam%20xam%20slim',        true, '{"seed_key":"quan-tay-xam"}'),
('Quần baggy vải đen',                     'quan', 'den',       315000, now(), 'tiktok', 'https://www.tiktok.com/search?q=quan%20baggy%20nam%20den',              true, '{"seed_key":"baggy-den"}'),
('Quần short thể thao đen',                'quan', 'den',       185000, now(), 'shopee', 'https://shopee.vn/search?keyword=quan%20short%20the%20thao%20nam',      true, '{"seed_key":"short-thethao-den"}'),
-- GIAY
('Giày sneaker canvas trắng cổ thấp',      'giay', 'trang',     395000, now(), 'shopee', 'https://shopee.vn/search?keyword=sneaker%20canvas%20nam%20trang',       true, '{"seed_key":"sneaker-canvas-trang"}'),
('Giày sneaker da trắng đế cao su',        'giay', 'trang',     555000, now(), 'shopee', 'https://shopee.vn/search?keyword=sneaker%20da%20nam%20trang',           true, '{"seed_key":"sneaker-da-trang"}'),
('Giày sneaker chunky trắng xám',          'giay', 'xam-nhat',  625000, now(), 'shopee', 'https://shopee.vn/search?keyword=sneaker%20chunky%20nam',               true, '{"seed_key":"sneaker-chunky"}'),
('Giày loafer da lộn nâu',                 'giay', 'nau',       649000, now(), 'shopee', 'https://shopee.vn/search?keyword=giay%20loafer%20nam%20da%20lon',       true, '{"seed_key":"loafer-nau"}'),
('Giày derby da đen',                      'giay', 'den',       675000, now(), 'shopee', 'https://shopee.vn/search?keyword=giay%20derby%20nam%20da%20den',        true, '{"seed_key":"derby-den"}'),
('Giày sandal quai ngang đen',             'giay', 'den',       265000, now(), 'shopee', 'https://shopee.vn/search?keyword=sandal%20nam%20quai%20ngang',          true, '{"seed_key":"sandal-den"}'),
('Giày slip-on canvas đen',                'giay', 'den',       289000, now(), 'shopee', 'https://shopee.vn/search?keyword=giay%20slip%20on%20nam%20den',         true, '{"seed_key":"slipon-den"}'),
('Giày sneaker cổ cao đen',                'giay', 'den',       465000, now(), 'tiktok', 'https://www.tiktok.com/search?q=sneaker%20co%20cao%20nam%20den',        true, '{"seed_key":"sneaker-cocao-den"}'),
-- TUI
('Túi tote canvas trơn be',                'tui', 'be',         195000, now(), 'shopee', 'https://shopee.vn/search?keyword=tui%20tote%20canvas%20nam',            true, '{"seed_key":"tote-be"}'),
('Túi đeo chéo nylon đen',                 'tui', 'den',        285000, now(), 'shopee', 'https://shopee.vn/search?keyword=tui%20deo%20cheo%20nam%20den',         true, '{"seed_key":"tui-cheo-den"}'),
('Balo laptop vải chống nước đen',         'tui', 'den',        445000, now(), 'shopee', 'https://shopee.vn/search?keyword=balo%20laptop%20nam%20chong%20nuoc',   true, '{"seed_key":"balo-den"}'),
-- DONG HO
('Đồng hồ mặt tròn dây da nâu',            'dong_ho', 'nau',      585000, now(), 'shopee', 'https://shopee.vn/search?keyword=dong%20ho%20nam%20day%20da%20nau',  true, '{"seed_key":"dongho-da-nau"}'),
('Đồng hồ mặt vuông dây thép bạc',         'dong_ho', 'xam-nhat', 665000, now(), 'shopee', 'https://shopee.vn/search?keyword=dong%20ho%20nam%20day%20thep',      true, '{"seed_key":"dongho-thep-bac"}'),
-- KINH
('Kính râm gọng vuông đen',                'kinh', 'den',        225000, now(), 'shopee', 'https://shopee.vn/search?keyword=kinh%20ram%20nam%20gong%20vuong',    true, '{"seed_key":"kinh-vuong-den"}'),
('Kính râm gọng tròn kim loại bạc',        'kinh', 'xam-nhat',   245000, now(), 'shopee', 'https://shopee.vn/search?keyword=kinh%20ram%20nam%20gong%20tron',     true, '{"seed_key":"kinh-tron-bac"}'),
-- MU
('Mũ lưỡi trai trơn đen',                  'mu', 'den',          165000, now(), 'shopee', 'https://shopee.vn/search?keyword=mu%20luoi%20trai%20nam%20den',       true, '{"seed_key":"mu-luoitrai-den"}'),
('Mũ bucket vải kem',                      'mu', 'kem',          185000, now(), 'tiktok', 'https://www.tiktok.com/search?q=mu%20bucket%20nam',                   true, '{"seed_key":"mu-bucket-kem"}'),
-- PHU KIEN
('Dây lưng da đen khóa kim',               'phu_kien', 'den',    255000, now(), 'shopee', 'https://shopee.vn/search?keyword=day%20lung%20da%20nam%20den',        true, '{"seed_key":"daylung-den"}'),
('Tất cổ ngắn cotton trắng (set 3 đôi)',   'phu_kien', 'trang',  155000, now(), 'shopee', 'https://shopee.vn/search?keyword=tat%20co%20ngan%20nam%20trang',      true, '{"seed_key":"tat-trang"}');

-- ---------------------------------------------------------------------------
-- LINK AFFILIATE CHO TUNG SAN PHAM MAU
-- owner_id = null: day la du lieu mau, chua thuoc ve nguoi dang nao.
-- Khi ban co tai khoan affiliate, chi can UPDATE cot url o day.
-- ---------------------------------------------------------------------------

insert into affiliate_links (product_id, owner_id, platform, url, is_seed)
select p.id, null, p.source_platform, p.source_url, true
  from products p
 where p.is_seed
   and not exists (
     select 1 from affiliate_links a where a.product_id = p.id and a.is_seed
   );

-- ---------------------------------------------------------------------------
-- 20 SET DO
-- ---------------------------------------------------------------------------

insert into outfits
  (slug, title, description, style_slug, occasion_slug, color_slugs, status, published_at, is_seed)
values
('toi-gian-trang-den-ngay-thuong', 'Tối giản trắng đen ngày thường',
 'Ba món, hai màu. Kiểu phối không bao giờ sai và mặc được gần như mọi ngày.',
 'toi-gian', 'cuoi-tuan', array['trang','den'], 'published', now(), true),

('smart-casual-di-lam-dau-tuan', 'Smart casual đi làm đầu tuần',
 'Sơ mi oxford với quần tây xám. Lịch sự vừa đủ, không bị cứng như mặc suit.',
 'smart-casual', 'di-lam', array['trang','xam-nhat'], 'published', now(), true),

('streetwear-oversize-cuoi-tuan', 'Streetwear oversize cuối tuần',
 'Form rộng, màu trung tính. Thoải mái mà vẫn có chủ ý.',
 'streetwear', 'cuoi-tuan', array['kem','den'], 'published', now(), true),

('polo-navy-gon-gang', 'Polo navy gọn gàng',
 'Polo là điểm giữa giữa áo thun và sơ mi. Navy dễ phối hơn đen.',
 'smart-casual', 'di-lam', array['navy','kem'], 'published', now(), true),

('linen-mua-nong', 'Linen mùa nóng',
 'Linen và kaki màu sáng cho ngày trên ba mươi độ.',
 'toi-gian', 'du-lich', array['be','trang'], 'published', now(), true),

('denim-tren-denim', 'Denim trên denim',
 'Mẹo duy nhất để không bị lố: hai sắc denim phải lệch nhau rõ ràng.',
 'vintage', 'cuoi-tuan', array['xanh-duong','trang'], 'published', now(), true),

('hoodie-xam-ngay-lanh', 'Hoodie xám ngày lạnh',
 'Bộ đồ dễ nhất cho ngày trời trở lạnh mà vẫn phải ra đường.',
 'streetwear', 'di-hoc', array['xam-dam','den'], 'published', now(), true),

('thanh-lich-hen-ho-toi', 'Thanh lịch hẹn hò tối',
 'Áo thun đen với quần âu. Đơn giản nhưng chỉnh, thêm giày da là đủ.',
 'thanh-lich', 'hen-ho', array['den','nau'], 'published', now(), true),

('olive-diu-mat', 'Olive dịu mắt',
 'Olive là màu trung tính bị đánh giá thấp. Nó thay được đen mà mềm hơn.',
 'toi-gian', 'cuoi-tuan', array['olive','trang'], 'published', now(), true),

('bomber-toi-mau-buoi-toi', 'Bomber tối màu buổi tối',
 'Toàn bộ một sắc đen. Chất liệu phải khác nhau để không bị phẳng.',
 'streetwear', 'hen-ho', array['den'], 'published', now(), true),

('flannel-ke-nau-mua-thu', 'Flannel kẻ nâu mùa thu',
 'Kẻ nâu với chinos kem. Ấm mắt, phù hợp trời se lạnh.',
 'co-dien', 'cuoi-tuan', array['nau','kem'], 'published', now(), true),

('ao-khoac-denim-nang-dong', 'Áo khoác denim năng động',
 'Khoác denim là lớp ngoài dễ phối nhất. Bên trong chỉ cần áo thun trơn.',
 'vintage', 'di-hoc', array['xanh-duong','trang'], 'published', now(), true),

('graphic-tee-don-gian', 'Graphic tee đơn giản',
 'Khi áo đã có hình in thì mọi món còn lại phải trơn.',
 'streetwear', 'di-hoc', array['den','xanh-duong'], 'published', now(), true),

('cardigan-nhe-di-ca-phe', 'Cardigan nhẹ đi cà phê',
 'Cardigan mỏng thay áo khoác khi trời chỉ hơi mát.',
 'toi-gian', 'hen-ho', array['nau-nhat','trang'], 'published', now(), true),

('chinos-olive-di-lam', 'Chinos olive đi làm',
 'Chinos olive là cách thoát khỏi quần tây đen mà không mất vẻ lịch sự.',
 'smart-casual', 'di-lam', array['olive','trang'], 'published', now(), true),

('the-thao-buoi-sang', 'Thể thao buổi sáng',
 'Đủ để chạy bộ rồi ghé quán cà phê mà không phải về nhà đổi đồ.',
 'the-thao', 'the-thao', array['trang','den'], 'published', now(), true),

('polo-xam-toi-gian', 'Polo xám tối giản',
 'Xám và đen. Không có màu nào tranh chấp với màu nào.',
 'toi-gian', 'di-lam', array['xam-nhat','den'], 'published', now(), true),

('su-kien-toi-trang-trong', 'Sự kiện tối trang trọng',
 'Mức trang trọng cao nhất mà vẫn giữ được trong tầm giá dưới bảy trăm nghìn.',
 'thanh-lich', 'su-kien', array['den','trang'], 'published', now(), true),

('du-lich-bien', 'Du lịch biển',
 'Linen, kaki và một đôi giày dễ tháo. Ưu tiên nhẹ và nhanh khô.',
 'toi-gian', 'du-lich', array['trang','be'], 'published', now(), true),

('nau-be-trung-tinh', 'Nâu be trung tính',
 'Bảng màu đất từ trên xuống dưới. Trông đắt hơn giá thật của nó.',
 'co-dien', 'hen-ho', array['nau','be'], 'published', now(), true);

-- ---------------------------------------------------------------------------
-- GAN SAN PHAM VAO TUNG SET DO
-- Noi bang seed_key thay vi go lai ten day du, tranh sai chinh ta lam vo join.
-- affiliate_link_id lay dung link mau cua san pham do.
-- ---------------------------------------------------------------------------

insert into outfit_items (outfit_id, product_id, affiliate_link_id, role, position)
select o.id, p.id, a.id, m.role::item_role, m.position
from (values
  -- (outfit_slug, seed_key, role, position)
  ('toi-gian-trang-den-ngay-thuong', 'ao-thun-trang',        'top',      0),
  ('toi-gian-trang-den-ngay-thuong', 'jeans-slim-dam',       'bottom',   1),
  ('toi-gian-trang-den-ngay-thuong', 'sneaker-canvas-trang', 'shoes',    2),
  ('toi-gian-trang-den-ngay-thuong', 'mu-luoitrai-den',      'hat',      3),

  ('smart-casual-di-lam-dau-tuan',   'somi-oxford-trang',    'top',      0),
  ('smart-casual-di-lam-dau-tuan',   'quan-tay-xam',         'bottom',   1),
  ('smart-casual-di-lam-dau-tuan',   'derby-den',            'shoes',    2),
  ('smart-casual-di-lam-dau-tuan',   'dongho-da-nau',        'watch',    3),

  ('streetwear-oversize-cuoi-tuan',  'ao-oversize-kem',      'top',      0),
  ('streetwear-oversize-cuoi-tuan',  'baggy-den',            'bottom',   1),
  ('streetwear-oversize-cuoi-tuan',  'sneaker-cocao-den',    'shoes',    2),
  ('streetwear-oversize-cuoi-tuan',  'tui-cheo-den',         'bag',      3),

  ('polo-navy-gon-gang',             'polo-navy',            'top',      0),
  ('polo-navy-gon-gang',             'chinos-kem',           'bottom',   1),
  ('polo-navy-gon-gang',             'loafer-nau',           'shoes',    2),
  ('polo-navy-gon-gang',             'daylung-den',          'accessory',3),

  ('linen-mua-nong',                 'somi-linen-be',        'top',      0),
  ('linen-mua-nong',                 'short-kaki-be',        'bottom',   1),
  ('linen-mua-nong',                 'sandal-den',           'shoes',    2),
  ('linen-mua-nong',                 'mu-bucket-kem',        'hat',      3),

  ('denim-tren-denim',               'somi-denim',           'top',      0),
  ('denim-tren-denim',               'jeans-straight-nhat',  'bottom',   1),
  ('denim-tren-denim',               'sneaker-canvas-trang', 'shoes',    2),
  ('denim-tren-denim',               'kinh-tron-bac',        'glasses',  3),

  ('hoodie-xam-ngay-lanh',           'hoodie-xam',           'top',      0),
  ('hoodie-xam-ngay-lanh',           'jogger-xam',           'bottom',   1),
  ('hoodie-xam-ngay-lanh',           'sneaker-chunky',       'shoes',    2),
  ('hoodie-xam-ngay-lanh',           'balo-den',             'bag',      3),

  ('thanh-lich-hen-ho-toi',          'ao-thun-den',          'top',      0),
  ('thanh-lich-hen-ho-toi',          'quan-au-den',          'bottom',   1),
  ('thanh-lich-hen-ho-toi',          'loafer-nau',           'shoes',    2),
  ('thanh-lich-hen-ho-toi',          'dongho-da-nau',        'watch',    3),

  ('olive-diu-mat',                  'sweatshirt-olive',     'top',      0),
  ('olive-diu-mat',                  'jeans-slim-dam',       'bottom',   1),
  ('olive-diu-mat',                  'sneaker-da-trang',     'shoes',    2),
  ('olive-diu-mat',                  'tat-trang',            'accessory',3),

  ('bomber-toi-mau-buoi-toi',        'bomber-den',           'outerwear',0),
  ('bomber-toi-mau-buoi-toi',        'ao-thun-den',          'top',      1),
  ('bomber-toi-mau-buoi-toi',        'baggy-den',            'bottom',   2),
  ('bomber-toi-mau-buoi-toi',        'sneaker-cocao-den',    'shoes',    3),

  ('flannel-ke-nau-mua-thu',         'somi-flannel-nau',     'top',      0),
  ('flannel-ke-nau-mua-thu',         'chinos-kem',           'bottom',   1),
  ('flannel-ke-nau-mua-thu',         'loafer-nau',           'shoes',    2),
  ('flannel-ke-nau-mua-thu',         'mu-luoitrai-den',      'hat',      3),

  ('ao-khoac-denim-nang-dong',       'khoac-denim',          'outerwear',0),
  ('ao-khoac-denim-nang-dong',       'ao-thun-trang',        'top',      1),
  ('ao-khoac-denim-nang-dong',       'chinos-olive',         'bottom',   2),
  ('ao-khoac-denim-nang-dong',       'sneaker-canvas-trang', 'shoes',    3),

  ('graphic-tee-don-gian',           'ao-graphic-den',       'top',      0),
  ('graphic-tee-don-gian',           'jeans-straight-nhat',  'bottom',   1),
  ('graphic-tee-don-gian',           'slipon-den',           'shoes',    2),
  ('graphic-tee-don-gian',           'tote-be',              'bag',      3),

  ('cardigan-nhe-di-ca-phe',         'cardigan-nau',         'outerwear',0),
  ('cardigan-nhe-di-ca-phe',         'ao-thun-trang',        'top',      1),
  ('cardigan-nhe-di-ca-phe',         'quan-tay-xam',         'bottom',   2),
  ('cardigan-nhe-di-ca-phe',         'loafer-nau',           'shoes',    3),

  ('chinos-olive-di-lam',            'somi-oxford-trang',    'top',      0),
  ('chinos-olive-di-lam',            'chinos-olive',         'bottom',   1),
  ('chinos-olive-di-lam',            'derby-den',            'shoes',    2),
  ('chinos-olive-di-lam',            'daylung-den',          'accessory',3),

  ('the-thao-buoi-sang',             'ao-raglan-trang',      'top',      0),
  ('the-thao-buoi-sang',             'short-thethao-den',    'bottom',   1),
  ('the-thao-buoi-sang',             'sneaker-chunky',       'shoes',    2),
  ('the-thao-buoi-sang',             'tat-trang',            'accessory',3),

  ('polo-xam-toi-gian',              'polo-xam',             'top',      0),
  ('polo-xam-toi-gian',              'quan-au-den',          'bottom',   1),
  ('polo-xam-toi-gian',              'slipon-den',           'shoes',    2),
  ('polo-xam-toi-gian',              'dongho-thep-bac',      'watch',    3),

  ('su-kien-toi-trang-trong',        'somi-oxford-trang',    'top',      0),
  ('su-kien-toi-trang-trong',        'quan-au-den',          'bottom',   1),
  ('su-kien-toi-trang-trong',        'derby-den',            'shoes',    2),
  ('su-kien-toi-trang-trong',        'dongho-thep-bac',      'watch',    3),

  ('du-lich-bien',                   'somi-linen-be',        'top',      0),
  ('du-lich-bien',                   'short-kaki-be',        'bottom',   1),
  ('du-lich-bien',                   'slipon-den',           'shoes',    2),
  ('du-lich-bien',                   'kinh-vuong-den',       'glasses',  3),

  ('nau-be-trung-tinh',              'cardigan-nau',         'outerwear',0),
  ('nau-be-trung-tinh',              'ao-oversize-kem',      'top',      1),
  ('nau-be-trung-tinh',              'chinos-kem',           'bottom',   2),
  ('nau-be-trung-tinh',              'loafer-nau',           'shoes',    3)
) as m(outfit_slug, seed_key, role, position)
join outfits  o on o.slug = m.outfit_slug and o.is_seed
join products p on p.is_seed and p.fetched_meta ->> 'seed_key' = m.seed_key
left join affiliate_links a on a.product_id = p.id and a.is_seed
on conflict (outfit_id, position) do nothing;
