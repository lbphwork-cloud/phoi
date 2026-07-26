/**
 * Kiem tra .env.local dien dung chua, bang cach GOI THAT vao Supabase.
 *
 *     npm run doctor
 *
 * VI SAO CO FILE NAY
 *   Bang dieu khien Supabase doi giao dien kha thuong xuyen, va ten khoa cung
 *   da doi: ban cu goi la "anon" / "service_role", ban moi goi la "publishable"
 *   / "secret". Mo ta UI roi hy vong nguoi dung bam dung la cach lam de sai.
 *   Thay vao do: ban dan gia tri vao, script goi that vao Supabase va noi chinh
 *   xac cai gi sai.
 *
 * PHEP KIEM TRA QUAN TRONG NHAT LA SO 3
 *   No phat hien viec dan lan khoa SECRET vao bien NEXT_PUBLIC_. Moi bien co
 *   tien to NEXT_PUBLIC_ deu bi nhung thang vao JavaScript gui toi trinh duyet
 *   — dan khoa secret vao do la cong khai no cho moi nguoi vao website, va
 *   khoa secret bo qua toan bo Row Level Security.
 *
 *   Day khong phai loi ly thuyet: hai khoa nam canh nhau tren cung mot trang
 *   trong bang dieu khien.
 *
 * KHONG BAO GIO IN KHOA RA MAN HINH. Chi in vai ky tu dau de ban doi chieu.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvLocal } from './db.mjs';

const ROOT = resolve(import.meta.dirname, '..');

let failed = false;
let warned = false;

function ok(label, detail) {
  console.log(`  [OK]   ${label}${detail ? ' — ' + detail : ''}`);
}
function bad(label, detail) {
  console.log(`  [SAI]  ${label}${detail ? ' — ' + detail : ''}`);
  failed = true;
}
function warn(label, detail) {
  console.log(`  [LUU Y] ${label}${detail ? ' — ' + detail : ''}`);
  warned = true;
}

/** Vai ky tu dau, du de nguoi dung doi chieu ma khong lo ro ri. */
const hint = (s) => (s ? `${s.slice(0, 12)}... (${s.length} ky tu)` : '(trong)');

/**
 * Doan loai khoa. Ho tro ca hai the he ten khoa cua Supabase.
 *
 * Tra ve: 'publishable' | 'secret' | 'anon' | 'service_role' | 'khong ro'
 */
function classifyKey(key) {
  if (!key) return 'khong ro';

  // The he moi: tien to ro rang
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('sb_secret_')) return 'secret';

  // The he cu: JWT, role nam trong phan payload
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(key.split('.')[1], 'base64url').toString('utf8'),
      );
      if (payload.role === 'anon') return 'anon';
      if (payload.role === 'service_role') return 'service_role';
    } catch {
      // Khong doc duoc payload thi coi nhu khong ro, khong doan bua
    }
  }

  return 'khong ro';
}

async function main() {
  console.log('\n=== 1. File .env.local ===');

  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) {
    bad('.env.local khong ton tai', 'chay: cp .env.example .env.local');
    console.log('\n>>> DUNG. Tao file truoc.');
    process.exit(1);
  }
  ok('.env.local ton tai');

  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const dbUrl = process.env.SUPABASE_DB_URL || '';

  console.log('\n=== 2. Dia chi project ===');

  if (!url) {
    bad('NEXT_PUBLIC_SUPABASE_URL con trong');
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    bad(
      'NEXT_PUBLIC_SUPABASE_URL sai dang',
      `dang dung: https://xxxxxxxx.supabase.co — dang co: ${url}`,
    );
  } else {
    ok('NEXT_PUBLIC_SUPABASE_URL', url);
  }

  console.log('\n=== 3. Khoa cong khai — va kiem tra khong dan lan khoa secret ===');

  const kind = classifyKey(key);

  if (!key) {
    bad('NEXT_PUBLIC_SUPABASE_ANON_KEY con trong');
  } else if (kind === 'secret' || kind === 'service_role') {
    bad(
      `DAY LA KHOA ${kind.toUpperCase()}, KHONG PHAI KHOA CONG KHAI`,
      hint(key),
    );
    console.log('');
    console.log('         Khoa nay bo qua toan bo Row Level Security. Moi bien co tien to');
    console.log('         NEXT_PUBLIC_ deu bi nhung vao JavaScript gui toi trinh duyet, nen');
    console.log('         de o day la cong khai no cho moi nguoi vao website.');
    console.log('');
    console.log('         Lay dung khoa: Project Settings -> API Keys -> "Publishable key"');
    console.log('         (hoac tab "Legacy API keys" -> khoa "anon" neu project ban con dung ban cu).');
    console.log('');
    console.log('         Neu khoa nay da tung bi day len GitHub hoac dua len Cloudflare:');
    console.log('         vao Supabase thu hoi (revoke/rotate) roi tao khoa moi.');
  } else if (kind === 'publishable' || kind === 'anon') {
    ok(`khoa dung loai (${kind})`, hint(key));
  } else {
    warn(
      'khong nhan ra loai khoa',
      `${hint(key)} — van thu goi that o buoc 4`,
    );
  }

  console.log('\n=== 4. Goi that vao Supabase ===');

  if (!url || !key || kind === 'secret' || kind === 'service_role') {
    console.log('  [BO QUA] can dia chi va khoa cong khai dung truoc da');
  } else {
    const base = url.replace(/\/$/, '');
    let res;
    try {
      res = await fetch(`${base}/rest/v1/styles?select=slug&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
    } catch (e) {
      bad('khong goi duoc', e.message);
    }

    if (res) {
      const body = await res.text();

      if (res.status === 200) {
        const rows = JSON.parse(body);
        ok(
          'goi duoc, va bang styles da co du lieu',
          `HTTP 200, ${rows.length} dong — nghia la migration da chay xong`,
        );
      } else if (res.status === 401 || res.status === 403) {
        bad('khoa bi tu choi', `HTTP ${res.status} — khoa sai hoac thuoc project khac`);
      } else if (res.status === 404 || /does not exist|schema must be/i.test(body)) {
        warn(
          'ket noi duoc nhung chua co bang styles',
          'binh thuong neu chua chay migration — buoc tiep theo la npm run db:apply',
        );
      } else {
        bad(`HTTP ${res.status}`, body.slice(0, 200));
      }
    }
  }

  console.log('\n=== 5. Chuoi ket noi database (chi can cho npm run db:apply) ===');

  if (!dbUrl) {
    warn(
      'SUPABASE_DB_URL con trong',
      'chua dien thi khong chay duoc npm run db:apply — van dan tay 7 file duoc',
    );
  } else {
    let parsed;
    try {
      parsed = new URL(dbUrl);
    } catch {
      bad('SUPABASE_DB_URL khong doc duoc', 'phai bat dau bang postgresql://');
    }

    if (parsed) {
      if (parsed.port === '6543') {
        bad(
          'dang dung Transaction pooler (cong 6543)',
          'phai dung Session pooler (cong 5432) — che do transaction khong chay duoc DDL nhieu cau trong mot transaction',
        );
      } else {
        ok(`cong ${parsed.port || '5432'}`, parsed.hostname);
      }

      // Mat khau that hay con la placeholder. Phan biet ro de khong thu ket noi
      // mot cach vo nghia roi in them mot dong loi cho cung mot nguyen nhan.
      let passwordUsable = false;
      if (!parsed.password) {
        bad('chuoi ket noi khong co mat khau', 'con nguyen [YOUR-PASSWORD] chua thay?');
      } else if (/^\[.*\]$/.test(decodeURIComponent(parsed.password))) {
        bad('mat khau con la placeholder', 'thay [YOUR-PASSWORD] bang mat khau that');
      } else {
        ok('co mat khau');
        passwordUsable = true;
      }

      if (parsed.port !== '6543' && passwordUsable) {
        try {
          const { connect } = await import('./db.mjs');
          const { client } = await connect(dbUrl);
          const { rows } = await client.query('select version() as v');
          await client.end();
          ok('ket noi database thanh cong', rows[0].v.split(',')[0]);
        } catch (e) {
          bad('khong ket noi duoc database', e.message);
        }
      }
    }
  }

  console.log('');
  if (failed) {
    console.log('>>> CO CHO SAI — doc cac dong [SAI] ben tren.');
    process.exit(1);
  }
  if (warned) {
    console.log('>>> KHONG CO LOI, nhung co dong [LUU Y] can doc.');
    process.exit(0);
  }
  console.log('>>> TAT CA DUNG.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
