/**
 * Deploy ban dung tinh len Cloudflare Pages.
 *
 *     npm run deploy          (tu build lai roi day len)
 *
 * VI SAO KHONG NOI GIT MA TAI THANG BAN DUNG LEN
 *   Noi repo GitHub voi Pages thi moi lan push la tu deploy — tien hon. Nhung
 *   buoc noi do can OAuth voi GitHub trong bang dieu khien, khong lam qua API
 *   duoc. Cach nay chay duoc ngay bang API token, va co mot cai loi that:
 *
 *   Ban dung tinh nhung gia tri bien moi truong vao JavaScript LUC BUILD, chu
 *   khong doc luc chay. Build o day nghia la lay tu .env.local cua may ban, nen
 *   khong the quen khai bien tren Cloudflare — mot cai bay rat de dinh va rat
 *   kho doan, vi may ban van chay tot trong khi trang that bao "chua cau hinh".
 *
 *   Doi sang noi Git luc nao cung duoc, khong mat gi.
 *
 * KHONG BAO GIO IN TOKEN RA MAN HINH.
 */

import { spawn } from 'node:child_process';
import { loadEnvLocal } from './db.mjs';

loadEnvLocal();

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const project = process.env.CLOUDFLARE_PAGES_PROJECT || 'phoi';

if (!token || !account) {
  console.error(`
Thieu cau hinh Cloudflare trong .env.local:

  CLOUDFLARE_API_TOKEN=...     (dash.cloudflare.com -> My Profile -> API Tokens)
  CLOUDFLARE_ACCOUNT_ID=...    (nam ngay trong dia chi trang dashboard)

Token can quyen: Account -> Cloudflare Pages -> Edit
`.trim());
  process.exit(1);
}

console.log(`Deploy project "${project}" len Cloudflare Pages...`);

const child = spawn(
  'npx',
  ['wrangler', 'pages', 'deploy', 'out',
   '--project-name', project, '--branch', 'main', '--commit-dirty=true'],
  {
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account },
  },
);

child.on('exit', (code) => process.exit(code ?? 1));
