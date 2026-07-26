/**
 * Ket noi Postgres cua Supabase, dung chung cho cac script trong thu muc nay.
 *
 * VI SAO CAN FILE NAY
 *   Cac script quan tri (chay migration, cap quyen admin) can noi thang vao
 *   Postgres, khong di qua REST API. Ly do: REST API bi Row Level Security
 *   chan dung nhu no phai chan — ma day la nhung viec CO Y nam ngoai RLS.
 *
 * CHUOI KET NOI LAY O DAU
 *   Supabase -> Project Settings -> Database -> Connection string -> URI
 *   Chon ban "Session pooler" (cong 5432). KHONG dung "Transaction pooler"
 *   (cong 6543): che do transaction khong cho chay nhieu cau lenh DDL trong
 *   mot transaction, ma toan bo thiet ke o day dua vao dieu do.
 *
 * CHUOI NAY CHUA MAT KHAU DATABASE
 *   Dat trong .env.local (da nam trong .gitignore) hoac truyen qua bien moi
 *   truong ngay tren dong lenh. Khong bao gio commit no, va khong bao gio dat
 *   vao bien co tien to NEXT_PUBLIC_.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Doc .env.local mot cach toi gian.
 *
 * Khong dung thu vien dotenv: file nay chi can hieu `KEY=value`, va them mot
 * dependency chi de lam viec do la khong can thiet.
 */
export function loadEnvLocal() {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(ROOT, name);
    if (!existsSync(path)) continue;

    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq < 1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();

      // Bo dau nhay neu nguoi dung dan ca dau nhay vao
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Bien da co san tren dong lenh thang bien trong file
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

/** Lay chuoi ket noi, tu bien moi truong hoac tu tham so --db=... */
export function resolveConnectionString(argv = process.argv.slice(2)) {
  const flag = argv.find((a) => a.startsWith('--db='));
  if (flag) return flag.slice('--db='.length);

  loadEnvLocal();
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || null;
}

/**
 * Tao client da ket noi.
 *
 * VE SSL — day la mot danh doi thuc su, khong phai chi tiet ky thuat vun:
 *
 *   Mac dinh o day la `rejectUnauthorized: false`. Nghia la duong truyen VAN
 *   duoc ma hoa, nhung khong xac thuc chung chi cua may chu. Mot ke dung giua
 *   duong (vi du tren Wi-Fi cong cong) co the mao danh may chu Supabase va doc
 *   duoc mat khau database.
 *
 *   Rui ro that, nhung nho, va day la mac dinh cua hau het cong cu ket noi
 *   Supabase. De xac thuc day du: tai chung chi CA cua Supabase (Project
 *   Settings -> Database -> SSL Configuration) roi dat duong dan vao bien
 *   PGSSLROOTCERT. Script tu chuyen sang xac thuc nghiem ngat khi thay bien do.
 *
 *   Khuyen nghi thuc te: chay cac script nay tren mang bạn tin duoc, hoac dat
 *   PGSSLROOTCERT neu chay tu mang la.
 */
export async function connect(connectionString) {
  const certPath = process.env.PGSSLROOTCERT;
  const strict = Boolean(certPath && existsSync(certPath));

  const client = new pg.Client({
    connectionString,
    ssl: strict
      ? { ca: readFileSync(certPath, 'utf8'), rejectUnauthorized: true }
      : { rejectUnauthorized: false },
  });

  await client.connect();
  return { client, strictSsl: strict };
}

/** An mat khau khi in chuoi ket noi ra man hinh hoac vao log. */
export function redact(connectionString) {
  try {
    const u = new URL(connectionString);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(chuoi ket noi khong doc duoc)';
  }
}

export const MISSING_DB_URL = `
Thieu chuoi ket noi database.

Lay o: Supabase -> Project Settings -> Database -> Connection string -> URI
Chon ban "Session pooler" (cong 5432), khong phai "Transaction pooler" (6543).

Roi chon mot trong hai cach:

  1. Them vao .env.local:
       SUPABASE_DB_URL=postgresql://postgres.xxxx:MAT_KHAU@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

  2. Hoac truyen ngay tren dong lenh:
       node scripts/apply-migrations.mjs --db="postgresql://..."
`.trim();
