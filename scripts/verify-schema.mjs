// Chay toan bo migration tren Postgres that (PGlite/WASM) de bat loi cu phap
// va loi logic truoc khi dan vao Supabase.
//
// Truoc khi chay migration, dung mot "shim" mo phong nhung thu Supabase co san:
// schema auth, schema storage, cac role anon/authenticated, ham auth.uid().

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SUPABASE_SHIM, MIGRATIONS_DIR, migrationFiles } from './supabase-shim.mjs';

const db = new PGlite();
let failed = false;

function report(label, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed = true;
}

async function main() {
  console.log('\n=== 1. Dung shim Supabase ===');
  await db.exec(SUPABASE_SHIM);
  console.log('  [PASS] schema auth + storage + role anon/authenticated');

  console.log('\n=== 2. Chay migration theo thu tu ===');
  const files = migrationFiles();
  for (const f of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    try {
      await db.exec(sql);
      console.log(`  [PASS] ${f}`);
    } catch (e) {
      console.log(`  [FAIL] ${f}`);
      console.log('         ' + String(e.message).split('\n').join('\n         '));
      failed = true;
      // Khong the tiep tuc neu mot migration that bai
      return;
    }
  }

  console.log('\n=== 3. Kiem tra du lieu mau ===');
  const q = async (sql) => (await db.query(sql)).rows;

  const [{ n: nStyles }]    = await q(`select count(*)::int n from styles`);
  const [{ n: nColors }]    = await q(`select count(*)::int n from colors`);
  const [{ n: nOcc }]       = await q(`select count(*)::int n from occasions`);
  const [{ n: nProducts }]  = await q(`select count(*)::int n from products where is_seed`);
  const [{ n: nOutfits }]   = await q(`select count(*)::int n from outfits where is_seed`);
  const [{ n: nItems }]     = await q(`select count(*)::int n from outfit_items`);
  const [{ n: nLinks }]     = await q(`select count(*)::int n from affiliate_links where is_seed`);

  report('9 phong cach (8 goc + Pha cach)', nStyles === 9, `co ${nStyles}`);
  report('17 mau',        nColors === 17, `co ${nColors}`);
  report('8 dip su dung', nOcc === 8,     `co ${nOcc}`);
  report('45 san pham',   nProducts === 45, `co ${nProducts}`);
  report('20 set do',     nOutfits === 20,  `co ${nOutfits}`);
  report('80 dong outfit_items (20 set x 4 mon)', nItems === 80, `co ${nItems}`);
  report('45 link affiliate', nLinks === 45, `co ${nLinks}`);

  // Moi set do phai co dung 4 mon, va phai co ca bottom + shoes
  const bad = await q(`
    select o.slug, count(*)::int n,
           bool_or(oi.role = 'bottom') has_bottom,
           bool_or(oi.role = 'shoes')  has_shoes
      from outfits o join outfit_items oi on oi.outfit_id = o.id
     where o.is_seed group by o.slug having count(*) <> 4
        or not bool_or(oi.role = 'bottom') or not bool_or(oi.role = 'shoes')`);
  report('moi set du 4 mon va co quan + giay', bad.length === 0,
         bad.length ? JSON.stringify(bad) : 'tat ca 20 set hop le');

  // Khong duoc con dong nao thieu link affiliate
  const noLink = await q(`select count(*)::int n from outfit_items where affiliate_link_id is null`);
  report('moi mon deu co link affiliate', noLink[0].n === 0, `thieu ${noLink[0].n}`);

  // Trigger tinh tong gia phai chay
  const prices = await q(`
    select slug, total_price_vnd from outfits where is_seed order by total_price_vnd`);
  const nullPrice = prices.filter(p => p.total_price_vnd === null);
  report('trigger tinh tong gia da chay', nullPrice.length === 0,
         nullPrice.length ? `${nullPrice.length} set thieu gia` : `tu ${prices[0].total_price_vnd} den ${prices.at(-1).total_price_vnd} VND`);

  // Slug phai duoc sinh dung, khong dau
  const slugTest = await q(`select slugify_vi('Áo Sơ Mi Trắng Đẹp Lắm Đấy!') s`);
  report('slugify_vi bo dau tieng Viet', slugTest[0].s === 'ao-so-mi-trang-dep-lam-day',
         `-> "${slugTest[0].s}"`);

  console.log('\n=== 4. Kiem tra trigger nghiep vu ===');

  // Tao 1 admin va 1 user thuong
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('11111111-1111-1111-1111-111111111111', 'admin@phoi.test', '{"full_name":"Quan tri"}'),
      ('22222222-2222-2222-2222-222222222222', 'user@phoi.test',  '{"full_name":"Nguoi dung"}');
    update profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  `);
  const [{ n: nProf }] = await q(`select count(*)::int n from profiles`);
  report('trigger handle_new_user tao ho so', nProf === 2, `co ${nProf} ho so`);
  const [{ n: nPrefs }] = await q(`select count(*)::int n from user_preferences`);
  report('trigger tao user_preferences', nPrefs === 2, `co ${nPrefs}`);
  const [{ n: nPriv }] = await q(`select count(*)::int n from user_private`);
  report('trigger tao user_private', nPriv === 2, `co ${nPriv}`);

  // Bai cua nguoi dung thuong
  await db.exec(`
    set test.uid = '22222222-2222-2222-2222-222222222222';
    insert into outfits (slug, title, author_id, status)
    values ('bai-test', 'Bai test cua user', '22222222-2222-2222-2222-222222222222', 'draft');
  `);

  // (a) Nguoi dung thuong KHONG duoc tu dat published
  let blocked = false;
  try {
    await db.exec(`
      set test.uid = '22222222-2222-2222-2222-222222222222';
      update outfits set status = 'published' where slug = 'bai-test';
    `);
  } catch (e) {
    blocked = /Chi quan tri vien/.test(e.message);
  }
  report('user KHONG the tu dang bai cong khai', blocked,
         blocked ? 'trigger da chan' : 'LO HONG: user tu publish duoc');

  // (b) User KHONG duoc tu nang quyen len admin
  let escalationBlocked = false;
  try {
    await db.exec(`
      set test.uid = '22222222-2222-2222-2222-222222222222';
      update profiles set role = 'admin' where id = '22222222-2222-2222-2222-222222222222';
    `);
  } catch (e) {
    escalationBlocked = /Khong duoc tu thay doi quyen/.test(e.message);
  }
  report('user KHONG the tu nang quyen admin', escalationBlocked,
         escalationBlocked ? 'trigger da chan' : 'LO HONG: tu nang quyen duoc');

  // (c) Admin duyet bai qua review_outfit
  await db.exec(`
    set test.uid = '22222222-2222-2222-2222-222222222222';
    update outfits set status = 'pending' where slug = 'bai-test';
  `);
  await db.exec(`
    set test.uid = '11111111-1111-1111-1111-111111111111';
    select review_outfit((select id from outfits where slug = 'bai-test'), 'approve', 'Dep, duyet');
  `);
  const [afterApprove] = await q(`select status, published_at from outfits where slug = 'bai-test'`);
  report('admin duyet -> published', afterApprove.status === 'published',
         `status = ${afterApprove.status}`);
  const [{ n: nRev }] = await q(`select count(*)::int n from post_reviews`);
  report('review_outfit ghi post_reviews', nRev === 1, `co ${nRev} dong`);
  const [{ n: nAudit }] = await q(`select count(*)::int n from admin_audit_log`);
  report('review_outfit ghi audit log', nAudit === 1, `co ${nAudit} dong`);

  // (d) QUY TAC QUAN TRONG NHAT: sua anh bai da duyet -> tu dong ve cho duyet
  await db.exec(`
    set test.uid = '22222222-2222-2222-2222-222222222222';
    update outfits set hero_image_url = 'https://x/anh-moi.jpg' where slug = 'bai-test';
  `);
  const [afterEdit] = await q(`select status, review_note from outfits where slug = 'bai-test'`);
  report('sua anh bai da duyet -> tu dong ve pending',
         afterEdit.status === 'pending', `status = ${afterEdit.status}`);

  // (e) Them san pham vao bai da duyet -> ve cho duyet
  await db.exec(`
    set test.uid = '11111111-1111-1111-1111-111111111111';
    select review_outfit((select id from outfits where slug = 'bai-test'), 'approve', 'ok lai');
  `);
  await db.exec(`
    set test.uid = '22222222-2222-2222-2222-222222222222';
    insert into outfit_items (outfit_id, product_id, role, position)
    values ((select id from outfits where slug='bai-test'),
            (select id from products where fetched_meta->>'seed_key'='ao-thun-den'), 'top', 0);
  `);
  const [afterItem] = await q(`select status from outfits where slug = 'bai-test'`);
  report('them san pham vao bai da duyet -> ve pending',
         afterItem.status === 'pending', `status = ${afterItem.status}`);

  // (f) Doi link affiliate cua bai da duyet -> ve cho duyet
  await db.exec(`
    set test.uid = '11111111-1111-1111-1111-111111111111';
    select review_outfit((select id from outfits where slug = 'bai-test'), 'approve', 'ok nua');
    set test.uid = '22222222-2222-2222-2222-222222222222';
    insert into affiliate_links (id, product_id, owner_id, platform, url)
    values ('33333333-3333-3333-3333-333333333333',
            (select id from products where fetched_meta->>'seed_key'='ao-thun-den'),
            '22222222-2222-2222-2222-222222222222', 'shopee', 'https://shopee.vn/abc');
    update outfit_items set affiliate_link_id = '33333333-3333-3333-3333-333333333333'
     where outfit_id = (select id from outfits where slug='bai-test');
  `);
  await db.exec(`
    set test.uid = '11111111-1111-1111-1111-111111111111';
    select review_outfit((select id from outfits where slug = 'bai-test'), 'approve', 'ok lan cuoi');
    set test.uid = '22222222-2222-2222-2222-222222222222';
    update affiliate_links set url = 'https://shopee.vn/link-moi'
     where id = '33333333-3333-3333-3333-333333333333';
  `);
  const [afterLink] = await q(`select status from outfits where slug = 'bai-test'`);
  report('doi link affiliate cua bai da duyet -> ve pending',
         afterLink.status === 'pending', `status = ${afterLink.status}`);

  // (g) request_changes bat buoc co ly do
  let reasonRequired = false;
  try {
    await db.exec(`
      set test.uid = '11111111-1111-1111-1111-111111111111';
      select review_outfit((select id from outfits where slug='bai-test'), 'request_changes', '');
    `);
  } catch (e) {
    reasonRequired = /Phai nhap ly do/.test(e.message);
  }
  report('yeu cau sua bat buoc nhap ly do', reasonRequired,
         reasonRequired ? 'da chan' : 'khong chan');

  // (h) Xoa du lieu ca nhan
  await db.exec(`
    set test.uid = '22222222-2222-2222-2222-222222222222';
    update user_private set birth_date = '1998-03-15' where user_id = '22222222-2222-2222-2222-222222222222';
    select erase_my_personal_data();
  `);
  const [{ n: privLeft }] = await q(
    `select count(*)::int n from user_private where user_id='22222222-2222-2222-2222-222222222222'`);
  const [anon2] = await q(
    `select display_name from profiles where id='22222222-2222-2222-2222-222222222222'`);
  report('erase_my_personal_data xoa ngay sinh', privLeft === 0, `con ${privLeft} dong`);
  report('erase_my_personal_data khuyet danh ho so',
         anon2.display_name === 'Nguoi dung da xoa', `-> "${anon2.display_name}"`);

  console.log('\n=== 5. Kiem tra RLS ===');
  const [{ n: noRls }] = await q(`
    select count(*)::int n from pg_tables t
     where t.schemaname = 'public'
       and not exists (
         select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
          where ns.nspname='public' and c.relname=t.tablename and c.relrowsecurity)`);
  report('moi bang public deu bat RLS', noRls === 0, `${noRls} bang chua bat`);

  const [{ n: nPolicies }] = await q(
    `select count(*)::int n from pg_policies where schemaname='public'`);
  report('co policy RLS', nPolicies > 25, `${nPolicies} policy`);

  // Quyen o cap cot. Kiem tra ca hai chieu: cot bi mat phai DONG, va cot
  // hop le phai MO — de khong thu hoi qua tay lam vo ung dung.
  const colPriv = async (table, column, priv) => (await q(`
    select count(*)::int n from information_schema.column_privileges
     where table_name = '${table}' and column_name = '${column}'
       and privilege_type = '${priv}' and grantee in ('anon','authenticated')`))[0].n;

  report('ai_credentials.encrypted_key KHONG doc duoc',
         (await colPriv('ai_credentials', 'encrypted_key', 'SELECT')) === 0);
  report('ai_credentials.key_hint VAN doc duoc',
         (await colPriv('ai_credentials', 'key_hint', 'SELECT')) > 0);
  report('outfits.view_count KHONG sua duoc',
         (await colPriv('outfits', 'view_count', 'UPDATE')) === 0);
  report('outfits.published_at KHONG sua duoc',
         (await colPriv('outfits', 'published_at', 'UPDATE')) === 0);
  report('outfits.title VAN sua duoc',
         (await colPriv('outfits', 'title', 'UPDATE')) > 0);
  report('profiles.role KHONG sua duoc qua REST',
         (await colPriv('profiles', 'role', 'UPDATE')) === 0);
  report('profiles.display_name VAN sua duoc',
         (await colPriv('profiles', 'display_name', 'UPDATE')) > 0);

  // Quyen rieng cho tung role, khong gop chung. Phat hien tren database that:
  // 0002 chi thu hoi quyen SUA cot `role` chu khong thu hoi quyen DOC, nen khach
  // vang lai goi duoc /rest/v1/profiles?select=role de biet ai la admin.
  const colPrivFor = async (table, column, priv, grantee) => (await q(`
    select count(*)::int n from information_schema.column_privileges
     where table_name = '${table}' and column_name = '${column}'
       and privilege_type = '${priv}' and grantee = '${grantee}'`))[0].n;

  report('profiles.role KHONG doc duoc boi khach vang lai',
         (await colPrivFor('profiles', 'role', 'SELECT', 'anon')) === 0);
  report('profiles.display_name VAN doc duoc boi khach vang lai',
         (await colPrivFor('profiles', 'display_name', 'SELECT', 'anon')) > 0);
  report('profiles.role VAN doc duoc boi nguoi da dang nhap (giao dien can)',
         (await colPrivFor('profiles', 'role', 'SELECT', 'authenticated')) > 0);

  console.log('\n=== 6. Kiem tra link affiliate ===');

  const [ud] = await q(`
    select is_under_domain('vn.shp.ee', 'shp.ee')   a,
           is_under_domain('shp.ee', 'shp.ee')      b,
           is_under_domain('evil-shp.ee', 'shp.ee') c,
           is_under_domain('shp.ee.evil.com', 'shp.ee') d`);
  report('is_under_domain: ten mien con -> true', ud.a === true);
  report('is_under_domain: bang chinh no -> true', ud.b === true);
  report('is_under_domain: thieu dau cham -> false', ud.c === false);
  report('is_under_domain: ten mien goc o dau -> false', ud.d === false);

  const [{ h1 }] = await q(`select url_host('https://WWW.Shopee.VN:443/abc?x=1#y') h1`);
  report('url_host bo giao thuc, www, cong, query', h1 === 'shopee.vn', `-> "${h1}"`);

  // Ky thuat che ten mien bang user:pass@host
  const [{ h2 }] = await q(`select url_host('https://shopee.vn@evil.example.com/x') h2`);
  report('url_host khong bi lua boi "shopee.vn@evil.com"',
         h2 === 'evil.example.com', `-> "${h2}"`);

  const tryLink = async (url, platform, resolved) => {
    try {
      await db.exec(`
        reset test.uid;
        insert into affiliate_links (product_id, platform, url, resolved_url)
        values ((select id from products where fetched_meta->>'seed_key'='ao-thun-den'),
                '${platform}', ${JSON.stringify(url).replace(/"/g, "'")},
                ${resolved ? `'${resolved}'` : 'null'});`);
      return null;
    } catch (e) { return e.message; }
  };

  report('nhan link shopee.vn hop le',
         (await tryLink('https://shopee.vn/product-i.123.456', 'shopee')) === null);
  report('nhan link rut gon shp.ee (chua resolve)',
         (await tryLink('https://shp.ee/abc123', 'shopee')) === null);

  // Hai link THAT cua nguoi dung dung `vn.shp.ee`. Truoc khi doi sang khop theo
  // ten mien goc, database TU CHOI chinh link that nay. Phep thu duoi day khoa
  // lai hanh vi dung.
  const realLink = await tryLink('https://vn.shp.ee/PNqCvjDn', 'shopee');
  report('NHAN link that vn.shp.ee', realLink === null, realLink ?? 'ok');

  const otherRegion = await tryLink('https://th.shp.ee/xyz789', 'shopee');
  report('NHAN bien the quoc gia khac (th.shp.ee)', otherRegion === null,
         otherRegion ?? 'ok');

  const resolvedReal = await tryLink(
    'https://vn.shp.ee/MZrB8qhn', 'shopee',
    'https://shopee.vn/product/225909574/4142346280');
  report('NHAN link that sau khi resolve ve shopee.vn', resolvedReal === null,
         resolvedReal ?? 'ok');

  // Dau cham truoc ten mien goc la thu duy nhat chan duoc kieu tan cong nay
  const lookalike = await tryLink('https://evil-shp.ee/abc', 'shopee');
  report('TU CHOI evil-shp.ee (thieu dau cham truoc shp.ee)', lookalike !== null,
         lookalike ? 'da chan' : 'KHONG CHAN — LO HONG');

  const suffixTrick = await tryLink('https://shp.ee.evil.com/abc', 'shopee');
  report('TU CHOI shp.ee.evil.com', suffixTrick !== null,
         suffixTrick ? 'da chan' : 'KHONG CHAN — LO HONG');

  // Chuoi con 'shopee' khong du de duoc coi la Shopee
  const substringTrick = await tryLink('https://shopee.evil.com/abc', 'shopee');
  report('TU CHOI shopee.evil.com (chi la chuoi con)', substringTrick !== null,
         substringTrick ? 'da chan' : 'KHONG CHAN — LO HONG');

  const evil = await tryLink('https://evil.example.com/abc', 'shopee');
  report('TU CHOI ten mien ngoai Shopee/TikTok', evil !== null,
         evil ? evil.split('.')[0] : 'KHONG CHAN — LO HONG');

  const wrongPlatform = await tryLink('https://shopee.vn/abc', 'tiktok');
  report('TU CHOI khi nen tang khong khop ten mien', wrongPlatform !== null,
         wrongPlatform ? 'da chan' : 'KHONG CHAN');

  const atTrick = await tryLink('https://shopee.vn@evil.example.com/x', 'shopee');
  report('TU CHOI link che ten mien kieu user@host', atTrick !== null,
         atTrick ? 'da chan' : 'KHONG CHAN — LO HONG');

  // Cho chong open redirect: link rut gon resolve ra ngoai
  const openRedirect = await tryLink(
    'https://shp.ee/xyz', 'shopee', 'https://phishing.example.com/login');
  report('TU CHOI link rut gon chuyen huong ra ngoai (open redirect)',
         openRedirect !== null, openRedirect ? 'da chan' : 'KHONG CHAN — LO HONG');

  const okRedirect = await tryLink(
    'https://shp.ee/xyz2', 'shopee', 'https://shopee.vn/san-pham-i.1.2');
  report('NHAN link rut gon resolve ve dung shopee.vn', okRedirect === null,
         okRedirect ?? 'ok');

  // Sua url thi phai xoa ket qua resolve cu, khong tin gia tri cu
  await db.exec(`
    set test.uid = '22222222-2222-2222-2222-222222222222';
    update affiliate_links set url = 'https://shopee.vn/doi-link-khac'
     where id = '33333333-3333-3333-3333-333333333333';`);
  const [reset1] = await q(
    `select resolved_url, resolved_host from affiliate_links
      where id='33333333-3333-3333-3333-333333333333'`);
  report('doi url thi xoa ket qua resolve cu',
         reset1.resolved_url === null && reset1.resolved_host === null,
         `resolved_url = ${reset1.resolved_url}`);

  await db.exec(`reset test.uid;`);

  console.log('\n=== 7. Bang gia 20 set do ===');
  const table = await q(`
    select o.slug, s.label style, oc.label dip, o.total_price_vnd gia
      from outfits o
      left join styles s on s.slug = o.style_slug
      left join occasions oc on oc.slug = o.occasion_slug
     where o.is_seed order by o.total_price_vnd`);
  for (const r of table) {
    console.log(`  ${String(r.gia).padStart(9)} d  ${r.style.padEnd(13)} ${r.dip.padEnd(18)} ${r.slug}`);
  }

  const over = table.filter(r => r.gia > 3000000);
  report('tong gia moi set trong muc hop ly (< 3tr)', over.length === 0,
         over.length ? JSON.stringify(over.map(o => o.slug)) : 'tat ca hop le');

  console.log(failed ? '\n>>> CO LOI, xem cac dong FAIL o tren\n' : '\n>>> TAT CA PASS\n');
  process.exit(failed ? 1 : 0);
}

main().catch(e => {
  console.error('\nLOI KHONG BAT DUOC:\n', e);
  process.exit(1);
});
