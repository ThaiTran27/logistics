# Smart Logistics

Ứng dụng quản lý giao nhận gồm frontend React/Vite, backend Express/Node.js, MySQL và cập nhật thời gian thực qua Socket.IO. Tài liệu này hướng dẫn cài đặt local và kiểm tra các luồng nghiệp vụ theo thứ tự.

## 1. Thành phần và đường dẫn

- `frontend/`: giao diện React, Vite, Tailwind CSS.
- `backend/`: API Express, Socket.IO, kết nối MySQL, tải ảnh và tài liệu.
- `backend/smart_logistics_v2.sql`: tạo schema và dữ liệu mẫu.
- `shared/hcmc-legacy-boundary.geojson`: dữ liệu vùng phục vụ TP. Hồ Chí Minh dùng cho bản đồ và kiểm tra tọa độ.

## 2. Yêu cầu trước khi chạy

- Node.js 22.12 trở lên và npm (đi kèm Node.js). Phiên bản này đáp ứng lệnh `--env-file-if-exists` của backend và yêu cầu của Vite.
- MySQL 8.0 trở lên đang chạy trên máy local.
- MySQL Workbench (khuyến nghị để nạp file SQL) hoặc MySQL Client.
- Git để tải mã nguồn nếu bạn chưa có thư mục dự án.
- Trình duyệt hiện đại. Camera, microphone hoặc GPS cần được cấp quyền khi kiểm tra các tính năng tương ứng.

Mở PowerShell hoặc terminal trong VS Code tại thư mục gốc dự án (thư mục có `backend`, `frontend` và `README.md`). Kiểm tra Node.js/npm:

```powershell
node --version
npm --version
```

Backend hiện kết nối MySQL trực tiếp trong `backend/server.js`, không đọc thông tin kết nối database từ `.env`:

| Thuộc tính | Giá trị mặc định |
|---|---|
| Host | `localhost` |
| User | `root` |
| Password | rỗng |
| Database | `smart_logistics_v2` |

Nếu MySQL của bạn dùng tài khoản/mật khẩu khác, hãy sửa đúng các thuộc tính `host`, `user`, `password` trong đối tượng `mysql.createConnection` của `backend/server.js` cho môi trường local trước khi chạy backend. Không đặt mật khẩu thật vào Git hoặc chia sẻ mã nguồn có mật khẩu; không dùng cấu hình mặc định này cho môi trường production.

## 3. Cài đặt database

### 3.1. Lưu ý trước khi nạp SQL

> **Cảnh báo: thao tác này xóa dữ liệu.** File `backend/smart_logistics_v2.sql` chọn database `smart_logistics_v2`, xóa rồi tạo lại các bảng ứng dụng được liệt kê trong script và nạp dữ liệu mẫu. Chạy lại script sẽ làm mất đơn hàng, tài khoản và dữ liệu nghiệp vụ đang có trong các bảng đó. Chỉ nạp vào môi trường test hoặc sao lưu trước; tuyệt đối không chạy trên database có dữ liệu cần giữ.

Script **không xóa toàn bộ database**: nếu database chưa tồn tại thì script tự tạo; nếu đã có thì những bảng ứng dụng mà script quản lý sẽ bị tạo lại. Backend còn tự tạo một số bảng mở rộng bằng `CREATE TABLE IF NOT EXISTS` sau khi kết nối thành công.

### 3.2. Nạp database bằng MySQL Workbench (khuyến nghị)

1. Mở MySQL Workbench và kết nối tới MySQL local. Nếu chưa có kết nối, tạo kết nối với `Hostname: localhost`, `Port: 3306`, `Username: root`; nhập mật khẩu của MySQL khi được hỏi. Mật khẩu kết nối Workbench là mật khẩu MySQL trên máy bạn, không nhất thiết rỗng.
2. Trong Workbench, chọn **File → Open SQL Script...**, mở file `backend/smart_logistics_v2.sql` trong thư mục dự án. Đường dẫn thường là `<thư-mục-dự-án>\backend\smart_logistics_v2.sql`.
3. Kiểm tra tab SQL đang dùng kết nối local đúng. Chọn **Execute All** (biểu tượng tia sét) để chạy toàn bộ script, không chỉ chạy câu lệnh tại vị trí con trỏ.
4. Chờ chạy xong. Kết quả cuối script là `Database smart_logistics_v2 đã được khởi tạo thành công!`. Nếu Workbench báo lỗi, đọc dòng lỗi đầu tiên và kiểm tra kết nối/phiên bản MySQL; không tiếp tục bằng cách chạy đi chạy lại script trên database có dữ liệu cần giữ.
5. Làm mới **SCHEMAS** ở khung bên trái. Mở schema `smart_logistics_v2` và xác nhận đã có các bảng như `users`, `orders`, `warehouses`, `order_status_history`, `shipment_bags` và `linehaul_trips`.

Script nạp sẵn kho tổng, kho con Gò Vấp và Quận 1, tài khoản dùng thử, đơn vận chuyển mẫu, tin tức, yêu cầu dịch vụ/ứng tuyển, nghỉ phép, chấm công và dữ liệu nhân sự. Các bảng `users` và `orders` là nơi lưu thông tin tài khoản và vận đơn; lịch sử trạng thái nằm trong `order_status_history`; dữ liệu kho nằm trong `warehouses` và `warehouse_bin_locations`; luồng bao/chuyến liên kho dùng các bảng `shipment_bags`, `shipment_bag_orders`, `linehaul_trips` và `linehaul_trip_bags`.

### 3.3. Kiểm tra schema và dữ liệu mẫu

Trong một tab SQL Workbench mới, chọn schema `smart_logistics_v2` làm schema mặc định (nhấp đúp vào schema) rồi chạy các câu lệnh sau:

```sql
USE smart_logistics_v2;

SELECT DATABASE() AS database_dang_chon;
SHOW TABLES;

SELECT COUNT(*) AS so_tai_khoan FROM users;
SELECT COUNT(*) AS so_don_hang FROM orders;
SELECT tracking_code, status
FROM orders
WHERE tracking_code LIKE 'SLTEST%'
ORDER BY tracking_code;

SELECT id, warehouse_type, ward_name, name, is_active
FROM warehouses
ORDER BY id;
```

Kết quả đúng với file seed hiện tại: `database_dang_chon` là `smart_logistics_v2`, có **19 tài khoản**, **9 đơn hàng** (trong đó có 8 mã `SLTEST...`), và có dữ liệu kho tổng/kho con. Nếu số lượng khác, kiểm tra tab **Action Output** xem toàn bộ script đã chạy hết chưa và xác nhận đang xem đúng schema.

> Không cần tự tạo bảng hoặc tự nhập các tài khoản mẫu bằng tay. Sau khi kết nối database thành công, backend sẽ tự tạo bổ sung các bảng mở rộng còn thiếu; phần dữ liệu ban đầu vẫn cần được nạp từ file SQL ở bước trên.

## 4. Cấu hình tùy chọn

Các giá trị trong phần này **không phải cấu hình kết nối MySQL**. File mẫu `backend/.env.example` dành cho các tính năng tùy chọn. Nếu cần dùng, tại thư mục gốc dự án tạo bản sao:

```powershell
Copy-Item backend\.env.example backend\.env
```

Sau đó mở `backend/.env` và điền những giá trị bạn thực sự dùng:

```dotenv
# Chat AI: để trống sẽ dùng trợ lý FAQ tích hợp sẵn
CHAT_AI_API_KEY=
CHAT_AI_BASE_URL=https://api.openai.com/v1
CHAT_AI_MODEL=gpt-4o-mini

# Dùng giá trị bí mật ổn định riêng cho mỗi môi trường
WEBHOOK_ENCRYPTION_KEY=
JWT_SECRET=

# SMTP chỉ cần khi cần gửi email thông báo/hóa đơn thật
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
```

Không đưa khóa bí mật, mật khẩu thật hoặc thông tin SMTP vào Git. Giữ `JWT_SECRET` và `WEBHOOK_ENCRYPTION_KEY` ổn định giữa các lần khởi động nếu đang cần duy trì phiên đăng nhập hoặc giải mã bí mật webhook đã lưu. Nếu `JWT_SECRET` chưa cấu hình, backend sinh khóa mới khi khởi động; các token cũ sẽ mất hiệu lực sau khi restart.

Frontend mặc định gọi API ở `http://localhost:5000`. Chỉ tạo `frontend/.env` nếu backend chạy ở địa chỉ khác:

```dotenv
VITE_API_URL=http://localhost:5000
```

## 5. Khởi động ứng dụng

Trước khi chạy, đảm bảo MySQL đang hoạt động và đã hoàn thành mục 3. Mở **hai cửa sổ terminal riêng**, mỗi cửa sổ bắt đầu tại thư mục gốc dự án. Cài dependencies một lần cho từng phần; nếu vừa tải mã nguồn hoặc chưa có thư mục `node_modules`, chạy `npm ci`.

### Terminal 1 — backend

```powershell
cd backend
npm ci
npm start
```

Giữ terminal này mở. Khi thành công, terminal phải hiện thông báo `Đã kết nối Database: smart_logistics_v2` và backend lắng nghe tại `http://localhost:5000`. Mở `http://localhost:5000/api/docs` để xác nhận API hoạt động.

### Terminal 2 — frontend

```powershell
cd frontend
npm ci
npm run dev
```

Mở địa chỉ local Vite in ra trong terminal, thường là `http://localhost:5173`. Đăng nhập bằng một email trong mục 6 và mật khẩu seed `123`.

Các lệnh frontend khác:

```powershell
npm run build
npm run lint
npm run preview
```

Backend hiện chưa có test tự động; script `npm test` chỉ thông báo chưa cấu hình test và trả về lỗi.

## 6. Tài khoản thử nghiệm

Các tài khoản bên dưới được tạo trong SQL seed. Mật khẩu seed là `123`. Sau lần đăng nhập đầu tiên, backend chuyển mật khẩu dạng cũ sang dạng hash.

| Phân hệ | Email |
|---|---|
| Giám đốc | `admin@smartlogistics.vn` |
| Nhân sự | `hr@smartlogistics.vn`, `hr2@smartlogistics.vn` |
| Điều hành | `dieu_hanh@smartlogistics.vn`, `dieu_hanh2@smartlogistics.vn` |
| Kế toán | `ketoan@smartlogistics.vn`, `ketoan2@smartlogistics.vn` |
| Kho | `kho@smartlogistics.vn` (Kho Tổng), `kho2@smartlogistics.vn` (Gò Vấp), `kho3@smartlogistics.vn` (Quận 1) |
| Cửa hàng/Shop | `shop@smartlogistics.vn`, `shop2@smartlogistics.vn` |
| Tài xế lấy hàng | `taixe1@smartlogistics.vn`, `taixe2@smartlogistics.vn` |
| Tài xế giao hàng | `taixe3@smartlogistics.vn`, `taixe4@smartlogistics.vn` |
| Tài xế xe tải trung chuyển liên kho | `taixe_tai1@smartlogistics.vn` |
| Nội dung | `content@smartlogistics.vn`, `content2@smartlogistics.vn` |

Tài khoản `kho@smartlogistics.vn` được gán Kho Tổng; `kho2@smartlogistics.vn` được gán Gò Vấp; `kho3@smartlogistics.vn` được gán Quận 1. Tài khoản `taixe_tai1@smartlogistics.vn` thuộc riêng đội xe tải liên kho: tài khoản này chỉ nhận chuyến xe/bao, không nhận nhiệm vụ lấy hàng tại Shop hoặc giao hàng. SQL seed chưa tạo sẵn tài khoản `customer_service`; cần tạo tài khoản có đúng role nếu muốn kiểm tra luồng đó. Tài khoản chỉ được mở phân hệ đúng với quyền được cấp.

Nếu database đã được tạo từ trước, không chạy lại toàn bộ SQL seed chỉ để thêm tài khoản test (script sẽ xóa và tạo lại dữ liệu). Tạo nhân viên mới tại `/nhan-su` với role **Tài xế xe tải (Line-haul)**; đồng thời cần có tài khoản quản lý kho được gán đúng kho Quận 1 để test khâu nhận cuối. Nếu cần dữ liệu test sạch, chỉ import seed vào database test mới.

## 7. Checklist kiểm tra luồng giao nhận chính

Phần này kiểm tra **một đơn mới từ Shop đến người nhận**. Làm lần lượt từ A đến J; không chuyển bước nếu trạng thái chưa đúng. Khi đổi vai trò, bấm **Đăng xuất** trước rồi đăng nhập tài khoản kế tiếp trong cùng trình duyệt. Giữ lại mã vận đơn tạo ở bước A để tìm đúng một đơn xuyên suốt bài test.

### Trước khi bắt đầu

1. Khởi động MySQL và kiểm tra service đang chạy.
2. Mở terminal thứ nhất, chạy backend bằng `cd backend`, `npm start`; để cửa sổ này tiếp tục chạy. Terminal cần báo database đã kết nối và server nghe cổng `5000`.
3. Mở terminal thứ hai, chạy frontend bằng `cd frontend`, `npm run dev`; mở địa chỉ Vite hiện ra, thường là `http://localhost:5173`.
4. Dùng dữ liệu test, không dùng đơn thật. Đăng nhập bằng email tài khoản và mật khẩu `123`.
5. Ở bài test này, email người nhận có thể để trống. OTP đã được bỏ; lúc giao thành công chỉ chụp ảnh và lấy chữ ký.

### Trạng thái cần thấy theo thứ tự

| Sau thao tác | Trạng thái dự kiến |
|---|---|
| Shop gửi đơn | `pending` |
| Điều hành gán tài xế lấy hàng | `picking` |
| Tài xế xác nhận đã lấy | `picked_up` |
| Kho Gò Vấp nhận đơn | `at_origin_warehouse` |
| Xe tải rời kho nguồn | `transferring_to_central` |
| Kho tổng nhận đơn | `at_central_warehouse` |
| Xe tải rời kho tổng | `transferring_to_destination` |
| Kho đích nhận đơn | `at_destination_warehouse` |
| Tài xế giao bắt đầu giao | `delivering` |
| Tài xế xác nhận giao thành công | `completed` |

Tên trạng thái có thể hiển thị bằng tiếng Việt trên màn hình. Nếu trạng thái chưa đổi, tải lại danh sách một lần và kiểm tra đúng mã vận đơn; không tạo đơn trùng ngay lập tức.

### A. Tạo đơn — Shop

1. Mở trang ứng dụng, đăng nhập `shop2@smartlogistics.vn`, mật khẩu `123`.
2. Mở `/cua-hang`. Ở menu bên trái bấm **Thông Tin Shop**.
3. Nếu chưa cài hồ sơ: điền tên Shop và số điện thoại. Ở ô tìm địa chỉ nhập `Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh`, bấm **Tìm**, chọn một kết quả hiện ra, rồi bấm **Lưu thông tin Shop**. Nếu đã có hồ sơ thì kiểm tra tên và địa chỉ, không cần nhập lại.
4. Bấm menu **Tạo Đơn Giao Hàng**. Phần trên form phải hiện địa chỉ lấy hàng đã lưu. Đây là điểm lấy mặc định; không cần chọn lại cho mỗi đơn.
5. Nhập dữ liệu test dưới đây (số điện thoại là dữ liệu giả; email người nhận tùy chọn, chỉ nhận email thông báo trạng thái, không còn OTP):

   | Trường | Giá trị để nhập |
   |---|---|
   | Tên người nhận | `Nguyễn Thị Mai Test` |
   | Số điện thoại | `0901000010` |
   | Email người nhận | Để trống hoặc nhập email bạn có thể mở để nhận thông báo trạng thái |
   | Địa chỉ Shop/điểm lấy | Tự điền từ hồ sơ Shop đã lưu |
   | Địa chỉ giao | Tìm kiếm địa chỉ hoặc chọn trên bản đồ; có thể chọn bất kỳ khu vực nào trong TP. Hồ Chí Minh |
   | Cân nặng | `1` kg |
   | Dài × rộng × cao | `10` × `10` × `10` cm |
   | Giá trị hàng | `0` |
   | COD | `0` cho lượt test không cần ký quỹ |
   | Người trả cước | Người gửi |
   | Dịch vụ | Tiêu chuẩn |
   | Hàng dễ vỡ / vùng xa | Không |

6. Trong trường **Địa chỉ giao hàng chi tiết**, nhập `Số 15 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh`, bấm **Tìm địa chỉ**, đợi kết quả rồi bấm chọn địa chỉ phù hợp. Nếu không tìm được, bấm **Chọn trên bản đồ**, chờ bản đồ tải và bấm một điểm trong TP.HCM. Dòng trạng thái bên cạnh phải hiện **Đã chọn điểm giao** cùng tọa độ. Không cần nhập tọa độ bằng tay.
7. Kiểm tra các trường bắt buộc và bấm nút gửi/tạo đơn ở cuối form. Khi hộp thoại báo tạo thành công, **chép mã vận đơn** ra chỗ tạm; mã này dùng ở các bước B–J. Đơn mới phải hiện trong **Quản Lý Vận Đơn**.
8. (Tùy chọn) Tạo thêm đơn thử để kiểm tra địa chỉ lấy hàng vẫn tự điền sau khi gửi đơn trước. Không dùng mã ví dụ `SLTEST...` thay cho mã đơn vừa tạo.

**Kỳ vọng:** đơn tạo thành công với trạng thái `pending`. Tọa độ Shop được lấy từ hồ sơ và thuộc TP. Hồ Chí Minh; tọa độ giao được phép ở bất kỳ địa chỉ nào trong TP. Hồ Chí Minh. Sau khi tạo đơn, địa chỉ lấy hàng vẫn được giữ cho đơn tiếp theo. Với vị trí Shop gần `10.8231, 106.6881`, kho nguồn gần nhất cần là kho con Gò Vấp.

**Kiểm tra cập nhật hồ sơ:** vào **Thông Tin Shop**, đổi số điện thoại hoặc địa chỉ/vị trí, lưu rồi tải lại trang. Tên và địa chỉ mới phải còn nguyên; đơn tiếp theo phải tự dùng vị trí Shop mới. Email đăng nhập chỉ đọc và không đổi được từ màn hình này.

### B. Phân tài xế lấy hàng — Điều hành

1. Đăng xuất Shop; đăng nhập `dieu_hanh@smartlogistics.vn`, mật khẩu `123`.
2. Mở `/dieu-hanh`, vào màn **Phân Tuyến Tài Xế**.
3. Tìm/nhấn đơn theo mã vận đơn đã chép ở bước A. Trước khi thao tác, đối chiếu tên người nhận `Nguyễn Thị Mai Test`.
4. Chọn chặng **Lấy hàng tại Shop** (`pickup`), chọn tài xế lấy hàng `taixe2@smartlogistics.vn`, rồi bấm nút xác nhận/lưu phân công.
5. Tải lại danh sách hoặc mở lại chi tiết đơn để xem trạng thái và kho nguồn hệ thống chọn. Vị trí Shop gần Gò Vấp thì kho nguồn dự kiến là **Kho Gò Vấp**.

**Kỳ vọng:** đơn sang `picking`; đơn xuất hiện trong danh sách nhiệm vụ của `taixe2`. Với tọa độ Shop gần `10.8231, 106.6881`, kho nguồn cần là kho con Gò Vấp.

### C. Lấy hàng tại Shop — Tài xế lấy hàng

1. Đăng xuất Điều hành; đăng nhập `taixe2@smartlogistics.vn`, mật khẩu `123`.
2. Mở `/tai-xe`, tìm đơn `Nguyễn Thị Mai Test` có đúng mã vận đơn.
3. Bấm **Mở camera quét mã nhận hàng** và cho phép trình duyệt dùng camera. Đưa mã vạch của đúng đơn vào khung quét.
4. Nếu camera không hoạt động/không đọc được, nhập **mã vận đơn thật vừa tạo ở bước A** vào ô dự phòng rồi nhấn **Xác nhận**. Không nhập mã ở ví dụ trong README. Có thể dùng máy quét USB/Bluetooth: đặt con trỏ vào ô dự phòng và quét nhãn.
5. Nếu hiện “Mã quét không khớp”, đối chiếu mã đang hiện trong hộp quét với nhãn; nếu hiện lỗi kết nối, kiểm tra backend đang chạy ở cổng `5000`.

**Kỳ vọng:** chỉ mã khớp với đơn đang mở mới được xác nhận; thông báo thành công hiện ra và trạng thái đơn sang `picked_up`. Sau đó bàn giao kiện cho Kho Gò Vấp quét nhập. Phải ở `/tai-xe`, không phải `/dieu-hanh`.

### D. Nhập kho nguồn — Kho

1. Đăng xuất tài xế; đăng nhập `kho2@smartlogistics.vn`, mật khẩu `123`.
2. Mở `/kho` → **Máy Quét Mã Vạch**. Trước khi quét, kiểm tra tên kho đang chọn là **Kho con Gò Vấp**.
3. Tại phần **Tạo nhãn vị trí kệ mới**, nhập mã `TEST-A1-03` và tên `Kệ test Gò Vấp`, sau đó nhấn **Tạo mã và nhãn mã vạch**. Nếu mã này đã tồn tại từ lần test trước, đổi mã thành `TEST-A1-04`. Khi tạo thành công, giao diện tự chọn vị trí vừa tạo.
4. Nhập/quét đúng mã vận đơn đã ghi ở bước A. Nếu không có máy quét, nhập mã vào ô lớn bên dưới rồi nhấn Enter.
5. Xác nhận kết quả nhập kho; mở danh sách tồn kho để kiểm tra đơn và vị trí kệ `TEST-A1-03` (hoặc mã mới bạn vừa tạo).

**Kỳ vọng:** đơn sang `at_origin_warehouse`, hiện trong tồn kho Gò Vấp tại vị trí kệ vừa tạo. Nếu thông báo đơn được phân tuyến đến kho khác, dừng tại đây: đơn phải được tạo với vị trí Shop gần Gò Vấp **trước khi Điều hành phân công**, vì đổi địa chỉ sau khi phân công không đổi kho nguồn.

Kho nguồn được hệ thống xác định khi Điều hành phân công tài xế lấy hàng: hệ thống chọn kho con đang hoạt động gần tọa độ Shop nhất. Ví dụ, tọa độ Shop mặc định `10.762622, 106.660172` gần kho Quận 1 hơn kho Gò Vấp. Vì tài khoản `kho2` chỉ thao tác tại kho Gò Vấp, đơn được tạo ở vị trí mặc định có thể không quét nhận được tại tài khoản này. Nếu quét sai kho, backend trả tên kho được phân tuyến và tên kho đang chọn; với bộ dữ liệu mẫu ở bước A, kho nguồn dự kiến là Gò Vấp.

### E. Gửi bao từ kho nguồn → kho tổng — đội xe tải riêng

1. Đăng xuất tài xế lấy hàng; đăng nhập `kho2@smartlogistics.vn`. Mở `/kho` → **Nhập / Xuất Bao Liên Kho**.
2. Tạo bao với kho đi **Gò Vấp** và kho đến **Kho Tổng**. Chọn bao vừa tạo.
3. Quét/nhập mã vận đơn đã ghi ở bước A vào bao. Có thể nhập nhiều mã liên tiếp; danh sách và số đơn trong bao sẽ cập nhật.
4. Bấm **Niêm phong bao đã quét đủ**. Không chuyển đơn lẻ cho tài xế lấy hàng.
5. Đăng nhập Điều hành `dieu_hanh@smartlogistics.vn`, mở **Quản lý xe & chuyến**. Tạo chuyến Gò Vấp → Kho Tổng; bắt buộc chọn xe tải và tài xế riêng `taixe_tai1@smartlogistics.vn`. Gán bao đã niêm phong đúng tuyến vào chuyến.
6. Đăng xuất Điều hành; đăng nhập `taixe_tai1@smartlogistics.vn`, mở `/tai-xe`. Tài xế xe tải quét mã từng bao được giao, sau đó bấm bắt đầu chuyến. Khi tới nơi, xác nhận đã đến kho.
7. Đăng nhập tài khoản kho con đích, ví dụ `kho3@smartlogistics.vn` cho Quận 1, mở **Nhập / Xuất Bao Liên Kho** và nhập mã bao.

**Kỳ vọng:** đơn đi qua `transferring_to_central` khi xe rời kho nguồn, sau đó sang `at_central_warehouse` khi Kho Tổng quét nhận. Màn hình sau quét hiển thị toàn bộ mã vận đơn trong bao. Tài xế lấy hàng Shop không xuất hiện trong danh sách tài xế xe tải và không thể được gán cho chuyến.

### F. Gửi bao từ Kho Tổng → kho đích và phân tài xế giao

1. Ở Kho Tổng, vào **Nhập / Xuất Bao Liên Kho**, tạo bao đi từ **Kho Tổng** đến kho đích theo địa chỉ người nhận.
2. Quét các mã đơn đang nằm trong tồn Kho Tổng vào bao; kiểm tra đủ mã cần gửi rồi bấm niêm phong.
3. Trong **Quản lý xe & chuyến**, tạo chuyến Kho Tổng → kho đích; chọn xe tải và tài xế `linehaul_driver`, rồi gán bao đúng tuyến.
4. Tài xế xe tải riêng đăng nhập `/tai-xe`, quét bao, khởi hành và báo đã đến.
5. Tại kho đích, đăng nhập tài khoản kho tương ứng, mở **Nhập / Xuất Bao Liên Kho** và nhập mã bao.
6. Đối chiếu danh sách mã đơn được hiển thị ngay sau khi quét. Nếu kho hiện tại là kho đích, chọn tài xế giao hàng rồi bấm **Phân các đơn chờ giao** để phân các đơn trong bao cùng lúc. Đơn có khoản phải thu vẫn cần tài xế đủ ký quỹ; các đơn không phân được sẽ hiện trong thông báo để kiểm tra/phân lại.

**Kỳ vọng:** các đơn sang `transferring_to_destination` lúc xe rời Kho Tổng và `at_destination_warehouse` sau khi kho đích nhận bao. Đơn trong bao hiện thành danh sách; chỉ tài xế role `delivery_driver` mới nhận các đơn giao hàng. Kho nguồn → Kho Tổng và Kho Tổng → kho đích đều dùng chuyến xe/bao, không dùng nhóm tài xế lấy hàng.

### G. Phân tài xế giao hàng

1. Có thể phân tài xế ngay sau khi quét bao đến kho đích ở bước F; hoặc đăng nhập Điều hành, chọn đơn tại `at_destination_warehouse` để phân riêng.
2. Chọn tài xế giao hàng, ví dụ `taixe3@smartlogistics.vn` (role `delivery_driver`).
3. Nếu đơn có COD hoặc cước người nhận phải trả, đảm bảo tài xế có đủ ký quỹ khả dụng trước khi phân công.

**Kỳ vọng:** tài xế giao nhìn thấy đơn. Khi khoản phải thu lớn hơn 0, backend giữ ký quỹ; nếu không đủ số dư khả dụng thì phân công bị từ chối.

### H. Giao hàng thành công hoặc thất bại — Tài xế giao hàng

1. Đăng xuất Điều hành; đăng nhập tài xế giao được phân công, ví dụ `taixe3@smartlogistics.vn`, mật khẩu `123`; mở `/tai-xe`.
2. Tìm đúng đơn theo mã đã ghi ở bước A. Mở chi tiết đơn và bấm **Bắt đầu giao** (hoặc nút tương đương). Tải lại danh sách; trạng thái cần thành `delivering`.
3. Khi giao thành công, mở thao tác **Giao thành công**:
   - Chụp/chọn một ảnh minh chứng giao hàng.
   - Người nhận ký bằng ngón tay/chuột trong ô **Chữ ký người nhận**.
   - Nếu tổng tiền phải thu lớn hơn `0`, tích **Xác nhận đã thu đủ** rồi chọn **Tiền mặt** hoặc **Chuyển khoản**.
   - Nếu tổng tiền phải thu bằng `0` (như đơn test ở bước A), không cần xác nhận tiền hay chọn phương thức.
   - Bấm nút xác nhận hoàn tất. Không cần email người nhận, không có mã OTP và không hỏi khách đọc mã.
4. Để thử giao thất bại thay vì thành công, mở thao tác thất bại, chọn một lý do trong danh sách, chụp ảnh minh chứng rồi gửi. Không dùng cùng đơn cho cả hai nhánh: giao thất bại chuyển đơn sang luồng hoàn hàng.

**Kỳ vọng:**

- Giao thành công: đơn thành `completed`, lưu ảnh, chữ ký và thông tin thu COD.
- Giao thất bại: đơn thành `returning`; khi hàng hoàn về kho hiện giữ đơn và được quét nhận, đơn kết thúc thành `cancelled`.
- Mở lại chi tiết đơn ở Shop: ảnh minh chứng/chữ ký được hiển thị trong lịch sử; không có trường OTP nào cần nhập.

### I. Đối soát tiền

1. Kế toán đăng nhập `ketoan@smartlogistics.vn`, mở `/ke-toan`.
2. Kiểm tra các mục đối soát COD Shop, lịch sử thanh toán, ký quỹ tài xế, tiền COD tài xế nộp và phụ phí.
3. Nếu tài xế thu COD tiền mặt, tài xế tạo yêu cầu nộp tiền; Kế toán xác nhận đã nhận tiền.
4. Nếu tài xế gửi yêu cầu phụ phí, kiểm tra ảnh biên lai rồi duyệt hoặc từ chối.

**Kỳ vọng:** khoản tiền và trạng thái xử lý xuất hiện trong màn hình tương ứng; yêu cầu phụ phí được duyệt sẽ tạo điều chỉnh lương.

### J. Tra cứu và xác nhận lịch sử

1. Shop mở danh sách đơn và mở chi tiết đơn vừa tạo.
2. Đối chiếu trạng thái, lịch sử luân chuyển, ảnh minh chứng/chữ ký nếu có.
3. Dùng chức năng tra cứu vận đơn công khai trên trang khách hàng để kiểm tra cùng mã vận đơn.

**Kỳ vọng:** trạng thái/lịch sử nhất quán với các thao tác đã thực hiện.

## 8. Checklist kiểm tra từng phân hệ

| Phân hệ | Đường dẫn | Các thao tác nên thử |
|---|---|---|
| Khách hàng | `/`, `/dich-vu`, `/bang-gia`, `/tin-tuc`, `/tuyen-dung`, `/uoc-tinh-cuoc`, `/tim-buu-cuc` | Mở trang; thử tính cước, lọc bưu cục, đọc tin; gửi yêu cầu dịch vụ hoặc ứng tuyển. |
| Shop | `/cua-hang` | Cập nhật hồ sơ/tọa độ Shop mặc định; tạo nhiều đơn để kiểm tra vị trí lấy hàng tự điền và địa chỉ giao ở nhiều khu vực TP. Hồ Chí Minh; xem danh sách/chi tiết/lịch sử, in nhãn mã vạch, nhập/xuất danh sách, theo dõi đơn, quản lý API key/webhook và yêu cầu giao lại nếu cần. |
| Tài xế | `/tai-xe` | Nhận nhiệm vụ, quét mã, cập nhật trạng thái/vị trí, hoàn tất giao, báo sự cố, xem ví COD, nộp tiền và gửi phụ phí có ảnh biên lai. |
| Kho | `/kho` | Xem tồn; khai báo kho/vị trí kệ; quét nhận đơn; tạo/niêm phong bao; lập chuyến, gán bao; kiểm kê. |
| Điều hành | `/dieu-hanh` | Phân tuyến tài xế theo từng chặng; quản lý xe/chuyến; theo dõi GPS; duyệt yêu cầu giao lại; gửi báo cáo. |
| Kế toán | `/ke-toan` | Đối soát COD Shop; xem lịch sử và hóa đơn; xác nhận tiền COD tài xế; quản lý ký quỹ; duyệt/từ chối phụ phí. |
| Nhân sự | `/nhan-su` | Quản lý hồ sơ/trạng thái nhân viên, nghỉ phép, chấm công, lương/điều chỉnh lương và yêu cầu từ website. |
| Chấm công | `/cham-cong` | Cấp quyền camera/GPS; chụp ảnh vào ca/tan ca; kiểm tra thời gian, vị trí và lịch sử. Nhân sự có thể lọc bản ghi nhân viên. |
| Giám đốc | `/admin` | Kiểm tra dashboard/báo cáo; duyệt báo cáo phòng ban; quản lý trưởng phòng. |
| Nội dung | `/phong-ban-noi-dung` | Tạo/sửa/xóa tin; kiểm tra nội dung công khai ở `/tin-tuc`. |
| Hỗ trợ | `/ho-tro` | Khách tạo phiên chat AI/live; nhân viên xem phiên, tin nhắn/ngữ cảnh và đóng phiên. Cần có tài khoản role `customer_service` để kiểm tra phía nhân viên. |

## 9. Bộ dữ liệu đơn mẫu

SQL seed tạo sẵn các mã:

- `SLTEST260901VN`
- `SLTEST260902VN`
- `SLTEST260903VN`
- `SLTEST260904VN`
- `SLTEST260905VN`
- `SLTEST260906VN`
- `SLTEST260907VN`
- `SLTEST260908VN`

Các đơn này được seed ở nhiều trạng thái khác nhau để kiểm tra danh sách, tra cứu và giao diện. Chúng không thay thế một đơn mới khi cần chạy trọn luồng đầu-cuối. Nên tạo đơn mới trong Shop để chạy checklist ở mục 7.

## 10. API và cập nhật thời gian thực

- API docs: `http://localhost:5000/api/docs`
- OpenAPI JSON: `http://localhost:5000/api/openapi.json`
- Các API nghiệp vụ cần đăng nhập sử dụng token được cấp sau `/api/login`; backend kiểm tra role theo từng route.
- Trang Shop hỗ trợ tích hợp tạo đơn qua API key riêng ở header `x-api-key`; xem mô tả request trong API docs.
- Socket.IO phát sự kiện cập nhật đơn, thông báo và vị trí tài xế.

## 11. Lỗi thường gặp khi kiểm tra

| Hiện tượng | Điều cần kiểm tra |
|---|---|
| Backend không khởi động/kết nối DB lỗi | Kiểm tra MySQL service đang chạy và Workbench đăng nhập được; xác nhận schema `smart_logistics_v2` đã được nạp; đối chiếu `host`, `user`, `password`, `database` trong `mysql.createConnection` ở `backend/server.js`. Database hiện không lấy cấu hình từ `.env`. |
| `Access denied for user` khi backend kết nối | Mật khẩu/tài khoản trong `server.js` không khớp MySQL trên máy. Dùng cùng thông tin đăng nhập kiểm tra trong Workbench, rồi cập nhật cấu hình backend; khởi động lại backend sau khi sửa. |
| `Unknown database 'smart_logistics_v2'` | Chưa chạy hết `backend/smart_logistics_v2.sql`, hoặc script chạy trên kết nối/schema khác. Thực hiện lại mục 3 trên database test và xác nhận schema bằng `SELECT DATABASE();`. |
| Lỗi tạo bảng hoặc thiếu bảng khi chạy SQL | Kiểm tra MySQL là phiên bản 8.0 trở lên và xem lỗi đầu tiên trong **Action Output**. Đảm bảo chạy toàn bộ file SQL trên đúng kết nối; sau khi import thành công hãy khởi động lại backend để backend tạo các bảng mở rộng còn thiếu. |
| Frontend mở được nhưng API lỗi | Backend có chạy ở cổng `5000` không; frontend `VITE_API_URL` có đúng không. Một số màn hình hiện gọi trực tiếp `localhost:5000`. |
| Bản đồ hiện nền xám/không thấy đường phố | Màn Shop lần lượt thử nền OpenStreetMap, CARTO và Esri. Nếu cả ba không tải, kiểm tra Internet/firewall hoặc DNS có chặn máy chủ bản đồ không. Khi đó ô tìm địa chỉ thử Nominatim rồi Photon; chọn một kết quả mới xác nhận được điểm. |
| Đã gõ địa chỉ Shop nhưng vẫn báo chưa chọn địa chỉ | Bấm **Tìm** hoặc Enter, đợi kết quả, rồi bấm chọn một gợi ý. Gõ chữ trong ô tìm kiếm chưa lưu địa chỉ/tọa độ. Nếu cả hai dịch vụ tìm kiếm không truy cập được, kết nối mạng hoặc firewall cần cho phép các dịch vụ bản đồ/địa chỉ. |
| Không tìm được địa chỉ | Nhập địa chỉ ở ô chính rồi bấm **Tìm địa chỉ**. Nếu dịch vụ tìm kiếm lỗi, bấm **Chọn trên bản đồ** và chọn điểm giao trực tiếp; tọa độ sẽ được điền tự động. Không cần nhập tọa độ thủ công khi tạo đơn. |
| Báo không có quyền | Đăng nhập đúng tài khoản/role của màn hình; đăng xuất và đăng nhập lại sau khi đổi tài khoản. |
| Kho không tải được hoặc bị chặn | Tài khoản quản lý kho phải được gán `warehouse_id`; quản lý kho bị giới hạn theo phạm vi kho. |
| Không quét được mã | Cấp quyền camera; thử nhập mã thủ công nếu giao diện có trường nhập. |
| Chấm công/GPS không chạy | Cấp quyền camera và vị trí trong trình duyệt; kiểm tra thiết bị có GPS/vị trí khả dụng. |
| Nhập kho báo sai vị trí/kho | Đơn phải đang ở đúng chặng; chọn đúng kho được phân tuyến (kho gần vị trí Shop nhất ở chặng lấy hàng) và mã kệ đã khai báo tại kho đó. |
| Không phân công được tài xế giao | Kiểm tra role tài xế, trạng thái đơn, tài xế đang có nhiệm vụ khác và số dư ký quỹ khả dụng khi đơn có khoản phải thu. |
| Không hoàn tất giao hàng | Giao thành công cần ảnh minh chứng và chữ ký; xác nhận đã thu tiền và chọn phương thức nếu đơn có khoản phải thu. Giao thất bại cần chọn lý do và ảnh minh chứng. |
| Chat nhân viên không có tài khoản phù hợp | Seed chưa tạo role `customer_service`; tạo người dùng có đúng role nếu cần kiểm tra chat hỗ trợ. |

## 12. Trạng thái xác minh hiện tại

- `frontend`: `npm run build` chạy thành công; Vite cảnh báo bundle JavaScript lớn hơn 500 kB.
- `frontend`: `npm run lint` hiện không đạt (26 lỗi, 10 cảnh báo theo lần chạy kiểm tra gần nhất).
- `backend`: chưa có bộ test tự động được cấu hình.
