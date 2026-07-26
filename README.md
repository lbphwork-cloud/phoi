# PHỐI

Website gợi ý phối đồ nam cho thị trường Việt Nam. Người xem chọn gu, hệ thống
xếp lại thứ tự outfit cho riêng họ, bấm ra Shopee hoặc TikTok Shop để mua. Người
đăng bài gắn link affiliate của chính họ và hưởng toàn bộ hoa hồng.

Sản phẩm trong khoảng 150.000 – 700.000đ. Đối tượng: nam 20–30 tuổi.

---

## Bắt đầu trong 5 bước

Danh sách việc cần làm dạng tích từng ô: **[SETUP.md](SETUP.md)**.

```bash
npm install
```

**1. Tạo project Supabase.** Vào [supabase.com](https://supabase.com), tạo
project mới. Chọn khu vực **Singapore** — gần Việt Nam nhất trong các khu vực
miễn phí.

**2. Chạy 6 file migration.**

Cách nhanh — một lệnh, không phải dán gì:

```bash
# Điền SUPABASE_DB_URL vào .env.local trước
# (Supabase → Project Settings → Database → Connection string → URI, tab Session pooler)
npm run db:apply
```

Script đọc nguyên file từ đĩa, chạy đúng thứ tự, **mỗi file trong một
transaction** (vào hết hoặc không vào gì), rồi tự kiểm tra 7 điểm. Chạy lại nhiều
lần an toàn: file đã chạy sẽ bị bỏ qua nhờ bảng theo dõi kèm mã băm SHA-256.

Muốn kiểm tra chính script đó mà chưa có database:

```bash
npm run db:apply:self-test
```

Cách dán tay — mở SQL Editor của Supabase, dán và chạy **lần lượt theo đúng thứ
tự số**:

| File | Nội dung |
|---|---|
| `supabase/migrations/0001_schema.sql` | Bảng, enum, index |
| `supabase/migrations/0002_rls.sql` | Row Level Security, quyền cấp cột |
| `supabase/migrations/0003_functions.sql` | Trigger, hàm nghiệp vụ |
| `supabase/migrations/0004_storage.sql` | Bucket ảnh và policy |
| `supabase/migrations/0005_seed_taxonomy.sql` | 8 phong cách, 17 màu, 8 dịp |
| `supabase/migrations/0006_seed_outfits.sql` | 45 sản phẩm + 20 set đồ mẫu |

Chạy từng file một, xong file này mới sang file sau. File 0002 phụ thuộc 0001,
0003 phụ thuộc 0002, và cứ thế.

**3. Điền biến môi trường.**

```bash
cp .env.example .env.local
```

Lấy hai giá trị ở Supabase → Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**4. Tự cấp quyền quản trị.** Đăng ký một tài khoản trên website trước, rồi:

```bash
npm run db:grant-admin -- --email=email-cua-ban@gmail.com
```

Bước này cố ý **không** dùng hàm `set_user_role()` có trong database, vì hàm đó
chặn người gọi không phải admin — mà lúc này chưa có admin nào. Đây là bước phá
vòng lặp "muốn có admin phải có admin", và nó vẫn được ghi vào `admin_audit_log`
với nhãn `bootstrap`.

Hoặc dán tay trong SQL Editor:

```sql
update profiles set role = 'admin'
 where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
```

**5. Chạy.**

```bash
npm run dev        # http://localhost:3000
```

Nếu chưa điền biến môi trường, website vẫn chạy và hiện màn hình hướng dẫn thay
vì trang trắng.

---

## Kiểm chứng

```bash
npm run verify
```

Ba bộ, tổng **253 phép kiểm tra**, không cần database thật và không cần secret:

| Lệnh | Kiểm tra gì | Số phép |
|---|---|---|
| `npm run verify:schema` | Chạy toàn bộ 6 migration trên **Postgres thật** (PGlite biên dịch sang WASM), rồi kiểm tra trigger kiểm duyệt, RLS, quyền cấp cột, và 20 set đồ mẫu | 62 |
| `npm run verify:lib` | Module ngũ hành (âm lịch, nạp âm) và bộ chấm điểm gợi ý | 110 |
| `npm run verify:helper` | Local Helper, và đối chiếu cấu hình tên miền giữa **bốn** nơi: Python / SQL / TypeScript / Edge Function | 81 |

Bộ `verify:schema` là bộ đáng giá nhất: nó bắt lỗi SQL và lỗi logic **trước khi**
bạn dán migration vào Supabase thật. Trong quá trình xây dựng, nó đã phát hiện tám
lỗi thật, gồm một lỗi bảo mật khiến API key vẫn đọc được qua REST API.

Nếu bạn sửa schema hoặc sửa `src/lib/`, chạy lại `npm run verify` trước khi commit.

---

## Kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js xuất tĩnh                            │
│  Cloudflare Pages                                        │
│  Chỉ chứa anon key. Không có secret nào.                  │
└────────────┬─────────────────────────────────────────────┘
             │ HTTPS + JWT của người dùng
             ▼
┌──────────────────────────────────────────────────────────┐
│  BACKEND / DATABASE — Supabase                           │
│  · Postgres + Row Level Security  ← lớp phân quyền thật   │
│  · Auth (Google OAuth + email)                            │
│  · Storage (ảnh outfit và sản phẩm)                       │
│  · Edge Functions cho việc cần secret                     │
└──────┬───────────────────────────────────────────────────┘
       │ bảng fetch_jobs (hàng đợi việc)
       │
       │  ▲ Máy cá nhân CHỦ ĐỘNG hỏi. Website không có
       │  │ đường nào gọi vào máy bạn.
       ▼  │
┌──────────────────────────────────────────────────────────┐
│  LOCAL HELPER — Python + Playwright, trên máy bạn         │
│  Đọc thông tin sản phẩm từ link, bằng trình duyệt thật     │
│  trên IP nhà mạng thật.                                   │
└──────────────────────────────────────────────────────────┘
```

### Vì sao Cloudflare Pages, không phải Vercel

Điều khoản của Vercel quy định gói Hobby **chỉ dành cho mục đích cá nhân, phi
thương mại**. Website affiliate sinh hoa hồng là hoạt động thương mại, nên dùng
Hobby là vi phạm và có rủi ro bị khoá tài khoản. Cloudflare Pages cho phép dùng
gói miễn phí cho site thương mại, và cho băng thông không giới hạn.

### Ba bậc lấy dữ liệu sản phẩm từ link

Không có tài khoản affiliate nên không dùng được API chính thức của Shopee hay
TikTok. Thay vào đó là một chuỗi ba bậc, tự động rơi xuống bậc dưới khi bậc trên
thất bại:

**Bậc 1 — Edge Function đọc thẻ Open Graph.** Shopee phát thẻ `og:title` /
`og:image` cho bot xem trước link — đó là cơ chế khiến dán link Shopee vào Zalo
thì hiện ra ảnh và tên. Đọc metadata này không phải là cào dữ liệu: nó là thông
tin sàn chủ động công bố để được chia sẻ.

**Bậc này cần đúng hai bước với hai User-Agent khác nhau.** Đo trên link thật:

| | UA trình duyệt | UA bot xem trước link |
|---|---|---|
| Link rút gọn `vn.shp.ee` | 200, chuyển hướng đúng | **403** |
| URL sản phẩm đầy đủ | vỏ SPA rỗng, **0 thẻ OG** | HTML đủ `og:title` + `og:image` |

Làm ngược lại thì thất bại ở cả hai bước. Đáng chú ý: với UA trình duyệt, trang
sản phẩm trả về nội dung **giống y nguyên trang chủ đến từng byte** — không có
thẻ OG, không có title, không có cả mã sản phẩm.

Thẻ OG **không chứa giá**. Giá luôn phải nhập tay. Đây là hạn chế thật, không
phải thiếu sót cấu hình.

Hạn chế thứ hai: Edge Function chạy từ trung tâm dữ liệu, mà Shopee chặn IP loại
đó. Bậc này vẫn sẽ thất bại khá thường xuyên. Đó là lý do có bậc 2.

**Bậc 2 — Local Helper trên máy bạn.** Website chỉ ghi một dòng vào bảng
`fetch_jobs`. Máy bạn tự đọc, tự quyết định làm.

Bên trong bậc 2 lại có **hai đường, thử đường rẻ trước**:

| | Cách | Thời gian |
|---|---|---|
| Đường 1 | HTTP thuần từ IP nhà mạng | 0,6 – 1 giây |
| Đường 2 | Trình duyệt thật (Playwright) | 5 – 15 giây |

Nghịch lý đo được trên link thật: Shopee **chặn trình duyệt bị điều khiển tự
động** — cả Chromium đi kèm Playwright lẫn Chrome thật của máy đều bị đẩy sang
`/verify/traffic/error` — nhưng cho HTTP thuần đi qua. Lý do hợp lý: một yêu cầu
HTTP không phải trình duyệt, nên không có dấu vết tự động hoá để phát hiện.

Nên trình duyệt được khởi động **lười**, chỉ mở khi đường 1 thất bại. Nếu gặp
CAPTCHA thì cửa sổ hiện lên và **bạn** tự bấm — người thật giải CAPTCHA không
phải là vượt rào.

Đã chạy thử thật với hai link `vn.shp.ee`: cả hai lấy được tên và ảnh dưới 1
giây, không cần mở trình duyệt. Xem `local-helper/README.md`.

**Bậc 3 — Nhập tay.** Luôn có sẵn. Đây không phải đường lui tạm bợ: bài của người
dùng thường sẽ dùng bậc này là chính.

**Ngoài ba bậc: tiện ích Chrome.** Ổn định nhất trong tất cả, vì bạn đang tự mở
trang sản phẩm bằng trình duyệt của chính bạn — không có tín hiệu tự động hoá nào
để sàn phát hiện. Xem `chrome-extension/README.md`.

---

## Mô hình bảo mật

Bốn nguyên tắc, và chỗ chúng được thực thi:

**1. Row Level Security là lớp phân quyền duy nhất đáng tin.**
Không có kiểm tra quyền nào ở tầng giao diện được coi là lớp bảo vệ. Trang
`/admin` có chặn ở frontend, nhưng đó chỉ là tiện lợi — ai sửa JavaScript để vào
được cũng chỉ thấy màn hình trống, vì mọi truy vấn đều bị database kiểm tra
`is_admin()` lại.

**2. Ngày sinh nằm ở bảng riêng, quản trị viên cũng không đọc được.**
`user_private` chứa ngày sinh và niên mệnh, RLS chỉ cho chính chủ. Admin **cố ý**
không được cấp quyền: admin không cần ngày sinh để làm việc gì cả.

**3. Quy tắc duyệt lại được ép ở tầng database, không phải ở form.**
"Bài đã duyệt mà sửa ảnh, sản phẩm hoặc link affiliate thì phải duyệt lại" được
thực hiện bằng ba trigger trong `0003_functions.sql`. Nếu chỉ làm ở frontend thì
gọi thẳng REST API của Supabase là vượt qua được.

**4. Chặn một cột cần `REVOKE` cả bảng rồi `GRANT` lại theo danh sách cột.**
Đây là cái bẫy đã gây ra một lỗ hổng thật trong quá trình xây dựng:
`revoke select (mot_cot) ... from role` **không có tác dụng** nếu role đã có
`GRANT SELECT` ở cấp bảng. Postgres không trừ bớt một cột ra khỏi quyền cấp bảng.
Vì thế `ai_credentials.encrypted_key`, `outfits.view_count` và `profiles.role`
đều được xử lý theo đúng cách hai bước trong `0002_rls.sql`.

### Ba loại khoá và nơi chúng được phép xuất hiện

| Khoá | Được phép ở | Tuyệt đối không |
|---|---|---|
| `anon` key | `.env.local`, mã frontend, GitHub Actions | — |
| `service_role` key | `local-helper/.env`, biến môi trường của Edge Function | Bất kỳ biến `NEXT_PUBLIC_*`, mã frontend |
| API key AI của bạn | Mã hoá trong bảng `ai_credentials` | Không bao giờ trả về trình duyệt |

`anon` key **không phải secret**. Nó chỉ nói "tôi là khách của project này"; mọi
quyền thực sự do RLS quyết định. `service_role` key thì bỏ qua RLS hoàn toàn — ai
có nó đều đọc và sửa được mọi dữ liệu của mọi người dùng.

---

## Triển khai lên Cloudflare Pages

```bash
npm run build:static      # kết quả ở out/
```

Trong bảng điều khiển Cloudflare Pages:

| Cài đặt | Giá trị |
|---|---|
| Framework preset | None |
| Build command | `npm run build:static` |
| Build output directory | `out` |
| Node version | 22 hoặc mới hơn |

Environment variables (mục **Production** và cả **Preview**):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Hai biến này phải có **lúc build**, không chỉ lúc chạy: `generateStaticParams`
đọc danh sách outfit từ database để dựng sẵn một trang tĩnh cho từng outfit. Nếu
thiếu, bản đã triển khai sẽ chỉ có trang `/outfit/_khong-co-du-lieu/` — coi đó là
dấu hiệu biến môi trường chưa được đặt.

### Dựng lại trang khi có bài mới

Bản tĩnh nghĩa là outfit vừa được duyệt chưa có trang riêng cho tới lần build
tiếp theo. Cách xử lý, tốn 0đ:

1. Cloudflare Pages → Settings → Builds & deployments → **Deploy hook**. Tạo một
   hook, sao chép URL.
2. Supabase → Database → Webhooks → tạo webhook mới trên bảng `outfits`, sự kiện
   `UPDATE`, gọi URL vừa lấy.

Từ đó mỗi lần bạn duyệt một bài, Cloudflare tự build lại. Gói miễn phí cho 500
lượt build mỗi tháng — dư sức cho một người vận hành.

---

## Bật đăng nhập Google

Đây là đường **được khuyến dùng**, không phải lựa chọn phụ. Gói miễn phí của
Supabase giới hạn số email xác thực gửi được mỗi giờ ở mức rất thấp, nên nếu ai
cũng đăng ký bằng email thì luồng đăng ký sẽ nghẽn ngay khi có vài chục người vào
cùng lúc. Google OAuth không gửi email nào.

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services →
   Credentials → Create OAuth client ID → Web application.
2. Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google: bật, dán Client ID và Secret.
4. Supabase → Authentication → URL Configuration → Site URL: địa chỉ website của
   bạn. Redirect URLs: thêm cả `http://localhost:3000/**` để chạy thử ở máy.

---

## Edge Functions

Ba function, đều tuỳ chọn — website chạy đầy đủ mà không có chúng, chỉ là bậc 1
của luồng lấy link và việc tạo ảnh bằng AI sẽ không dùng được.

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>

# Bậc 1: đọc thẻ Open Graph
supabase functions deploy fetch-product

# Lưu API key AI (đã mã hoá)
supabase secrets set AI_KEY_ENCRYPTION_SECRET="$(openssl rand -base64 32)"
supabase functions deploy ai-credentials

# Tạo ảnh bằng API key của chính bạn
supabase functions deploy ai-generate
```

Chi tiết trong `supabase/functions/README.md`.

---

## Tự động hoá miễn phí

Ba workflow trong `.github/workflows/`:

| Workflow | Lịch | Việc |
|---|---|---|
| `keep-alive.yml` | mỗi 3 ngày | Gọi một truy vấn nhỏ để Supabase không tự tạm dừng |
| `link-health.yml` | thứ Hai hàng tuần | Kiểm tra link affiliate còn sống không |
| `ci.yml` | mỗi lần push | typecheck, lint, 253 phép kiểm tra, build |

**`keep-alive.yml` là bắt buộc, không phải tuỳ chọn.** Gói miễn phí của Supabase
tự tạm dừng project sau khoảng 7 ngày không hoạt động, và khi bị tạm dừng thì
website chết mà không có cảnh báo nào. Đây là cái bẫy phổ biến nhất của gói miễn
phí.

Secret cần đặt trong Settings → Secrets and variables → Actions:

```
SUPABASE_URL
SUPABASE_ANON_KEY            # cho keep-alive
SUPABASE_SERVICE_ROLE_KEY    # chỉ cho link-health
```

Nếu bạn không muốn đặt service role key lên GitHub, tắt `link-health.yml` và chạy
tay từ máy cá nhân — kết quả còn đáng tin hơn, vì IP nhà mạng không bị Shopee
chặn như IP của GitHub Actions:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-links.mjs
```

---

## Hạn mức miễn phí và bốn cái bẫy

| Dịch vụ | Hạn mức | Đủ cho |
|---|---|---|
| Cloudflare Pages | Băng thông không giới hạn, 500 build/tháng | Rất lâu |
| Supabase Postgres | 500 MB | Hàng chục nghìn outfit |
| Supabase Storage | 1 GB | Khoảng 200–400 ảnh outfit |
| Supabase egress | **5 GB/tháng** | Đây là ngưỡng chạm trước tiên |
| Supabase MAU | 50.000 | Rất lâu |

**Bẫy 1 — project tự ngủ sau 7 ngày.** Đã xử lý bằng `keep-alive.yml`. Phải bật
ngay từ đầu.

**Bẫy 2 — email xác thực bị giới hạn rất thấp.** Đã xử lý bằng cách ưu tiên
Google OAuth. Nếu vẫn muốn dùng email, cắm SMTP riêng của Resend (miễn phí 3.000
email/tháng).

**Bẫy 3 — egress 5 GB/tháng.** Ảnh là thứ tốn egress nhất. Khi bắt đầu có traffic
thật, chuyển ảnh sang **Cloudflare R2** (10 GB lưu trữ, egress miễn phí vĩnh
viễn). Đã chuẩn bị sẵn: chỉ phải sửa **duy nhất** `src/lib/storage.ts`.

**Bẫy 4 — không có tên miền nào miễn phí.** Giai đoạn test dùng `*.pages.dev` là
đủ. Khi công khai, `.io.vn` rất rẻ, `.com` khoảng 250.000–350.000đ/năm.

---

## Về 20 set đồ mẫu

Migration `0006` tạo 45 sản phẩm và 20 set đồ, **tất cả đánh dấu `is_seed = true`**
và hiện badge "Dữ liệu mẫu" trong admin.

Đây là dữ liệu mẫu, không phải dữ liệu thật:

- Tên sản phẩm là tên **mô tả theo loại** ("Áo thun cotton trơn trắng form
  regular"), không phải tên sản phẩm thật của người bán nào.
- Giá là **khoảng giá phổ biến**, không phải giá niêm yết thật.
- Link trỏ tới **trang tìm kiếm thật** của Shopee/TikTok cho loại sản phẩm đó,
  không phải mã sản phẩm bị bịa ra.
- `image_url` để trống. Bạn tự tải ảnh lên trong admin.

Làm vậy vì nguyên tắc "không tự bịa tên, giá hoặc thông tin sản phẩm" — dữ liệu
mẫu phải tự nó tỏ ra là dữ liệu mẫu.

Thay dần bằng dữ liệu thật trong `/admin/san-pham`. Sửa tay một sản phẩm là
`is_seed` tự chuyển thành `false`. Xoá sạch khi không cần nữa:

```sql
delete from outfits  where is_seed;
delete from products where is_seed;
```

---

## Cấu trúc mã nguồn

```
src/
  app/                       Trang (Next.js App Router)
    page.tsx                 Trang chủ
    kham-pha/                Khám phá outfit, có bộ lọc
    outfit/[slug]/           Chi tiết outfit
    dang-nhap/               Đăng ký và đăng nhập
    ho-so/                   Gu, ngũ hành, quyền dữ liệu cá nhân
    tao-bai/                 Tạo bài phối đồ
    bai-cua-toi/             Quản lý bài cá nhân
    admin/                   Tổng quan, kiểm duyệt, outfit, sản phẩm,
                             người dùng, AI
  components/
    site.tsx                 Header, footer, các trạng thái chung
    outfit.tsx               Thẻ outfit, nút mua, 4 nút phản hồi
    OutfitEditor.tsx         Trình soạn set đồ
  lib/
    supabase/                Client và kiểu dữ liệu
    nguhanh/                 Âm lịch (Hồ Ngọc Đức) + nạp âm + gợi ý màu
    scoring.ts               Bộ chấm điểm gợi ý theo luật
    affiliate.ts             Kiểm tra link (bản client)
    fetchProduct.ts          Chuỗi ba bậc lấy dữ liệu từ link
    storage.ts               Upload ảnh — đổi sang R2 chỉ sửa file này
    hooks.ts                 useAuth, useTaxonomy, useUserContext, useAsyncData
    format.ts                Định dạng VNĐ, ngày, slug tiếng Việt

supabase/
  migrations/                6 file, chạy theo thứ tự số
  functions/                 Edge Function (Deno)

local-helper/                Python + Playwright, chạy trên máy cá nhân
chrome-extension/            Tiện ích gửi sản phẩm từ trang sàn
scripts/                     Bộ kiểm chứng + kiểm tra link chết
```

---

## Ngũ hành

Toàn bộ tính **offline**, không gọi API, không dùng AI:

1. Chuyển ngày sinh dương lịch sang âm lịch bằng thuật toán Hồ Ngọc Đức, múi giờ
   UTC+7. Múi giờ là điểm phân biệt âm lịch Việt Nam với âm lịch Trung Quốc.
2. Suy ra Can Chi của năm âm lịch, rồi tra bảng 30 cặp nạp âm để ra niên mệnh.
3. Từ hành suy ra màu tương sinh, màu bản mệnh và màu nên hạn chế.

**Vì sao phải nhập đủ ngày tháng năm, không chỉ năm sinh:** người sinh tháng 1
hoặc tháng 2 dương lịch thường vẫn thuộc năm âm lịch trước đó. Sinh 20/01/1998 có
niên mệnh Giản Hạ Thủy (năm âm lịch 1997, Đinh Sửu), còn sinh 05/02/1998 có niên
mệnh Thành Đầu Thổ (năm âm lịch 1998, Mậu Dần). Chỉ lấy năm sinh thì khoảng 1/12
người dùng bị tính sai mệnh. Bộ kiểm chứng có một phép thử riêng cho đúng cặp
ngày này.

**Mệnh là điểm cộng mềm, không phải bộ lọc cứng.** Tổng điểm tối đa mà mệnh có
thể tạo ra nhỏ hơn điểm của một lần khớp phong cách, và nhỏ hơn giá trị tuyệt đối
của một lần phản hồi "không thích màu". Đây là bất biến được kiểm tra bằng
**hành vi** trong `scripts/verify-scoring.ts` — nên nếu sau này ai đổi trọng số
mà phá vỡ nó, test sẽ đổ. Người dùng tắt gợi ý theo mệnh được hoàn toàn.

Nội dung ngũ hành chỉ là gợi ý màu sắc mang tính tham khảo trong phối đồ, không
phải dự đoán vận mệnh.

---

## Còn lại và bước tiếp theo

**Đã xong và chạy được:**

- Toàn bộ luồng công khai: trang chủ, khám phá có lọc, chi tiết outfit, mua hàng
- Đăng ký / đăng nhập, hồ sơ, gu cá nhân, ngũ hành, 4 nút phản hồi
- Người dùng tự đăng bài, máy trạng thái kiểm duyệt đầy đủ, quy tắc duyệt lại
- Trang quản trị: tổng quan, kiểm duyệt, outfit, sản phẩm, người dùng, AI
- Ba bậc lấy dữ liệu từ link + tiện ích Chrome
- Khe cắm AI theo mô hình BYOK, key mã hoá khi lưu
- Tạo ảnh bằng Gemini hoặc OpenAI: bộ dựng câu lệnh từ dữ liệu set đồ, ảnh lưu
  dạng bản nháp, gán vào bài bằng tay
- Đo lường click, nhật ký thao tác admin, quyền xuất/xoá dữ liệu cá nhân

**Chưa làm, và lý do:**

- **AI Virtual Try-on (CatVTON / IDM-VTON).** Tạm gác theo quyết định. Trọng số
  của cả hai mô hình phát hành theo giấy phép CC BY-NC-SA 4.0 — **cấm sử dụng
  thương mại**, mà website affiliate sinh hoa hồng là hoạt động thương mại. Ngoài
  ra chúng chỉ mặc được áo và quần, không xử lý được giày, đồng hồ, kính, mũ, túi
  — vốn là phần lớn danh mục sản phẩm.
- **Công cụ tìm sản phẩm theo từ khoá.** Cần tài khoản affiliate được duyệt để
  dùng API chính thức. Làm khi bạn có tài khoản.
- **Cho người dùng thường nhập API key riêng.** Schema và Edge Function đã chuẩn
  bị sẵn, hiện khoá lại chỉ admin. Giữ API key của người khác là một trách nhiệm
  pháp lý thật (nếu rò rỉ, họ mất tiền) — mở khi bạn sẵn sàng nhận trách nhiệm đó.

**Việc nên làm ngay, theo thứ tự:**

1. Chạy 6 migration, điền `.env.local`, tự cấp quyền admin.
2. Bật `keep-alive.yml` — nếu bỏ qua, một tuần sau website sẽ chết.
3. Vào `/admin/san-pham`, thay 20 set đồ mẫu bằng link và ảnh thật.
4. Bật đăng nhập Google.
5. Triển khai lên Cloudflare Pages với đủ hai biến môi trường.

---

## Ghi chú

`npm audit` báo lỗ hổng ở `sharp`, một phụ thuộc gián tiếp của Next.js dùng cho
tối ưu ảnh. `npm audit fix --force` sẽ hạ Next.js xuống phiên bản 9 — **đừng
làm**. Dự án này đặt `images.unoptimized: true` nên `sharp` không nằm trong đường
chạy thực tế.
