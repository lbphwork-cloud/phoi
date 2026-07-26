import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Ket qua bien dich cua scripts/verify-*.ts (tsconfig.verify.json xuat ra
    // CommonJS de node chay truc tiep). Day la ma sinh tu dong, khong phai ma
    // nguon — lint no chi tao tieng on.
    ".verify-out/**",

    // Moi truong ao Python cua Local Helper. Playwright dong goi mot luong lon
    // JavaScript vao day (driver cua no viet bang Node), va eslint se lint het
    // neu khong chan — hang tram canh bao ve ma cua thu vien ben thu ba.
    "**/.venv/**",
    "**/node_modules/**",

    // Phien trinh duyet cua Local Helper
    "**/.browser-profile/**",
  ]),
]);

export default eslintConfig;
