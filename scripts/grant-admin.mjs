/**
 * Cap quyen quan tri cho mot tai khoan da dang ky.
 *
 *     npm run db:grant-admin -- --email=ban@gmail.com
 *
 * PHAI DANG KY TREN WEBSITE TRUOC. Script nay khong tao tai khoan — no chi doi
 * quyen cua tai khoan da co. Ly do: tao tai khoan phai di qua Supabase Auth de
 * mat khau duoc bam dung cach, va viec do thuoc phia website.
 *
 * VI SAO KHONG DUNG HAM set_user_role() DA CO TRONG DATABASE
 *   Ham do cố ý chan neu nguoi goi khong phai admin. Nhung luc nay CHUA CO admin
 *   nao — day chinh la buoc pha vong lap "muon co admin phai co admin". Script
 *   noi thang vao Postgres nen nam ngoai RLS, va do la dieu duy nhat lam duoc.
 *
 *   Ke tu admin dau tien, moi lan doi quyen nen lam qua /admin/nguoi-dung tren
 *   website de duoc ghi nhat ky va duoc kiem tra quyen day du.
 *
 * VAN GHI NHAT KY. Buoc bootstrap nay cung duoc ghi vao admin_audit_log voi
 * nhan 'bootstrap' — mot lan cap quyen admin khong dau vet la dung thu khong
 * nen ton tai, ke ca khi chinh chu lam.
 */

import {
  connect,
  resolveConnectionString,
  redact,
  MISSING_DB_URL,
} from './db.mjs';

const argv = process.argv.slice(2);

function arg(name) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main() {
  const email = arg('email');
  if (!email) {
    console.error('\nThieu email.\n\n  npm run db:grant-admin -- --email=ban@gmail.com\n');
    process.exit(1);
  }

  const conn = resolveConnectionString(argv);
  if (!conn) {
    console.error('\n' + MISSING_DB_URL + '\n');
    process.exit(1);
  }

  console.log(`Ket noi: ${redact(conn)}`);
  const { client } = await connect(conn);

  try {
    // Tham so hoa thay vi noi chuoi — email den tu dong lenh van la du lieu
    // khong tin duoc, va thoi quen noi chuoi vao SQL la thoi quen nen bo.
    const { rows: users } = await client.query(
      'select id, email from auth.users where lower(email) = lower($1)',
      [email],
    );

    if (users.length === 0) {
      console.error(`\nKhong tim thay tai khoan nao co email "${email}".`);

      const { rows: all } = await client.query(
        'select email from auth.users order by created_at limit 10',
      );
      if (all.length === 0) {
        console.error('\nChua co tai khoan nao trong database.');
        console.error('Chay `npm run dev`, vao /dang-nhap va dang ky truoc.');
      } else {
        console.error('\nCac tai khoan dang co:');
        for (const u of all) console.error(`  ${u.email}`);
      }
      process.exit(1);
    }

    const user = users[0];

    // Trigger handle_new_user() tu tao dong profiles luc dang ky. Neu thieu thi
    // trigger chua duoc chay (migration 0003 chua vao) — bao ro thay vi tu tao,
    // vi tu tao se che mat mot van de that.
    const { rows: profiles } = await client.query(
      'select id, role from profiles where id = $1',
      [user.id],
    );

    if (profiles.length === 0) {
      console.error(`\nCo tai khoan "${user.email}" nhung khong co dong trong bang profiles.`);
      console.error('Nghia la trigger handle_new_user() chua chay — migration 0003 chua vao.');
      console.error('Chay `npm run db:apply` truoc.');
      process.exit(1);
    }

    if (profiles[0].role === 'admin') {
      console.log(`\n"${user.email}" da la admin roi. Khong doi gi.`);
      return;
    }

    await client.query("update profiles set role = 'admin' where id = $1", [user.id]);

    await client.query(
      `insert into admin_audit_log (actor_id, action, entity_type, entity_id, detail)
        values ($1, 'user.set_role', 'profile', $1,
                jsonb_build_object('new_role', 'admin', 'via', 'bootstrap-script'))`,
      [user.id],
    );

    console.log(`\n>>> XONG. "${user.email}" gio la admin.`);
    console.log('    Mo http://localhost:3000/admin de kiem tra.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
