# Local Helper

Bậc 2 của luồng lấy dữ liệu sản phẩm. Chạy trên máy cá nhân của bạn, đọc thông tin
sản phẩm từ link Shopee hoặc TikTok trên **IP nhà mạng thật** — thứ mà Edge
Function trên cloud không làm được vì các sàn chặn IP trung tâm dữ liệu.

---

## Hai đường, thử đường rẻ trước

| | Cách | Thời gian | Khi nào dùng |
|---|---|---|---|
| Đường 1 | HTTP thuần (`httpx`) | 0,6 – 1 giây | Luôn thử trước |
| Đường 2 | Trình duyệt thật (Playwright) | 5 – 15 giây | Chỉ khi đường 1 thất bại |

**Nghịch lý đo được trên link thật:** Shopee **chặn trình duyệt bị điều khiển tự
động** — cả Chromium đi kèm Playwright lẫn Chrome thật của máy, cả link rút gọn
lẫn URL sản phẩm trực tiếp, đều bị đẩy sang `/verify/traffic/error`. Nhưng HTTP
thuần thì đi qua bình thường.

Lý do hợp lý: một yêu cầu HTTP **không phải trình duyệt**, nên không có dấu vết
tự động hoá nào để phát hiện. Càng "đơn giản" càng ít bị chặn.

Hệ quả thiết kế: trình duyệt được khởi động **lười** — chỉ mở ở lần đầu tiên có
job mà HTTP không xử lý được. Với Shopee, thường là không bao giờ.

Kết quả thật trên hai link đã test:

```
vn.shp.ee/PNqCvjDn → Áo Thun Len Dệt Kim Phối Cổ Tròn... - ALH05 ATN103   0,9s
vn.shp.ee/MZrB8qhn → [BEST SELLER] Áo polo nam BASIC SYMBOL...            0,6s
```

Cả hai lấy được tên và ảnh. **Giá thì không** — thẻ Open Graph của Shopee không
chứa giá, nên giá luôn phải nhập tay. Đây là hạn chế thật, không phải lỗi cấu hình.

---

## Đọc trước khi chạy

**Website không có đường nào gọi vào máy bạn.** Chương trình này *chủ động* hỏi
database "có việc gì không". Website chỉ ghi một dòng vào bảng `fetch_jobs`. Không
mở cổng, không ngrok, không webhook đi vào.

Hệ quả thực tế: nếu website bị chiếm quyền, kẻ tấn công tối đa tạo được job rác.
Không chạy được lệnh nào trên máy bạn.

**Không tự vượt CAPTCHA.** Nếu trang hỏi CAPTCHA, chương trình dừng lại, hiện cửa
sổ trình duyệt lên và chờ **bạn** tự bấm trong 90 giây. Người thật giải CAPTCHA
không phải là vượt rào. Nếu bạn không có mặt, job báo thất bại và website chuyển
sang cho nhập tay.

**Không tự chạy theo lịch.** Chỉ làm khi có job do *người* bấm nút trên website
tạo ra. Không đi cào hàng loạt.

**Tên miền được kiểm tra lại ở đây, không tin database.** Dù job đến từ đâu, URL
phải thuộc một trong các tên miền gốc ở `ALLOWED_ROOT_DOMAINS` mới được mở. Sau khi chuyển hướng, tên miền
đích cũng bị kiểm tra lại — đây là chỗ chặn open redirect.

---

## Cài đặt

```bash
cd local-helper

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
playwright install chromium
```

Khuyến nghị Python 3.11 hoặc mới hơn. Bản 3.9 chạy được nhưng chậm hơn.

```bash
cp .env.example .env
```

Điền hai giá trị, lấy ở Supabase → Project Settings → API:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Vì sao cần service role key

Chương trình phải đọc bảng `fetch_jobs` của **mọi** người dùng, không chỉ của một
phiên đăng nhập. Đó là lý do duy nhất.

Khoá này bỏ qua toàn bộ Row Level Security. Ai có nó đều đọc và sửa được mọi dữ
liệu của mọi người dùng. Cho nên:

- File `.env` đã nằm trong `.gitignore` — đừng gỡ nó ra.
- Không đặt khoá này vào `.env.local` của Next.js.
- Không đặt vào bất kỳ biến có tiền tố `NEXT_PUBLIC_`.
- Nếu nghi đã rò rỉ: Supabase → Project Settings → API → Rotate.

---

## Chạy thử một link ngay, không cần Supabase

```bash
.venv/bin/python helper.py --test-url "https://vn.shp.ee/PNqCvjDn"
```

Chạy được ngay sau `pip install` — không phải tạo project Supabase, không phải có
service role key. Dùng để kiểm tra cài đặt, hoặc gỡ lỗi khi một link báo "không
đọc được tên sản phẩm".

---

## Chạy

```bash
python helper.py
```

Để nguyên cửa sổ terminal đó. Chương trình sẽ hỏi database mỗi 3 giây và in ra
những gì nó làm.

Tuỳ chọn:

```bash
python helper.py --headless      # không hiện cửa sổ (CAPTCHA sẽ thất bại)
python helper.py --once          # xử lý hết job đang chờ rồi thoát
python helper.py --interval 5    # đợi 5 giây giữa hai lần hỏi
```

Dừng bằng `Ctrl+C`. Nó sẽ hoàn thành job đang làm rồi mới thoát.

---

## Cách dùng thực tế

1. Mở terminal, chạy `python helper.py`, để đó.
2. Trên website, vào `/tao-bai` hoặc `/admin/san-pham`.
3. Dán link Shopee, bấm "Lấy thông tin".
4. Website thử bậc 1 trước (Edge Function, khoảng 2 giây). Nếu sàn chặn IP trung
   tâm dữ liệu, yêu cầu tự chuyển sang Local Helper.
5. Bạn thấy dòng job hiện ra trong terminal. Thường dưới 1 giây (đường HTTP),
   tên và ảnh tự điền vào form. Giá phải nhập tay.
6. Kiểm tra lại rồi bấm Lưu.

Nếu Local Helper không chạy, website chờ 45 giây rồi bảo bạn nhập tay. Không có gì
bị treo.

---

## Thư mục `.browser-profile/`

Chương trình lưu phiên trình duyệt ở đây. Nhờ nó mà sau khi bạn giải CAPTCHA một
lần, những lần sau thường không bị hỏi lại.

Thư mục này chứa **cookie đăng nhập của chính bạn** trên Shopee và TikTok. Nó đã
nằm trong `.gitignore` và tuyệt đối không được commit hay đưa lên cloud.

Muốn xoá sạch phiên: `rm -rf .browser-profile/`

---

## Kiểm chứng

```bash
python3 verify_helper.py
```

81 phép kiểm tra, không cần cài httpx hay playwright (hai thư viện đó được thay
bằng bản giả lập). Kiểm tra:

- `url_host` chống được ba kỹ thuật che tên miền, gồm `https://shopee.vn@evil.com/`
- `parse_price_vnd` **từ chối** khoảng giá thay vì đoán lấy số đầu — hiển thị sai
  giá còn tệ hơn để trống cho người dùng tự điền
- `looks_like_captcha` nhận được cả tiếng Việt có dấu
- Danh sách tên miền khớp nhau giữa **bốn** nơi: Python, SQL, TypeScript, Edge
  Function
- `is_generic_title` **không** từ chối nhầm tên sản phẩm thật — mọi tiêu đề sản
  phẩm Shopee đều kết thúc bằng "| Shopee Việt Nam", nên so khớp chuỗi con sẽ
  loại đúng mọi sản phẩm hợp lệ. Test dùng chính hai tiêu đề thật đã đo được.
- `is_bot_check_url` nhận ra `/verify/traffic/error` — Shopee trả HTTP 200 cho
  trang đó, nên chỉ kiểm tra mã trạng thái là không đủ

Phép kiểm tra cuối cùng đáng chú ý nhất. Bốn nơi rất dễ bị sửa lệch nhau, và hậu
quả rất khó hiểu: form báo link hợp lệ nhưng database từ chối, hoặc Local Helper
mở một tên miền mà web không cho nhập.

---

## Khắc phục sự cố

**"Thieu cau hinh"** — chưa tạo `.env` hoặc chưa điền giá trị.

**"Loi trinh duyet: Timeout"** — mạng chậm, hoặc sàn không trả lời. Job tự thử lại
một lần nữa, sau đó bỏ và chuyển sang nhập tay.

**"San chuyen huong sang trang chong bot"** — Shopee phát hiện trình duyệt tự
động. Không có cách nào sửa từ phía chương trình mà không giả mạo dấu vân tay
trình duyệt, và đó là thứ dự án này cố ý không làm. Dùng tiện ích Chrome hoặc
nhập tay.

**"Trang hoi CAPTCHA"** — nhìn sang cửa sổ Chromium và tự bấm. Nếu bị hỏi liên
tục, giảm tần suất: dán ít link hơn mỗi lần, và đừng chạy nhiều bản cùng lúc.

**"Mo duoc trang nhung khong doc duoc ten san pham"** — thường là bạn dán link
trang danh sách hoặc trang tìm kiếm chứ không phải trang một sản phẩm cụ thể.

**Job nằm mãi ở trạng thái `pending`** — Local Helper không chạy, hoặc `.env` trỏ
sang project Supabase khác.
