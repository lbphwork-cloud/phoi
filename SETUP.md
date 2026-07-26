# Danh sách việc cần làm

Đánh dấu `[x]` khi xong. Các bước xếp theo thứ tự phụ thuộc — bước sau cần bước
trước xong mới làm được.

Những bước bắt buộc phải qua trình duyệt hoặc cần tài khoản của bạn thì tôi
không làm thay được. Phần còn lại đã tự động hoá thành lệnh.

---

## A. Đã làm sẵn, bạn không phải làm gì

- [x] Toàn bộ mã nguồn website, 12 trang, 3 Edge Function, Local Helper, tiện ích Chrome
- [x] 6 file migration, đã chạy thử trên Postgres thật
- [x] 20 set đồ mẫu + 45 sản phẩm mẫu
- [x] `npm run db:apply` — thay 6 lần dán tay bằng một lệnh
- [x] `npm run db:grant-admin` — thay câu SQL cấp quyền admin
- [x] `.env.local` đã tạo sẵn, chỉ còn điền giá trị
- [x] `.node-version` — Cloudflare tự dùng Node 22, không phải khai biến `NODE_VERSION`
- [x] Repo GitHub riêng tư, đã đẩy code lên
- [x] 3 workflow GitHub Actions, đã sẵn sàng, chỉ chờ secret

---

## B. Phần bạn phải tự làm

### 1. Tạo project Supabase

Cần trình duyệt và email của bạn, tôi không làm thay được.

- [ ] Vào supabase.com → đăng ký → **New project**
- [ ] **Region: Singapore (ap-southeast-1)** — gần Việt Nam nhất, và **không đổi
      được sau này**, chọn sai thì phải tạo project mới
- [ ] Đặt mật khẩu database, lưu lại. Bước 2 cần nó.
- [ ] Chờ khoảng 2 phút cho project khởi tạo xong

### 2. Lấy 3 giá trị và điền vào `.env.local`

- [ ] **Project Settings → API**, lấy 2 giá trị:
      - `Project URL` → điền vào `NEXT_PUBLIC_SUPABASE_URL`
      - `anon` / `public` key → điền vào `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] **Project Settings → Database → Connection string → URI**, chọn tab
      **Session pooler** (cổng 5432), thay `[YOUR-PASSWORD]` bằng mật khẩu ở
      bước 1 → bỏ dấu `#` ở dòng cuối `.env.local` rồi điền vào `SUPABASE_DB_URL`

Chọn **Session pooler** chứ không phải **Transaction pooler** (cổng 6543). Chế độ
transaction không cho chạy nhiều câu lệnh DDL trong một transaction, mà toàn bộ
cách chạy migration ở đây dựa vào điều đó.

Mở file:

```bash
open -e /Users/phug/Projects/fashion-affiliate/.env.local
```

### 3. Chạy 6 migration bằng một lệnh

- [ ] ```bash
      npm run db:apply
      ```

Script đọc nguyên 6 file từ đĩa, chạy đúng thứ tự, mỗi file trong một
transaction, rồi tự kiểm tra 7 điểm. Chạy lại nhiều lần an toàn — file đã chạy sẽ
bị bỏ qua.

Kết quả đúng là 7 dòng `[PASS]` và `>>> XONG. Database da san sang.`

Nếu báo lỗi: **gửi nguyên văn cho tôi**, đừng chạy tiếp. File lỗi đã được hoàn
tác hoàn toàn, không còn trạng thái nửa vời.

Muốn dán tay 6 file thay vì dùng lệnh thì xem hướng dẫn trong `README.md`.

### 4. Tắt xác nhận email

- [ ] Supabase → **Authentication → Sign In / Providers → Email** → tắt
      **Confirm email** → Save

Đây là chỗ hay tắc nhất. SMTP dùng chung của gói miễn phí Supabase chỉ cho vài
email mỗi giờ và thường vào thẳng thư rác — bạn sẽ đăng ký rồi ngồi chờ một email
không bao giờ tới.

Bật lại sau khi bạn có SMTP riêng (Resend, Brevo — cả hai có gói miễn phí).

### 5. Đăng ký tài khoản và tự cấp quyền admin

- [ ] ```bash
      npm run dev
      ```
- [ ] Mở http://localhost:3000/dang-nhap → đăng ký bằng `lbph.work@gmail.com`
- [ ] Mở terminal thứ hai:
      ```bash
      npm run db:grant-admin -- --email=lbph.work@gmail.com
      ```
- [ ] Kiểm tra: http://localhost:3000/admin phải vào được

**Đến đây website đã chạy đầy đủ trên máy bạn.** `/kham-pha` có 20 set đồ,
`/ho-so` nhập ngày sinh sẽ ra mệnh và màu gợi ý.

### 6. Bật chống Supabase tự ngủ — BẮT BUỘC

**Gói miễn phí Supabase tự tạm dừng project sau khoảng 7 ngày không có hoạt
động.** Website chết, không cảnh báo, phải vào bảng điều khiển bấm khôi phục tay.
Đây là cái bẫy phổ biến nhất của gói miễn phí.

- [ ] ```bash
      gh secret set SUPABASE_URL      --body "$(grep '^NEXT_PUBLIC_SUPABASE_URL='      .env.local | cut -d= -f2-)"
      gh secret set SUPABASE_ANON_KEY --body "$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)"
      ```
- [ ] Chạy thử ngay, đừng chờ 3 ngày mới biết sai:
      ```bash
      gh workflow run keep-alive.yml
      sleep 20 && gh run list --workflow=keep-alive.yml --limit 1
      ```

Cố ý dùng anon key, không dùng service role — job này chỉ đọc một bảng công khai.

### 7. Triển khai lên Cloudflare Pages

**Không dùng Vercel.** Gói Hobby của Vercel cấm dùng cho mục đích thương mại, mà
website affiliate là thương mại. Cloudflare cho phép.

- [ ] dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
- [ ] Chọn repo, rồi điền:

| Trường | Giá trị |
|---|---|
| Framework preset | None |
| Build command | `npm run build:static` |
| Build output directory | `out` |

Node 22 đã có `.node-version` lo, không phải khai gì thêm.

- [ ] **Settings → Environment variables**, thêm đúng 2 biến, cùng tên cùng giá
      trị như `.env.local`:
      - `NEXT_PUBLIC_SUPABASE_URL`
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Chỗ này rất dễ quên. Bản static export **nhét giá trị biến vào JavaScript lúc
build**, không đọc lúc chạy. Quên là trang thật hiện màn hình "chưa cấu hình"
trong khi máy bạn vẫn chạy tốt — và bạn sẽ đi tìm lỗi ở chỗ khác.

**Đừng** thêm `SUPABASE_DB_URL` vào Cloudflare. Website không cần nó.

- [ ] Supabase → **Authentication → URL Configuration** → thêm địa chỉ Cloudflare
      (`https://xxx.pages.dev`) vào **Redirect URLs**, không thì đăng nhập bằng
      Google trên trang thật sẽ bị chặn

---

## C. Tuỳ chọn — website chạy đủ mà không có phần nào dưới đây

- [ ] **Edge Functions** (bậc 1 lấy link tự động) — `supabase/functions/README.md`.
      Lưu ý: chạy từ IP trung tâm dữ liệu mà Shopee chặn gắt, nên bậc này thất
      bại khá thường xuyên. Đó là lý do có bậc 2.

- [ ] **Local Helper** (bậc 2, đường đáng tin nhất) —
      ```bash
      cp local-helper/.env.example local-helper/.env
      ```
      điền `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, rồi
      `cd local-helper && .venv/bin/python helper.py`.
      Đã đo trên link thật: dưới 1 giây mỗi link. Môi trường Python đã cài xong sẵn.

- [ ] **Tiện ích Chrome** — `chrome-extension/README.md`. Đường tin cậy nhất cho
      link mà cả hai bậc trên không đọc được, vì chạy trong phiên duyệt web thật.

- [ ] **Thay dữ liệu mẫu bằng dữ liệu thật** — `/admin/san-pham`. Dữ liệu hiện tại
      có nhãn "Dữ liệu mẫu" để bạn không lẫn.

- [ ] **Tài khoản affiliate** Shopee / TikTok Shop. Có rồi thì link bạn dán vào đã
      là link affiliate — không phải sửa code.

- [ ] **Tên miền riêng** — Cloudflare Pages → Custom domains. `.pages.dev` dùng
      tạm lâu dài được.

- [ ] **Kiểm tra link chết hàng tuần** — chỉ bật nếu bạn chấp nhận đặt service role
      key lên GitHub Secrets. Đây là job **duy nhất** cần khoá đó. Không muốn thì
      để tắt và chạy tay từ máy — chạy từ máy còn chính xác hơn vì dùng IP nhà mạng:
      ```bash
      SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-links.mjs
      ```

- [ ] **Google OAuth** — nếu muốn bật lại xác nhận email mà vẫn đăng nhập được dễ.
      Cần tạo OAuth client ở Google Cloud Console.

---

## Ba điều cần biết trước, không phải lỗi cần sửa

1. **Giá luôn phải nhập tay.** Thẻ Open Graph của Shopee không chứa giá — đã kiểm
   tra cả `og:description` và `product:price:amount`. Bộ đọc giá cố ý để trống
   thay vì đoán: hiển thị sai giá tệ hơn nhiều so với để người dùng tự điền.

2. **Không có mật khẩu Shopee/TikTok nào được lưu ở đâu.** Local Helper dùng phiên
   trình duyệt của chính bạn trong `.browser-profile/`, thư mục đó không bao giờ
   lên cloud.

3. **Nhập API key AI hiện chỉ admin làm được.** Schema và Edge Function đã sẵn sàng
   cho người dùng thường, nhưng đang khoá: giữ API key của người khác là trách
   nhiệm pháp lý thật — key họ rò rỉ là họ mất tiền. Mở ra chỉ cần đổi một điều
   kiện, khi bạn sẵn sàng nhận trách nhiệm đó.
