# Tiện ích Chrome — PHỐI

Đọc thông tin sản phẩm từ trang Shopee hoặc TikTok Shop bạn **đang tự mở**, rồi
chuyển sang trang tạo bài của PHỐI với dữ liệu đã điền sẵn.

Đây là cách lấy dữ liệu **ổn định nhất** trong tất cả các cách. Lý do đơn giản:
bạn đang duyệt web bình thường bằng trình duyệt của chính bạn — không có tín hiệu
tự động hoá nào để sàn phát hiện, không CAPTCHA, không chặn IP.

Đổi lại, bạn phải mở từng trang sản phẩm thay vì dán hàng loạt link.

---

## Cài đặt

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Bấm **Load unpacked**, chọn thư mục `chrome-extension/`
4. Ghim tiện ích vào thanh công cụ cho dễ bấm

Dùng được với Chrome, Edge, Brave, Arc và mọi trình duyệt nền Chromium.

---

## Dùng

1. Mở một trang sản phẩm trên `shopee.vn` hoặc `tiktok.com`
2. Bấm vào biểu tượng tiện ích
3. Lần đầu: điền địa chỉ PHỐI của bạn (ví dụ `https://phoi.pages.dev`, hoặc
   `http://localhost:3000` khi chạy ở máy). Nó được ghi nhớ cho các lần sau.
4. Bấm **Đọc trang và gửi**

Một tab mới mở ra ở trang tạo bài, sản phẩm đã điền sẵn tên, giá và ảnh. Bạn kiểm
tra lại, chọn màu, rồi gửi duyệt.

Nút **Chỉ sao chép JSON** dùng khi bạn muốn tự xử lý dữ liệu.

---

## Tiện ích này không làm gì

Không lưu mật khẩu. Không đọc cookie đăng nhập. Không gửi gì tới máy chủ nào ngoài
địa chỉ PHỐI bạn tự điền. Không chạy nền — chỉ hoạt động khi bạn bấm vào nó.

Quyền xin trong `manifest.json` là mức tối thiểu:

| Quyền | Để làm gì |
|---|---|
| `activeTab` | Đọc tab đang mở, chỉ khi bạn bấm vào tiện ích |
| `scripting` | Chèn hàm đọc DOM vào trang |
| `storage` | Ghi nhớ địa chỉ PHỐI bạn đã điền |
| `host_permissions` | Chỉ `shopee.vn` và `tiktok.com`, không phải mọi trang |

---

## Dữ liệu đi qua hash của URL, không phải query string

Tiện ích mở `https<!---->://phoi.pages.dev/tao-bai/#phoi=<base64>`.

Đặt ở phần **hash** (`#`) là có chủ đích: theo cách hoạt động của HTTP, phần hash
**không được gửi lên máy chủ**. Nên tên sản phẩm và link của bạn không nằm trong
log truy cập của Cloudflare hay bất kỳ máy chủ trung gian nào.

Trang tạo bài đọc hash trong hàm khởi tạo state, rồi xoá hash ngay — bấm tải lại
trang sẽ không điền lại lần nữa.

Website vẫn kiểm tra lại tên miền của link dù dữ liệu đến từ tiện ích của chính
mình: tiện ích có thể bị sửa, và hash trong URL thì ai cũng gõ được bằng tay.

---

## Đọc giá thận trọng

Hàm đọc giá **từ chối** khoảng giá (`100.000₫ - 200.000₫`) thay vì đoán lấy số
đầu, và trả về trống nếu không chắc. Hiển thị sai giá còn tệ hơn là để trống cho
bạn tự điền.

Khi không đọc được giá, tiện ích nói rõ và bạn nhập tay trên PHỐI.

---

## Khi không đọc được

Nếu tiện ích báo không tìm thấy tên sản phẩm, thường là do:

- Bạn đang ở trang danh sách hoặc trang tìm kiếm, không phải trang một sản phẩm
- Trang chưa tải xong — đợi vài giây rồi bấm lại
- Sàn vừa đổi cấu trúc trang

Trong mọi trường hợp, ba bậc lấy dữ liệu trên website vẫn dùng được, và nhập tay
thì luôn hoạt động.
