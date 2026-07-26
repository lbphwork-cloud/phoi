/**
 * Kiem tra suc khoe link affiliate.
 *
 * VI SAO VIEC NAY QUAN TRONG HON MOI TINH NANG KHAC
 *   Mot website affiliate day link chet la mot website chet. Nguoi dung bam vao,
 *   thay trang loi, va khong bao gio quay lai. Khong co bao cao nao canh bao
 *   viec do — phai tu di kiem.
 *
 * NGUYEN TAC THIET KE QUAN TRONG NHAT: THAN TRONG KHI KET LUAN "CHET"
 *   Script nay chay tren GitHub Actions, tuc la tu IP TRUNG TAM DU LIEU. Shopee
 *   chan IP loai do rat gat, nen ma 403 / 429 / timeout gan nhu chac chan la
 *   "bi chan", KHONG phai "san pham da bi go".
 *
 *   Neu danh dau chet dua tren nhung ma do thi se bao dong sai gan nhu toan bo
 *   danh sach, va bao dong sai nhieu lan thi ban se bo qua ca nhung bao dong
 *   dung. Nen:
 *
 *     404 / 410            -> is_alive = false   (chac chan da mat)
 *     200 / 3xx            -> is_alive = true
 *     403 / 429 / 5xx / loi mang -> is_alive = null  (KHONG KET LUAN)
 *
 *   Cot is_alive de null nghia la "chua biet". Giao dien chi hien canh bao khi
 *   is_alive = false, nen truong hop khong biet se im lang — dung nhu mong doi.
 *
 * CHAY
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-links.mjs
 *
 *   Can service role vi phai GHI vao bang affiliate_links cua moi nguoi dung.
 */

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
  console.error(
    'Thieu SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Tren GitHub Actions: them vao Settings -> Secrets and variables -> Actions.',
  );
  process.exit(1);
}

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

/** User-Agent trung thuc: day la mot bot kiem tra link, khong gia dang nguoi. */
const UA = 'PhoiLinkChecker/1.0 (+kiem tra link con song khong)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Kiem tra mot link.
 * Tra ve { alive: true | false | null, code, note }
 * alive = null nghia la KHONG KET LUAN duoc.
 */
async function checkOne(url) {
  try {
    // GET voi redirect: 'follow' thay vi HEAD: nhieu san khong tra loi HEAD
    // dung cach, tra 405 hoac 404 gia.
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    });

    const code = res.status;

    // Doc mot phan nho roi huy, de khong tai ca trang ve vo ich
    try {
      await res.body?.cancel();
    } catch {
      // khong quan trong
    }

    if (code === 404 || code === 410) {
      return { alive: false, code, note: 'San pham khong con ton tai' };
    }
    if (code >= 200 && code < 400) {
      return { alive: true, code, note: 'OK' };
    }
    if (code === 403 || code === 429) {
      return { alive: null, code, note: 'Bi chan (IP trung tam du lieu) — khong ket luan' };
    }
    if (code >= 500) {
      return { alive: null, code, note: 'San dang loi — khong ket luan' };
    }
    return { alive: null, code, note: `Ma ${code} — khong ket luan` };
  } catch (e) {
    return {
      alive: null,
      code: 0,
      note: `Loi mang: ${e.name === 'TimeoutError' ? 'het thoi gian cho' : e.message}`,
    };
  }
}

async function main() {
  // Chi kiem tra link cua bai DANG HIEN THI. Link trong ban nhap chua anh huong
  // tori ai, khong can ton luot kiem tra.
  const q = new URLSearchParams({
    select: 'id,url,platform,is_alive,last_checked_at,outfit_items(outfit_id,outfits(status))',
    is_active: 'eq.true',
    order: 'last_checked_at.asc.nullsfirst',
    limit: '300',
  });

  const res = await fetch(`${URL_BASE}/rest/v1/affiliate_links?${q}`, { headers: HEADERS });

  if (!res.ok) {
    console.error(`Khong doc duoc danh sach link: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }

  const rows = await res.json();

  // Chi giu link dang duoc mot bai da dang su dung
  const targets = rows.filter((r) =>
    (r.outfit_items ?? []).some((oi) => oi.outfits?.status === 'published'),
  );

  console.log(`Tim thay ${rows.length} link dang bat, trong do ${targets.length} thuoc bai da dang.\n`);

  if (targets.length === 0) {
    console.log('Khong co gi de kiem tra.');
    return;
  }

  const tally = { alive: 0, dead: 0, unknown: 0 };
  const dead = [];

  for (const [i, row] of targets.entries()) {
    const r = await checkOne(row.url);

    const mark = r.alive === true ? 'OK  ' : r.alive === false ? 'CHET' : '??  ';
    console.log(
      `[${String(i + 1).padStart(3)}/${targets.length}] ${mark} ${String(r.code).padStart(3)} ` +
        `${row.url.slice(0, 70)} — ${r.note}`,
    );

    if (r.alive === true) tally.alive++;
    else if (r.alive === false) { tally.dead++; dead.push(row.url); }
    else tally.unknown++;

    // Ghi ket qua. Luon cap nhat last_checked_at, ke ca khi khong ket luan duoc —
    // de lan sau uu tien kiem tra nhung link lau chua kiem.
    await fetch(`${URL_BASE}/rest/v1/affiliate_links?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({
        is_alive: r.alive,
        last_checked_at: new Date().toISOString(),
      }),
    });

    // Gian cach de khong doi xu nhu mot dot cao. 1,5 giay/link.
    await sleep(1500);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Con song      : ${tally.alive}`);
  console.log(`Da chet       : ${tally.dead}`);
  console.log(`Khong ket luan: ${tally.unknown}  (thuong la bi chan IP, khong phai link hong)`);
  console.log('='.repeat(60));

  if (dead.length > 0) {
    console.log('\nCac link da chet, can thay trong trang /admin/san-pham:');
    for (const u of dead) console.log(`  ${u}`);
    // Bao that bai de GitHub gui thong bao — day la thu can biet ngay.
    console.log(`\n::error::Co ${dead.length} link affiliate da chet.`);
    process.exit(1);
  }

  if (tally.unknown > tally.alive) {
    console.log(
      '\n::warning::Phan lon link khong ket luan duoc. Gan nhu chac chan la san ' +
        'chan IP cua GitHub Actions, khong phai link hong. Neu muon ket qua dang ' +
        'tin hon, chay script nay tu may ca nhan bang IP nha mang.',
    );
  }
}

main().catch((e) => {
  console.error('Loi khong bat duoc:', e);
  process.exit(1);
});
