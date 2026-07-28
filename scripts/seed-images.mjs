/**
 * Tao anh minh hoa cho du lieu mau, tai len Supabase Storage, roi gan vao bai.
 *
 *     npm run seed:images
 *
 * DAY LA ANH MINH HOA, KHONG PHAI ANH SAN PHAM
 *   Anh sinh ra la khoi mau truu tuong dung dung bang mau cua tung set do. Co y
 *   KHONG ve gia mot cai ao hay mot doi giay: mot buc anh trong giong anh san
 *   pham that nhung khong phai san pham that la thu de gay hieu nham cho nguoi
 *   mua. Khoi mau thi khong ai nham duoc, ma van du de xem bo cuc giao dien.
 *
 *   Cac bai nay deu co is_seed = true nen giao dien tu hien nhan "Du lieu mau".
 *
 * VI SAO KHONG DUNG KHOA SECRET
 *   Script dang nhap bang email + mat khau cua quan tri vien de lay JWT, roi
 *   tai anh len duoi duong dan {user_id}/... — dung con duong ma trinh duyet di,
 *   va dung policy da viet trong 0004_storage.sql. Khong can khoa bo qua RLS.
 *
 * VI SAO KHONG CO CHU TRONG ANH
 *   sharp dung librsvg de doc SVG, ma chu tieng Viet co dau phu thuoc font co
 *   trong may hay khong. Khong co font thi chu mat dau hoac thanh o vuong. Hinh
 *   thuan khoi mau thi chay giong nhau o moi may.
 */

import sharp from 'sharp';
import { connect, resolveConnectionString, loadEnvLocal } from './db.mjs';

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY || !EMAIL || !PASSWORD) {
  console.error(`
Thieu cau hinh. Them vao .env.local:

  SEED_ADMIN_EMAIL=...      email tai khoan quan tri
  SEED_ADMIN_PASSWORD=...   mat khau tai khoan do

Chi dung cho script nay. Xoa di sau khi chay xong cung duoc.
`.trim());
  process.exit(1);
}

/** Dang nhap lay JWT. Dung dung endpoint ma trinh duyet dung. */
async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Dang nhap that bai: ${j.error_description || j.msg}`);
  return { token: j.access_token, userId: j.user.id };
}

/** Lam sang / toi mot mau hex. t > 0 la sang len, t < 0 la toi di. */
function shift(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)))),
  );
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Anh doc cho set do: 3:4, cac khoi mau lon, nhieu khoang trong.
 *
 * Bo cuc bam theo tinh than giao dien: toi gian, nhieu khoang tho, mot diem
 * nhan lech tam thay vi can giua.
 */
function outfitSvg(hexes, seed) {
  const W = 900, H = 1200;
  const base = hexes[0] ?? '#EDE9E3';
  const accent = hexes[1] ?? shift(base, -0.35);
  const third = hexes[2] ?? shift(accent, 0.25);

  // Bien doi nho theo seed de 20 tam khong giong het nhau
  const cx = 300 + (seed % 5) * 60;
  const cy = 520 + ((seed * 7) % 5) * 55;
  const r = 210 + ((seed * 3) % 4) * 28;
  const barY = 820 + ((seed * 11) % 4) * 40;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${shift(base, 0.42)}"/>
        <stop offset="100%" stop-color="${shift(base, 0.08)}"/>
      </linearGradient>
      <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}"/>
        <stop offset="100%" stop-color="${shift(accent, -0.22)}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#a)" opacity="0.92"/>
    <rect x="${cx + r - 120}" y="${barY}" width="${W - cx - r + 120}" height="14" fill="${third}" opacity="0.75"/>
    <rect x="96" y="${H - 190}" width="180" height="3" fill="${shift(base, -0.5)}" opacity="0.5"/>
  </svg>`);
}

/** Anh san pham: vuong, mot mau chinh, mot khoi phu lech goc. */
function productSvg(hex, seed) {
  const S = 800;
  const base = hex ?? '#E4E0DA';
  const rot = (seed % 4) * 90;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${rot} 0.5 0.5)">
        <stop offset="0%" stop-color="${shift(base, 0.34)}"/>
        <stop offset="100%" stop-color="${shift(base, -0.12)}"/>
      </linearGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#g)"/>
    <rect x="${140 + (seed % 3) * 40}" y="${170 + (seed % 4) * 30}"
          width="${380 + (seed % 3) * 50}" height="${400 + (seed % 2) * 60}"
          rx="26" fill="${shift(base, -0.28)}" opacity="0.55"/>
  </svg>`);
}

/**
 * Anh lon cho phan mo dau va cho tung khoi phong cach.
 *
 * Dung nhieu lop hon anh san pham: nen chuyen sac, mot khoi lon lech tam, mot
 * dai ngang, mot duong manh, va mot lop toi dan o day. Ly do: hai anh nay
 * chiem gan het man hinh va co CHU DE LEN TREN. Mot o mau phang o kich thuoc
 * do trong nhu trang loi, va chu trang tren nen sang thi khong doc duoc.
 *
 * Lop toi o day anh cung chinh la thu giup chu luon doc duoc ma khong phai
 * doan xem anh sang hay toi.
 */
function editorialSvg(hexes, w, h, seed) {
  const base = hexes[0] ?? '#E8E4DC';
  const accent = hexes[1] ?? shift(base, -0.4);
  const third = hexes[2] ?? shift(base, 0.3);

  const cx = w * (0.34 + ((seed % 5) * 0.07));
  const cy = h * (0.38 + ((seed * 3) % 4) * 0.06);
  const r = Math.min(w, h) * (0.34 + ((seed * 7) % 3) * 0.05);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%"   stop-color="${shift(base, 0.45)}"/>
        <stop offset="55%"  stop-color="${shift(base, 0.12)}"/>
        <stop offset="100%" stop-color="${shift(base, -0.18)}"/>
      </linearGradient>
      <radialGradient id="blob" cx="40%" cy="35%" r="72%">
        <stop offset="0%"   stop-color="${shift(accent, 0.28)}"/>
        <stop offset="100%" stop-color="${shift(accent, -0.24)}"/>
      </radialGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="55%"  stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.28"/>
      </linearGradient>
    </defs>

    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.12}" ry="${r}" fill="url(#blob)" opacity="0.9"/>
    <rect x="${w * 0.58}" y="${h * 0.14}" width="${w * 0.34}" height="${h * 0.52}"
          fill="${third}" opacity="0.3"/>
    <rect x="0" y="${h * 0.72}" width="${w}" height="1.5" fill="${shift(base, -0.45)}" opacity="0.35"/>
    <rect x="${w * 0.08}" y="${h * 0.82}" width="${w * 0.12}" height="2" fill="${shift(base, -0.55)}" opacity="0.5"/>
    <rect width="${w}" height="${h}" fill="url(#fade)"/>
  </svg>`);
}

/** Tai mot file len Storage bang JWT cua nguoi dung. */
async function upload(bucket, path, buf, token) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`Upload ${path} that bai: ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function main() {
  /*
    --thieu: CHI lam nhung gi dang thieu anh.

    Vi sao can: mac dinh script nay tao lai anh cho MOI du lieu mau. Sau khi
    them mon moi, chay lai bang mac dinh se ghi de anh cua toan bo 60 mon va
    72 set — trong do co nhung set dang lay anh tu mon dau tien (cach 0038 lam)
    chu khong phai anh khoi mau. Chay lai se lam mat cach hien do ma khong ai
    yeu cau.
  */
  const chiThieu = process.argv.includes('--thieu');

  const { token, userId } = await signIn();
  console.log(`Dang nhap OK — ${userId}${chiThieu ? ' — chi lam phan dang thieu' : ''}`);

  const { client } = await connect(resolveConnectionString([]));
  const q = async (s, p) => (await client.query(s, p)).rows;

  const colors = new Map((await q('select slug, hex from colors')).map((r) => [r.slug, r.hex]));

  // ---- Anh cho 20 set do -------------------------------------------------
  const outfits = await q(
    `select id, slug, color_slugs from outfits
      where is_seed ${chiThieu ? "and coalesce(hero_image_url, '') = ''" : ''}
      order by slug`,
  );
  console.log(`\nTao anh cho ${outfits.length} set do...`);

  for (const [i, o] of outfits.entries()) {
    const hexes = (o.color_slugs ?? []).map((s) => colors.get(s)).filter(Boolean);
    const webp = await sharp(outfitSvg(hexes, i)).webp({ quality: 82 }).toBuffer();
    const url = await upload('outfit-images', `${userId}/set-${o.slug}.webp`, webp, token);
    await client.query('update outfits set hero_image_url = $1 where id = $2', [url, o.id]);
    process.stdout.write(`  ${i + 1}/${outfits.length}\r`);
  }
  console.log(`  ${outfits.length}/${outfits.length} — xong`);

  // ---- Anh cho 45 san pham ----------------------------------------------
  const products = await q(
    `select id, color_slug, category from products
      where is_seed ${chiThieu ? "and coalesce(image_url, '') = ''" : ''}
      order by id`,
  );
  console.log(`\nTao anh cho ${products.length} san pham...`);

  for (const [i, p] of products.entries()) {
    const webp = await sharp(productSvg(colors.get(p.color_slug), i))
      .webp({ quality: 80 })
      .toBuffer();
    const url = await upload('product-images', `${userId}/sp-${p.id}.webp`, webp, token);
    await client.query('update products set image_url = $1 where id = $2', [url, p.id]);
    process.stdout.write(`  ${i + 1}/${products.length}\r`);
  }
  console.log(`  ${products.length}/${products.length} — xong`);

  // ---- Link vi du -------------------------------------------------------
  // Hai link that da do duoc o phan Local Helper. Dung chung cho moi san pham
  // de bam vao con ra trang that thay vi trang tim kiem — de xem giao dien.
  // Day KHONG phai link affiliate va KHONG dung san pham; thay het khi audit.
  const DEMO = [
    'https://vn.shp.ee/PNqCvjDn',
    'https://vn.shp.ee/MZrB8qhn',
  ];
  const links = await q('select id from affiliate_links where is_seed order by id');
  for (const [i, l] of links.entries()) {
    await client.query('update affiliate_links set url = $1 where id = $2', [
      DEMO[i % DEMO.length],
      l.id,
    ]);
  }
  console.log(`\nDoi ${links.length} link mau sang 2 link Shopee that.`);

  // ---- Anh mo dau trang chu (21:9) va anh tung phong cach (4:5) ---------
  // Ghi vao site_content de quan tri vien thay chung trong /admin/noi-dung va
  // doi duoc bang tay sau nay.
  console.log('\nTao anh mo dau va anh cac phong cach...');

  const styleRows = await q('select slug, label, sort_order from styles order by sort_order');

  // Bang mau chung cho anh mo dau: lay mau hay gap nhat trong cac set do.
  const topColors = await q(`
    select c.hex
      from outfits o, unnest(o.color_slugs) cs
      join colors c on c.slug = cs
     where o.is_seed
     group by c.hex
     order by count(*) desc
     limit 3`);

  const heroBuf = await sharp(editorialSvg(topColors.map((r) => r.hex), 2400, 1030, 1))
    .webp({ quality: 84 })
    .toBuffer();
  const heroUrl = await upload('outfit-images', `${userId}/trang-chu-hero.webp`, heroBuf, token);
  await client.query("update site_content set value = $1 where key = 'home.hero.image'", [heroUrl]);
  console.log('  mo dau 2400x1030 — xong');

  for (const [i, s] of styleRows.entries()) {
    // Bang mau rieng cua tung phong cach, lay tu chinh cac set do thuoc no.
    const pal = await q(
      `select c.hex
         from outfits o, unnest(o.color_slugs) cs
         join colors c on c.slug = cs
        where o.style_slug = $1
        group by c.hex
        order by count(*) desc
        limit 3`,
      [s.slug],
    );

    const buf = await sharp(editorialSvg(pal.map((r) => r.hex), 1200, 1500, i + 2))
      .webp({ quality: 82 })
      .toBuffer();

    const url = await upload('outfit-images', `${userId}/phong-cach-${s.slug}.webp`, buf, token);
    await client.query('update site_content set value = $1 where key = $2', [
      url,
      `home.style.${s.slug}.image`,
    ]);
    process.stdout.write(`  phong cach ${i + 1}/${styleRows.length}\r`);
  }
  console.log(`  phong cach ${styleRows.length}/${styleRows.length} — xong`);

  const [c] = await q(`
    select (select count(*) from outfits  where hero_image_url <> '')::int as set_co_anh,
           (select count(*) from products where image_url     <> '')::int as sp_co_anh,
           (select count(*) from site_content
             where kind = 'image' and value <> '')::int as noi_dung_co_anh`);
  console.log(
    `\nKet qua: ${c.set_co_anh}/20 set do, ${c.sp_co_anh}/45 san pham, ` +
      `${c.noi_dung_co_anh} anh trong noi dung trang.`,
  );

  await client.end();
}

main().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});
