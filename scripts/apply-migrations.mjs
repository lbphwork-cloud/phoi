/**
 * Chay tat ca migration vao Supabase bang mot lenh, roi tu kiem tra ket qua.
 *
 *     npm run db:apply
 *     npm run db:apply -- --self-test      (khong can database, chay tren PGlite)
 *
 * VI SAO CO FILE NAY THAY VI DAN TAY TUNG FILE
 *   File 0003_functions.sql dai 703 dong. Boi den bang chuot rat de thieu vai
 *   dong cuoi, va loi do KHONG bao loi ngay — no chi lam thieu mot trigger, roi
 *   ba tuan sau moi phat hien bai da dang sua anh ma khong bi dua ve cho duyet.
 *   Script doc nguyen file tu dia, nen khong co kha nang thieu.
 *
 * MOI FILE LA MOT TRANSACTION
 *   Ca file duoc gui trong MOT lenh query. Postgres bao mot chuoi nhieu cau
 *   lenh gui kieu nay trong mot transaction ngam: file vao het, hoac khong vao
 *   gi. Khong bao gio con lai trang thai nua voi.
 *
 *   Tinh chat nay chi dung khi khong co cau lenh nao khong chay duoc trong
 *   transaction (`create index concurrently`, `vacuum`). Da kiem tra: khong co.
 *   Neu sau nay them, phai tach file do ra.
 *
 * CHAY LAI DUOC NHIEU LAN
 *   Cac file da chay duoc ghi vao phoi_meta.applied_migrations kem ma bam
 *   SHA-256. Chay lai thi bo qua nhung file khong doi. File doi noi dung sau
 *   khi da chay se bi BAO LOI thay vi chay lai am tham — chay lai mot migration
 *   da sua co the mat du lieu, do la quyet dinh cua nguoi, khong phai cua script.
 *
 * VI SAO BANG THEO DOI NAM O SCHEMA RIENG
 *   `phoi_meta`, khong phai `public`. De `public` giu dung so bang biet truoc — con so do
 *   duoc dung lam phep kiem tra ben duoi va trong tai lieu.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  SUPABASE_SHIM,
  MIGRATIONS_DIR,
  migrationFiles,
} from './supabase-shim.mjs';
import {
  connect,
  resolveConnectionString,
  redact,
  MISSING_DB_URL,
} from './db.mjs';

const argv = process.argv.slice(2);
const SELF_TEST = argv.includes('--self-test');

let failed = false;

function report(label, ok, detail) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed = true;
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const TRACKING = `
create schema if not exists phoi_meta;
create table if not exists phoi_meta.applied_migrations (
  filename   text primary key,
  sha256     text not null,
  applied_at timestamptz not null default now()
);
`;

/**
 * Cac phep kiem tra sau khi chay xong.
 *
 * Dung y: moi phep tra loi mot cau hoi "migration nay co thuc su vao chua",
 * khong phai "SQL co cu phap dung khong" — cu phap da duoc verify:schema lo.
 */
async function runChecks(db) {
  console.log('\n=== Kiem tra ket qua ===');

  // Toi thieu 20 bang: 18 tu 0001, site_content tu 0008, saved_outfits tu 0017,
  // roi ai_usage tu 0036 — va con them nua. Dem theo NGUONG DUOI: cai can bao
  // ve la "khong bang nao bien mat", chu mot bang moi khong phai loi. Bang theo
  // doi migration nam o schema phoi_meta nen khong tinh vao day.
  {
    const [r] = await db.rows(
      `select count(*)::int as n from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    report('0001+0008+0017 — cac bang trong schema public', r.n >= 20, `co ${r.n}`);
  }

  // 0002 — RLS. Day la phep kiem tra quan trong nhat ve bao mat: thieu no thi
  // ai cung doc va sua duoc du lieu cua nguoi khac qua REST API.
  {
    const rows = await db.rows(
      `select tablename from pg_tables
        where schemaname = 'public' and rowsecurity = false
        order by tablename`,
    );
    report(
      '0002 — Row Level Security bat tren moi bang',
      rows.length === 0,
      rows.length ? `CON TAT o: ${rows.map((r) => r.tablename).join(', ')}` : 'khong bang nao bi tat',
    );
  }

  // 0003 — thu chinh ham slugify_vi. Chon cau nay vi no bat duoc dung loi that
  // da tung xay ra: hai chuoi translate() phai dai dung 67 ky tu ca hai ben;
  // lech mot ky tu la chu "d" bien thanh "y" (ra "yep" thay vi "dep").
  {
    const [r] = await db.rows(
      `select slugify_vi('Áo Sơ Mi Trắng Đẹp Lắm Đấy') as slug`,
    );
    const want = 'ao-so-mi-trang-dep-lam-day';
    report(`0003 — slugify_vi bo dau tieng Viet`, r.slug === want, `-> "${r.slug}"`);
  }

  // 0003 — kiem tra ten mien link affiliate. Chinh la hai link that cua nguoi dung.
  {
    const [r] = await db.rows(`
      select is_allowed_affiliate_host('vn.shp.ee')      as shortlink_that,
             is_allowed_affiliate_host('shopee.vn')      as shopee,
             is_allowed_affiliate_host('shopee.evil.com') as gia_mao
    `);
    report(
      '0003 — chan ten mien gia mao, nhan ten mien that',
      r.shortlink_that === true && r.shopee === true && r.gia_mao === false,
      `vn.shp.ee=${r.shortlink_that} shopee.vn=${r.shopee} shopee.evil.com=${r.gia_mao}`,
    );
  }

  // 0004 — ba bucket anh, kem gioi han dung luong that o tang bucket
  {
    const rows = await db.rows(
      `select id, file_size_limit from storage.buckets order by id`,
    );
    const got = rows.map((r) => `${r.id}:${Math.round(Number(r.file_size_limit) / 1048576)}MB`);
    report('0004 — 3 bucket anh', rows.length === 3, got.join(' '));
  }

  // 0005 — bang tra
  {
    const [r] = await db.rows(`
      select (select count(*) from styles)::int    as styles,
             (select count(*) from colors)::int    as colors,
             (select count(*) from occasions)::int as occasions
    `);
    /*
      DEM THEO NGUONG, KHONG DEM CHINH XAC.

      Bang mau lon len theo thoi gian — 0035 them 12 sac do, va se con them.
      Mot phep kiem doi dung 17 se FAIL moi lan bang mau duoc bo sung, tuc la
      no bao dong vao dung luc du lieu duoc lam tot hon. Cai can bao ve la
      "ba bang danh muc khong bi rong", khong phai mot con so cu the.
    */
    report(
      '0005+0010 — phong cach / mau / dip deu co du lieu',
      r.styles >= 9 && r.colors >= 17 && r.occasions >= 8,
      `${r.styles} / ${r.colors} / ${r.occasions}`,
    );
  }

  // 0006 — du lieu mau
  //
  // CHI DEM DONG CO is_seed. Truoc day dem tat ca, nen den luc co nguoi dang
  // bai that len database that thi phep kiem tra nay bao FAIL — trong khi
  // migration 0006 van dung y nguyen. Mot phep kiem tra do bang chinh viec
  // website duoc su dung la mot phep kiem tra sai.
  //
  // outfit_items khong co cot is_seed nen phai nhin sang set do cha no.
  {
    const [r] = await db.rows(`
      select (select count(*) from products        where is_seed)::int as products,
             (select count(*) from outfits         where is_seed)::int as outfits,
             (select count(*) from affiliate_links where is_seed)::int as links,
             (select count(*) from outfit_items oi
                join outfits o on o.id = oi.outfit_id
               where o.is_seed)::int as items
    `);
    /*
      KHONG CHOT CUNG SO MON NUA.

      Truoc day dong nay doi dung 144 mon. Roi chu website vao thu nut "Go khoi
      set" — dung viec toi nho ho lam — va phep kiem bao FAIL. Nhat ky admin
      ghi ro hai lan go do, tuc la tinh nang chay dung; chi co phep kiem la sai.

      Day la lan thu hai trong du an nay mot phep kiem hong vi website duoc su
      dung. Mot phep kiem nhu vay khong bao ve duoc gi — no chi tao ra tieng on
      moi lan co nguoi cham vao du lieu.

      Nen doi sang KIEM BAT BIEN thay vi kiem con so: so set do la co dinh (do
      migration tao ra, khong ai them bot qua giao dien thuong), con so mon thi
      chi can nam trong khoang hop ly va khong co set nao rong.
    */
    const [m] = await db.rows(`
      select min(n)::int as it_nhat, max(n)::int as nhieu_nhat, count(*)::int as so_set
        from (select oi.outfit_id, count(*) n
                from outfit_items oi join outfits o on o.id = oi.outfit_id
               where o.is_seed group by oi.outfit_id) t
    `);
    /*
      Set do mau GIAM di la binh thuong: 0034 xoa 17 bai khong co anh, va chu
      website se con xoa tiep khi thay bang bai that. Nguong duoi la thu can
      bao ve — het sach du lieu mau nghia la mot migration da xoa nham.
    */
    report(
      '0006+0024 — san pham / set do / link mau (chi dem du lieu mau)',
      r.products >= 40 && r.outfits >= 1 && r.links >= 40,
      `${r.products} / ${r.outfits} / ${r.links}`,
    );
    report(
      'moi set do mau deu con it nhat 1 mon',
      m.so_set === r.outfits && m.it_nhat >= 1 && m.nhieu_nhat <= 8,
      `${m.so_set}/${r.outfits} set co mon · moi set tu ${m.it_nhat} den ${m.nhieu_nhat} mon`,
    );
  }
}

/** Chay cac file chua chay. Tra ve so file da chay trong lan nay. */
async function applyAll(db) {
  await db.script(TRACKING);

  const already = new Map(
    (await db.rows('select filename, sha256 from phoi_meta.applied_migrations')).map(
      (r) => [r.filename, r.sha256],
    ),
  );

  const files = migrationFiles();
  console.log(`\n=== Chay ${files.length} migration theo thu tu ===`);

  let applied = 0;

  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const hash = sha256(sql);
    const prev = already.get(file);

    if (prev === hash) {
      console.log(`  [BO QUA] ${file} — da chay truoc do`);
      continue;
    }

    if (prev && prev !== hash) {
      console.log(`  [DUNG]  ${file} — da chay truoc do NHUNG noi dung da doi.`);
      console.log('          Chay lai mot migration da sua co the mat du lieu.');
      console.log('          Neu chac chan muon chay lai, xoa dong tuong ung:');
      console.log(`            delete from phoi_meta.applied_migrations where filename = '${file}';`);
      failed = true;
      return applied;
    }

    const t0 = Date.now();
    try {
      // Ca file trong MOT lenh — Postgres tu boc trong transaction ngam
      await db.script(sql);
    } catch (e) {
      console.log(`  [LOI]   ${file}`);
      console.log('          ' + String(e.message).split('\n').join('\n          '));
      console.log('\n  File nay da duoc hoan tac hoan toan (transaction ngam).');
      console.log('  Cac file truoc do van con. Sua roi chay lai lenh nay.');
      failed = true;
      return applied;
    }

    await db.script(
      `insert into phoi_meta.applied_migrations (filename, sha256)
        values ('${file}', '${hash}')
        on conflict (filename) do update set sha256 = excluded.sha256, applied_at = now()`,
    );

    console.log(`  [XONG]  ${file} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    applied += 1;
  }

  return applied;
}

async function main() {
  if (SELF_TEST) {
    // Che do tu kiem tra: dung PGlite (Postgres that bien dich sang WASM).
    // Muc dich la kiem chung chinh script nay — thu tu chay, bang theo doi, va
    // cac phep kiem tra — ma khong can database that va khong can secret.
    console.log('Che do --self-test: chay tren PGlite, khong ket noi database that.');

    const { PGlite } = await import('@electric-sql/pglite');
    const pglite = new PGlite();
    await pglite.exec(SUPABASE_SHIM);

    const db = {
      script: (sql) => pglite.exec(sql),
      rows: async (sql) => (await pglite.query(sql)).rows,
    };

    await applyAll(db);
    if (!failed) await runChecks(db);

    // Chay lai lan hai: moi file phai bi BO QUA. Kiem tra tinh chay lai duoc.
    if (!failed) {
      console.log('\n=== Chay lai lan hai (phai bo qua het) ===');
      const n = await applyAll(db);
      report('chay lai khong ap dung lai file nao', n === 0, `da chay lai ${n} file`);
    }

    console.log(failed ? '\n>>> CO LOI' : '\n>>> TAT CA PASS');
    process.exit(failed ? 1 : 0);
  }

  const conn = resolveConnectionString(argv);
  if (!conn) {
    console.error('\n' + MISSING_DB_URL + '\n');
    process.exit(1);
  }

  console.log(`Ket noi: ${redact(conn)}`);

  let handle;
  try {
    handle = await connect(conn);
  } catch (e) {
    console.error(`\nKhong ket noi duoc: ${e.message}`);
    console.error('\nKiem tra: mat khau trong chuoi ket noi dung chua, va dang dung');
    console.error('ban "Session pooler" (cong 5432) chu khong phai "Transaction pooler" (6543).');
    process.exit(1);
  }

  const { client, strictSsl } = handle;
  if (!strictSsl) {
    console.log(
      'SSL: da ma hoa nhung khong xac thuc chung chi may chu. ' +
        'Dat PGSSLROOTCERT de xac thuc day du (xem chu thich trong scripts/db.mjs).',
    );
  }

  const db = {
    script: (sql) => client.query(sql),
    rows: async (sql) => (await client.query(sql)).rows,
  };

  try {
    await applyAll(db);
    if (!failed) await runChecks(db);
  } finally {
    await client.end();
  }

  if (failed) {
    console.log('\n>>> CO LOI — doc thong bao ben tren');
  } else {
    console.log('\n>>> XONG. Database da san sang.');
    console.log('    Buoc tiep theo: npm run dev, dang ky tai khoan, roi npm run db:grant-admin');
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
