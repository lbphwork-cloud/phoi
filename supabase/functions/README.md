# Edge Functions

Ba function, chạy trên Deno tại hạ tầng của Supabase. **Cả ba đều tuỳ chọn** —
website chạy đầy đủ mà không có chúng:

- Không có `fetch-product`: bậc 1 của luồng lấy link không hoạt động, hệ thống
  chuyển thẳng sang bậc 2 (Local Helper) hoặc nhập tay.
- Không có `ai-credentials`: không lưu được API key AI.
- Không có `ai-generate`: không tạo được ảnh bằng AI. Bạn vẫn tải ảnh lên tay
  bình thường.

---

## Triển khai

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>     # lấy trong URL của project

supabase functions deploy fetch-product

supabase secrets set AI_KEY_ENCRYPTION_SECRET="$(openssl rand -base64 32)"
supabase functions deploy ai-credentials
supabase functions deploy ai-generate
```

`ai-credentials` và `ai-generate` **dùng chung** biến `AI_KEY_ENCRYPTION_SECRET`.
Đổi biến đó sau khi đã lưu key thì mọi key cũ không giải mã được nữa — và vì
`encrypted_key` không đọc lại được, cách khôi phục duy nhất là xoá key rồi nhập lại.

Kiểm tra sau khi triển khai:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/fetch-product" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://shopee.vn/mot-san-pham-i.123.456"}'
```

---

## `fetch-product`

Bậc 1 của chuỗi lấy dữ liệu sản phẩm.

**Làm gì:** nhận một link, kiểm tra tên miền, theo chuỗi chuyển hướng nếu là link
rút gọn, rồi đọc thẻ Open Graph từ HTML.

**Vì sao đọc thẻ Open Graph không phải là cào dữ liệu:** đây là metadata mà sàn
*chủ động công bố* để link của họ hiện đẹp khi được chia sẻ lên Facebook hay Zalo.
Function này làm đúng việc mà một bot xem trước link làm — không gọi API nội bộ,
không vượt CAPTCHA, không đọc DOM sau khi chạy JavaScript.

**Phải dùng hai User-Agent cho hai bước.** Đây không phải tuỳ chọn — đo trên link
thật của người dùng:

| | UA trình duyệt | UA bot xem trước link |
|---|---|---|
| Link rút gọn `vn.shp.ee` | 200, chuyển hướng đúng | **403** |
| URL sản phẩm đầy đủ | vỏ SPA rỗng, **0 thẻ OG** | HTML đủ `og:title` + `og:image` |

Với UA trình duyệt, trang sản phẩm trả về nội dung giống y nguyên trang chủ đến
từng byte — toàn bộ nội dung do JavaScript render phía client. Nên: `UA_BROWSER`
để đi theo chuyển hướng, rồi đổi sang `UA_CRAWLER` để đọc thẻ OG.

**Thẻ OG không chứa giá.** Giá luôn phải nhập tay. Hạn chế thật, không phải thiếu
sót cấu hình.

**Hạn chế đã biết:** Edge Function chạy từ trung tâm dữ liệu, mà Shopee chặn IP
loại đó rất gắt. Bậc này vẫn sẽ thất bại khá thường xuyên. Đó không phải lỗi — đó
là đường đi đã tính trước, và là lý do có bậc 2.

**Chống open redirect:** tên miền được kiểm tra ở **từng bước** chuyển hướng, không
chỉ bước cuối. Một chuyển hướng trung gian ra ngoài Shopee/TikTok là đủ để từ chối.
Kiểm tra chuỗi người dùng nhập vào là không đủ, vì `shp.ee` có thể trỏ đi bất kỳ
đâu.

**Đọc giá thận trọng:** hàm `parsePriceVnd` từ chối khoảng giá
(`100.000₫ - 200.000₫`) và trả về `null` nếu không chắc. Nguyên tắc "không tự bịa
giá" nghĩa là để trống cho người dùng tự điền tốt hơn là đoán sai.

---

## `ai-credentials`

Nhận API key thô từ quản trị viên, mã hoá, rồi lưu.

**Vì sao phải có function này thay vì ghi thẳng từ trình duyệt:** nếu trình duyệt
ghi thẳng vào bảng thì key phải đi qua REST API ở dạng thô, và quan trọng hơn: khoá
mã hoá sẽ phải nằm trong mã JavaScript gửi tới trình duyệt — tức là không còn là
khoá nữa. Chỉ máy chủ mới giữ được khoá.

**Mô hình mã hoá:** AES-256-GCM. Khoá lấy từ biến môi trường
`AI_KEY_ENCRYPTION_SECRET` qua SHA-256. IV ngẫu nhiên 12 byte mỗi lần mã hoá, lưu
kèm bản mã dưới dạng `base64(iv ‖ ciphertext ‖ tag)`.

**Giới hạn thật sự của cách này:** đây là mã hoá *khi lưu trữ* (at rest), không
phải mã hoá đầu cuối. Ai có cả quyền đọc database **và** biến môi trường của Edge
Function thì giải mã được. Nó bảo vệ trước: rò rỉ bản sao lưu database, nhầm
`select` ra key, và người dùng khác đọc key của nhau. Nó **không** bảo vệ nếu toàn
bộ project Supabase bị chiếm quyền.

Với mức độ rủi ro của một website affiliate một người vận hành thì đây là mức hợp
lý. Không nên quảng cáo nó mạnh hơn thực tế.

**Xác thực hai lớp:** function dùng anon key + JWT của người dùng để Supabase tự
áp RLS khi kiểm tra quyền, rồi mới đổi sang service role cho bước *ghi* (vì cột
`encrypted_key` đã bị `REVOKE` quyền ghi của role `authenticated` — cố ý, để chỉ
đường này ghi được).

**Giai đoạn đầu chỉ admin dùng được.** Mở cho người dùng thường là một trách nhiệm
pháp lý thật: nếu key của họ rò rỉ, họ mất tiền. Schema và function đã sẵn sàng —
đổi điều kiện kiểm tra `profile?.role !== 'admin'` khi bạn sẵn sàng nhận trách
nhiệm đó.

---

## `ai-generate`

Tạo ảnh minh hoạ cho set đồ bằng API key của chính người dùng.

**Luồng:** nhận `{ provider, prompt, outfitId?, model? }` → kiểm tra quyền admin →
ghi một dòng vào `ai_jobs` → giải mã key → gọi nhà cung cấp → tải ảnh lên
Storage → cập nhật job kèm đường dẫn ảnh.

Job được ghi **trước khi** gọi nhà cung cấp, nên cả lần thất bại cũng có dấu vết
trong `/admin/ai`.

**Hai adapter.** Thêm nhà cung cấp mới chỉ cần viết một hàm cùng dạng
`(apiKey, prompt, model) => Promise<GeneratedImage[]>`:

| Nhà cung cấp | Mô hình mặc định | Chi phí |
|---|---|---|
| Gemini | `gemini-2.5-flash-image` | Gói miễn phí ~500 ảnh/ngày, không cần thẻ |
| OpenAI | `gpt-image-1` | Trả tiền theo từng ảnh |

**Tên mô hình nhận từ tham số.** Google đổi tên mô hình ảnh khá thường xuyên
(`gemini-2.0-flash-exp-image-generation` → `gemini-2.5-flash-image-preview` →
`gemini-2.5-flash-image`). Nên tên mô hình sửa được ngay trong giao diện, không
phải triển khai lại function.

**Không tự gán ảnh vào set đồ.** Function chỉ lưu ảnh và trả đường dẫn; quản trị
viên phải xem rồi tự bấm gán. Đây là một phần của quy tắc "ảnh AI luôn qua kiểm
duyệt tay". Khi gán vào một bài **đã đăng**, trigger trong database tự đưa bài về
trạng thái chờ duyệt — kể cả khi admin làm.

**API key không bao giờ vào nhật ký.** `admin_audit_log` chỉ ghi nhà cung cấp,
tên mô hình và số ảnh.

### Ba quy tắc bắt buộc với ảnh AI

1. Lưu ở dạng bản nháp, không đăng ngay.
2. Phải được duyệt tay trước khi công khai.
3. Bài hiển thị nhãn "Ảnh tạo bởi AI" kèm lưu ý rằng ảnh không đảm bảo giống
   tuyệt đối sản phẩm thật.

Không có công tắc tắt ba quy tắc này.

### Về độ chính xác của ảnh AI

Ảnh sinh ra là **ảnh minh hoạ phong cách**, không phải ảnh sản phẩm. Nó không giữ
chính xác logo, chữ in, hoạ tiết nhỏ, và thường lệch màu nhẹ. Đó là giới hạn cố
hữu của mô hình khuếch tán, không phải lỗi cấu hình.

Hệ quả thực tế: ảnh sản phẩm **thật** lấy từ link vẫn là thứ người mua dựa vào để
quyết định. Ảnh AI chỉ để set đồ trông hấp dẫn hơn ở trang danh sách.

## Ghi chú kỹ thuật

Thư mục này **bị loại khỏi `tsconfig.json`** của Next.js. Lý do: mã ở đây chạy trên
Deno, dùng `Deno.serve` và import kiểu `jsr:@supabase/supabase-js@2` — hai thứ mà
tsconfig của Node không biết, nên nếu để chung thì `npm run typecheck` sẽ báo lỗi
giả.

Kiểm tra riêng bằng `supabase functions serve` hoặc `deno check`.

Danh sách tên miền trong `fetch-product/index.ts` phải khớp với ba nơi còn lại
(SQL, TypeScript, Python). `npm run verify:helper` kiểm tra đúng điều đó.
