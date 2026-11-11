# Smart Logistics

Ứng dụng quản lý giao nhận gồm frontend React/Vite, backend Express/Node.js, MySQL và cập nhật thời gian thực qua Socket.IO. Tài liệu này hướng dẫn cài đặt local và kiểm tra các luồng nghiệp vụ theo thứ tự.

## Chạy nhanh bằng Docker Compose

Cách này dành cho người clone repo muốn chạy bản demo mà không cần cài Node.js hoặc MySQL riêng. Cần cài và mở Docker Desktop trước.

```powershell
git clone https://github.com/ThaiTran27/logistics.git
cd logistics
docker compose up --build
```

Khi các dịch vụ khởi động xong, mở `http://localhost:5173`. Backend chạy ở `http://localhost:5000`. Docker tự tạo MariaDB (tương thích giao thức MySQL), nạp dữ liệu demo từ `backend/smart_logistics_v2.sql`, lưu database trong volume và chạy các migration chưa áp dụng khi backend khởi động.

Đăng nhập demo bằng `admin@smartlogistics.vn` hoặc `shop@smartlogistics.vn`, mật khẩu `123`. Tài khoản và dữ liệu seed chỉ dành cho máy local; không dùng bộ cấu hình này để đưa ứng dụng lên Internet.

Để dừng ứng dụng, nhấn `Ctrl+C`. Nếu chạy nền bằng `docker compose up --build -d`, dùng `docker compose down` để dừng; dữ liệu MySQL và ảnh tải lên vẫn được giữ lại. **Không dùng `docker compose down -v` trừ khi muốn xóa toàn bộ database demo và ảnh đã tải lên.**

Nếu cần dùng thêm bản đồ tự host, làm theo phần **Bản đồ và chỉ đường tự host**, tải dữ liệu bản đồ trước rồi chạy:

```powershell
docker compose --profile maps up --build
```

## 1. Thành phần và đường dẫn

- `frontend/`: giao diện React, Vite, Tailwind CSS.
- `backend/`: API Express, Socket.IO, kết nối MySQL, tải ảnh và tài liệu.
- `backend/smart_logistics_v2.sql`: tạo schema và dữ liệu mẫu.
- `docker-compose.yml`: chạy nhanh frontend, backend, MySQL và tùy chọn dịch vụ bản đồ.
- `shared/govap-wards.geojson`: ranh giới sáu phường phục vụ ở Gò Vấp; giấy phép dữ liệu nằm trong `shared/GOVAP-WARD-DATA-LICENSE.txt`.

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

Backend đọc cấu hình kết nối MySQL từ `backend/.env`; nếu chưa khai báo, các mặc định bên dưới được dùng:

| Thuộc tính | Giá trị mặc định |
|---|---|
| Host | `localhost` |
| User | `root` |
| Password | rỗng |
| Database | `smart_logistics_v2` |

Không dùng cấu hình mặc định này cho môi trường production. Hướng dẫn tạo file cấu hình riêng nằm ở mục 4.

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

Script nạp một kho tổng Gò Vấp, tài khoản dùng thử, đơn vận chuyển mẫu, tin tức, yêu cầu dịch vụ/ứng tuyển, nghỉ phép, chấm công và dữ liệu nhân sự. Các bảng `users` và `orders` là nơi lưu thông tin tài khoản và vận đơn; lịch sử trạng thái nằm trong `order_status_history`; dữ liệu kho nằm trong `warehouses` và `warehouse_bin_locations`. Các bảng bao/chuyến liên kho cũ vẫn được giữ để bảo toàn dữ liệu nhưng luồng vận hành đã bị tắt.

### 3.3. Cập nhật database hiện có về một kho Gò Vấp

Sao lưu database trước. Từ thư mục gốc dự án, chạy các lệnh sau để xem các tham chiếu kho Quận 1 và xem trước đơn cũ; các lệnh có hậu tố `preview` không ghi dữ liệu:

```powershell
cd backend
npm run warehouse:preview
npm run orders:normalize-preview
```

Kiểm tra các danh sách preview trước khi áp dụng migration. Migration `002` giữ nguyên kho Quận 1 nhưng vô hiệu hóa nó, chuyển tài khoản thủ kho sang kho tổng và cấu hình `system_settings.central_warehouse_id`; sau đó xem lại danh sách đơn rồi mới chạy lệnh có `--apply`:

```powershell
npm run migrate
npm run orders:normalize-preview
npm run orders:normalize
npm test
```

`npm run orders:normalize` chỉ cập nhật các đơn còn ở trạng thái liên kho, trong một transaction và ghi cả `order_events` lẫn `order_status_history`. Không chạy lệnh này trước khi kiểm tra danh sách preview. Có thể rollback migration gần nhất bằng `npm run migrate:down`; khi rollback cả hai migration mới, dùng `npm run migrate:down -- 2`.

### 3.4. Thất bại lấy/giao, hàng hoàn và blacklist

Migration `003_failure_return_blacklist.sql` thêm bộ đếm lần lấy/giao, tài xế hoàn, nhật ký sự cố bom hàng đã chuẩn hóa và bảng cảnh báo số điện thoại/địa chỉ. Giới hạn mặc định là 3 lần và được lưu trong `system_settings` (`MAX_PICKUP_ATTEMPTS`, `MAX_DELIVERY_ATTEMPTS`). Sau khi sao lưu DB, chạy migration rồi xem trước các đơn cũ mà luồng trước đã đánh dấu `returning -> cancelled`:

```powershell
cd backend
npm run migrate
npm run orders:return-preview
```

Chỉ sau khi kiểm tra danh sách preview, chạy `npm run orders:return-normalize` để cập nhật các đơn đó sang `returned`; script chạy trong transaction và ghi thêm `order_events` cùng `order_status_history`. Không chạy script này trước khi duyệt preview. Lý do lấy/giao được tải từ API; mã lý do quyết định có cần ảnh, có tính lượt và có được giao lại hay không. Hai lần DL_BOMB trên cùng số điện thoại/địa chỉ sẽ đưa thông tin vào blacklist và khi tạo đơn mới, Shop nhận được cảnh báo trong phản hồi. Duyệt yêu cầu giao lại của Shop chạy trong một transaction: chuyển đơn `returning → at_central_warehouse`, tăng bộ đếm lượt giao, ghi event/audit và tạo thông báo cho Shop cùng điều phối. Từ chối yêu cầu bắt buộc có lý do; yêu cầu chỉ được xử lý khi đơn còn ở `returning`.

Khi chốt kiểm kê, kho chọn `WH_SHORT`/`WH_LOST` cho từng kiện thiếu và `WH_OVER` cho từng mã dư; hệ thống lưu người ghi nhận và thời điểm cùng phiếu kiểm kê. Kiểm tra các luồng retry/hủy/hoàn và toàn bộ backend bằng:

```powershell
npm test
```

### 3.5. Kiểm tra schema và dữ liệu mẫu

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

Kết quả đúng với file seed hiện tại: `database_dang_chon` là `smart_logistics_v2`, có **19 tài khoản**, **9 đơn hàng** (trong đó có 8 mã `SLTEST...`), và một kho tổng Gò Vấp. Nếu số lượng khác, kiểm tra tab **Action Output** xem toàn bộ script đã chạy hết chưa và xác nhận đang xem đúng schema.

> Không cần tự tạo bảng hoặc tự nhập các tài khoản mẫu bằng tay. Sau khi kết nối database thành công, backend sẽ tự tạo bổ sung các bảng mở rộng còn thiếu; phần dữ liệu ban đầu vẫn cần được nạp từ file SQL ở bước trên.

### 3.6. Chốt kỳ lương và phiếu lương

Với database đang chạy theo migration, sao lưu trước rồi chạy tại `backend`:

```powershell
npm run migrate
npm test
```

Migration `007_payroll_period_finalization.sql` tạo kỳ lương, payslip và các dòng snapshot, cấu hình thưởng mẫu (cần duyệt lại), khoản khấu trừ ký quỹ/tạm ứng và ngày hẹn giao. Trong màn hình Nhân sự, chọn tháng, rà soát số liệu rồi bấm **Chốt kỳ lương**. Sau khi khóa, chỉ điều chỉnh bằng khoản thưởng/khấu trừ mới; thay đổi được ghi vào audit log và phiếu lương. Phiếu có thể tải dạng PDF hoặc Excel chi tiết. Tài xế xem khoản thu nhập ước tính trong ngày trên trang chủ; đây không phải số lương đã chốt.

Thưởng giao đúng hẹn chỉ tính các đơn có `orders.promised_delivery_at`; đơn chưa có ngày hẹn không nằm trong mẫu số đúng hẹn. Các khoản thưởng mẫu và `PAYROLL_EXPECTED_WORKDAYS` là cấu hình minh họa trong database, cần kế toán/giám đốc thay bằng chính sách đã duyệt.

### 3.7. Xử lý incident và bồi thường

Sao lưu database rồi chạy `npm run migrate` trong `backend` để áp dụng migration `008_incident_resolution.sql`. Màn hình Điều phối và Kế toán cho phép ghi nhận lỗi kho tổng không gắn tài xế, xác định bên chịu trách nhiệm, nhập bồi thường Shop/khách và tách khoản khấu trừ ký quỹ/phạt lương. Các khoản bồi thường và khấu trừ bị giới hạn theo giá trị khai báo; khấu trừ tài xế chỉ được ghi khi quy lỗi cho tài xế. Sự cố `customer_absent`/`wrong_item` khi đơn đang giao được chuyển qua state machine, áp dụng reason code, bằng chứng và bộ đếm lượt giao. Tất cả cập nhật, ví, kỳ lương, trạng thái đơn và audit nằm trong cùng transaction.

## 4. Cấu hình backend

Tại thư mục gốc dự án, tạo file cấu hình backend từ mẫu:

```powershell
Copy-Item backend\.env.example backend\.env
```

Mở `backend/.env` và điền thông tin MySQL cùng một `JWT_SECRET` ngẫu nhiên, ổn định. Có thể tạo secret bằng PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Đặt kết quả vào `JWT_SECRET`. Máy chủ từ chối khởi động nếu biến này thiếu hoặc để trống; giữ giá trị ổn định giữa các lần chạy để phiên đăng nhập và QR hiện tại không mất hiệu lực. `backend/.env.example` liệt kê các biến môi trường backend, bao gồm DB, cổng, SMTP, giới hạn API công khai, chat AI và OSRM; chỉ cần điền các cấu hình bạn sử dụng. `OSRM_URL` mặc định là `http://localhost:5001`.

Chat theo mã vận đơn lưu token phiên trong trình duyệt và gửi lại token khi khôi phục chat sau khi tải lại trang. Máy chủ chỉ lưu hash token, hết hạn theo `CHAT_SESSION_TOKEN_TTL_HOURS`; migration `010_chat_token_expiry.sql` đặt thời hạn cho các phiên chat cũ. Tra cứu công khai che SĐT/tên và không trả địa chỉ chi tiết. Các giới hạn rate limit hiện lưu trong bộ nhớ từng tiến trình; nếu chạy nhiều instance, cần đặt rate limiter dùng chung (ví dụ Redis) ở lớp triển khai.

Không đưa khóa bí mật, mật khẩu thật hoặc thông tin SMTP vào Git. `backend/.env` đã được `.gitignore` loại trừ. Giữ `WEBHOOK_ENCRYPTION_KEY` ổn định nếu cần giải mã bí mật webhook đã lưu; nếu bỏ trống, backend dùng `JWT_SECRET`.

Frontend đọc duy nhất `VITE_API_URL` từ `frontend/.env`; API fetch, Socket.IO và URL tài nguyên dùng chung cấu hình này. Mặc định là `http://localhost:5000`. Sao chép `frontend/.env.example` thành `frontend/.env` nếu cần:

```dotenv
VITE_API_URL=http://localhost:5000
```

Sau khi chỉnh biến môi trường, khởi động lại Vite để nạp cấu hình mới. Khi API mất kết nối, app tài xế hiện một thanh trạng thái và kiểm tra lại theo backoff; lỗi mạng, 401 và 500 được hiển thị bằng thông báo tiếng Việt.

### Bản đồ và chỉ đường tự host

Giao diện bản đồ dùng giao diện riêng trên dữ liệu OpenStreetMap tự host; khi chạy, tile và chỉ đường được phục vụ từ Docker trên máy local, không gọi Google Maps, Nominatim, Photon, CARTO hoặc Esri. Phạm vi tạo đơn được giới hạn ở sáu phường An Hội Đông, An Hội Tây, An Nhơn, Gò Vấp, Hạnh Thông và Thông Tây Hội; backend xác thực cả tọa độ lấy hàng lẫn giao hàng.

Các tệp bản đồ dung lượng lớn được bỏ khỏi Git. Nếu `backend\map-data` chưa có dữ liệu, tải hai tệp nguồn bằng PowerShell tại thư mục gốc:

```powershell
New-Item -ItemType Directory -Force backend\map-data | Out-Null
Invoke-WebRequest https://download.geofabrik.de/asia/vietnam-shortbread-1.0.mbtiles -OutFile backend\map-data\vietnam-shortbread-1.0.mbtiles
Invoke-WebRequest https://download.geofabrik.de/asia/vietnam-latest.osm.pbf -OutFile backend\map-data\vietnam-latest.osm.pbf
```

Sau đó khởi động ba dịch vụ bản đồ/định tuyến:

```powershell
docker compose up -d
docker compose ps -a
```

Lần chạy đầu trích xuất vùng Gò Vấp có vùng đệm từ PBF, tạo graph OSRM và có thể mất vài phút. Kiểm tra `map-extract`, `map-routing` và `map-tiles` đều đã hoàn tất/đang chạy:

```powershell
docker compose logs --tail 100 map-extract map-routing map-tiles
Invoke-WebRequest http://localhost:8080/styles/govap/style.json
```

Các cổng tile `8080` và định tuyến `5001` mặc định chỉ bind vào `127.0.0.1`; không mở trực tiếp ra Internet. Nếu cần các máy trong mạng nội bộ truy cập bản đồ, đặt `MAP_BIND_ADDRESS=<IP-máy-chủ>` trong file `.env` ở thư mục gốc, cấu hình `VITE_MAP_TILE_URL=http://<IP-máy-chủ>:8080/styles/govap/{z}/{x}/{y}.png` và `VITE_API_URL=http://<IP-máy-chủ>:5000` trong `frontend\.env`, sau đó chạy lại `docker compose up -d`. Chỉ dùng IP nội bộ và giới hạn truy cập bằng tường lửa; không chuyển tiếp các cổng này ra Internet. Routing đang dùng profile `car.lua` của OSRM trên dữ liệu đường OSM: chỉ dẫn đường bộ là tham khảo, không phải dữ liệu giao thông thời gian thực hay profile xe máy chuyên biệt.

### Tối ưu lộ trình lấy/giao

Sau khi sao lưu database hiện có, áp dụng migration lưu thứ tự điểm dừng, ETA, lịch sử tính lại và ưu tiên FIFO cho tuyến lấy hàng:

```powershell
cd backend
npm run migrate
npm test -- tests/routeOptimizer.test.js tests/migrations.test.js
```

Migration `011_driver_route_optimization.sql` và `012_pickup_route_ranking.sql` có phần `-- DOWN`; để rollback migration cuối cùng, dùng `npm run migrate:down`. Migration 012 thêm `pickup_deadline_at`, `ranking_reason` và các cấu hình `PICKUP_FIFO_BUCKET_MINUTES` (30), `PICKUP_MAX_WAIT_MINUTES` (120), `PICKUP_SLA_MINUTES` (120), `PICKUP_PRIORITY_ORDER` (`fifo,deadline,distance`) trong `system_settings`. Có thể đổi thứ tự tiêu chí tại bảng này; hỏa tốc và đơn vượt thời gian chờ vẫn được nâng tầng ưu tiên. Không chạy lại toàn bộ `smart_logistics_v2.sql` trên database đang dùng vì file này khởi tạo lại bảng nghiệp vụ. `OSRM_URL` mặc định `http://localhost:5001`; kiểm tra OSRM có phản hồi trước khi kiểm tra tuyến. Khi OSRM không sẵn sàng, tuyến được ước lượng bằng Haversine và API đánh dấu `is_estimated`.

Tài xế dùng `GET /api/driver/route/today` và `POST /api/driver/route/reorder`; điều phối dùng `GET /api/dispatch/route/:driverId/today` và `POST /api/dispatch/route/optimize/:driverId`. API tuyến điều phối chỉ dành cho điều phối/giám đốc; tài xế chỉ truy vấn theo ID tài khoản đăng nhập. Thử thủ công: phân công một vài đơn có tọa độ trong sáu phường, mở app tài xế kiểm tra số thứ tự/ETA/đường đi, hoàn tất hoặc báo thất bại một điểm để xem các điểm còn lại được sắp lại, rồi thử kéo-thả và gửi lý do. Từ tài khoản điều phối xem/tối ưu tuyến; xác nhận tài khoản tài xế không mở được API điều phối của người khác.

Giữ dòng ghi công OpenStreetMap hiển thị trên bản đồ. Dữ liệu OSM theo ODbL; glyph Open Sans kèm giấy phép SIL Open Font License trong `backend\map-config\fonts`; dữ liệu ranh giới sáu phường có giấy phép MIT đi kèm trong `shared`.

## 5. Khởi động ứng dụng

Trước khi chạy, đảm bảo đã tạo `backend/.env` và cấu hình `JWT_SECRET` theo mục 4, MySQL đang hoạt động và đã hoàn thành mục 3. Mở **hai cửa sổ terminal riêng**, mỗi cửa sổ bắt đầu tại thư mục gốc dự án. Cài dependencies một lần cho từng phần; nếu vừa tải mã nguồn hoặc chưa có thư mục `node_modules`, chạy `npm ci`.

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

Backend có bộ test tự động chạy bằng Vitest. Chạy `cd backend` rồi `npm test`; riêng thuật toán lộ trình và schema migration có thể chạy với `npm test -- tests/routeOptimizer.test.js tests/migrations.test.js tests/routeAuthorization.test.js`.

## 6. Tài khoản thử nghiệm

Các tài khoản bên dưới được tạo trong SQL seed. Mật khẩu seed là `123`. Sau lần đăng nhập đầu tiên, backend chuyển mật khẩu dạng cũ sang dạng hash.

| Phân hệ | Email |
|---|---|
| Giám đốc | `admin@smartlogistics.vn` |
| Nhân sự | `hr@smartlogistics.vn`, `hr2@smartlogistics.vn` |
| Điều hành | `dieu_hanh@smartlogistics.vn`, `dieu_hanh2@smartlogistics.vn` |
| Kế toán | `ketoan@smartlogistics.vn`, `ketoan2@smartlogistics.vn` |
| Kho | `kho@smartlogistics.vn`, `kho2@smartlogistics.vn`, `kho3@smartlogistics.vn` (đều thao tác tại Kho Tổng Gò Vấp) |
| Cửa hàng/Shop | `shop@smartlogistics.vn`, `shop2@smartlogistics.vn` |
| Tài xế lấy hàng | `taixe1@smartlogistics.vn`, `taixe2@smartlogistics.vn` |
| Tài xế giao hàng | `taixe3@smartlogistics.vn`, `taixe4@smartlogistics.vn` |
| Tài xế xe tải trung chuyển liên kho | `taixe_tai1@smartlogistics.vn` |
| Nội dung | `content@smartlogistics.vn`, `content2@smartlogistics.vn` |
| Chăm sóc khách hàng (demo) | `cskh01@smartlogistics.vn` (tạo bằng lệnh seed riêng bên dưới) |

Kho hiện chỉ vận hành một kho tổng tại Gò Vấp; các tài khoản `kho@smartlogistics.vn`, `kho2@smartlogistics.vn` và `kho3@smartlogistics.vn` đều dùng kho tổng này. Không có kho Quận 1 hoặc luồng trung chuyển liên kho đang hoạt động.

Không đưa tài khoản CSKH demo vào SQL khởi tạo dùng chung. Chỉ tạo tài khoản này trong môi trường demo bằng lệnh sau; cần đặt `NODE_ENV=development` (hoặc `demo`) và `DEMO_MODE=true` trong `backend/.env`. Script từ chối chạy nếu thiếu cờ demo hoặc tên database có vẻ là production:

```powershell
cd backend
npm run seed:cskh-demo
```

Email đăng nhập là `cskh01@smartlogistics.vn`, mật khẩu demo `123`. CSKH dùng `/ho-tro` để xem hành trình/ngữ cảnh, ảnh POD và hỗ trợ hội thoại; không được đổi trạng thái đơn hoặc thao tác tiền. Mục **Chốt Lương & Phiếu Lương** chỉ dành cho Giám đốc/nhân sự theo API hiện tại; kế toán không có quyền này.

Tài khoản chỉ được mở phân hệ đúng với quyền được cấp.

Nếu database đã được tạo từ trước, không chạy lại toàn bộ SQL seed chỉ để thêm dữ liệu test (script sẽ tạo lại dữ liệu). Để tạo riêng tài khoản CSKH demo trên database demo hiện có, dùng lệnh `npm run seed:cskh-demo` với các cờ môi trường nêu trên. Nếu cần dữ liệu test sạch, chỉ import seed đầy đủ vào database test mới.

## 7. Checklist kiểm tra luồng giao nhận chính

Phần này kiểm tra **một đơn mới từ Shop đến người nhận**. Làm lần lượt từ A đến J; không chuyển bước nếu trạng thái chưa đúng. Khi đổi vai trò, bấm **Đăng xuất** trước rồi đăng nhập tài khoản kế tiếp trong cùng trình duyệt. Giữ lại mã vận đơn tạo ở bước A để tìm đúng một đơn xuyên suốt bài test.

### Trước khi bắt đầu

1. Khởi động MySQL và kiểm tra service đang chạy.
2. Mở terminal thứ nhất, chạy backend bằng `cd backend`, `npm start`; để cửa sổ này tiếp tục chạy. Terminal cần báo database đã kết nối và server nghe cổng `5000`.
3. Mở terminal thứ hai, chạy frontend bằng `cd frontend`, `npm run dev`; mở địa chỉ Vite hiện ra, thường là `http://localhost:5173`.
4. Dùng dữ liệu test, không dùng đơn thật. Đăng nhập bằng email tài khoản và mật khẩu `123`. Khóa đăng nhập mặc định được cấu hình trong `system_settings`: `LOGIN_MAX_FAILED_ATTEMPTS` (mặc định 5) và `LOGIN_LOCKOUT_WINDOW_MINUTES` (mặc định 15). Nếu cần tắt giới hạn đăng nhập và đăng ký trong demo local, đặt `NODE_ENV=development` (hoặc `demo`) và `DEMO_MODE=true` trong `backend/.env`, rồi khởi động lại backend. Chế độ này không hoạt động với `NODE_ENV=production` hoặc tên database có hậu tố `prod`/`production`; không bật trên hệ thống công khai.
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
3. Nếu chưa cài hồ sơ: điền tên Shop, số điện thoại và địa chỉ dạng văn bản. Bấm **Chọn trên bản đồ**, ghim vị trí thực tế thuộc một trong sáu phường phục vụ, rồi bấm **Lưu thông tin Shop**. Nếu đã có hồ sơ thì kiểm tra tên, địa chỉ và ghim đã lưu.
4. Bấm menu **Tạo Đơn Giao Hàng**. Phần trên form phải hiện địa chỉ lấy hàng đã lưu. Đây là điểm lấy mặc định; không cần chọn lại cho mỗi đơn.
5. Nhập dữ liệu test dưới đây (số điện thoại là dữ liệu giả; email người nhận tùy chọn, chỉ nhận email thông báo trạng thái, không còn OTP):

   | Trường | Giá trị để nhập |
   |---|---|
   | Tên người nhận | `Nguyễn Thị Mai Test` |
   | Số điện thoại | `0901000010` |
   | Email người nhận | Để trống hoặc nhập email bạn có thể mở để nhận thông báo trạng thái |
   | Địa chỉ Shop/điểm lấy | Tự điền từ hồ sơ Shop đã lưu |
   | Địa chỉ giao | Nhập địa chỉ dạng văn bản và chọn ghim trên bản đồ trong một trong sáu phường Gò Vấp |
   | Cân nặng | `1` kg |
   | Dài × rộng × cao | `10` × `10` × `10` cm |
   | Giá trị hàng | `0` |
   | COD | `0` cho lượt test không cần ký quỹ |
   | Người trả cước | Người gửi |
   | Dịch vụ | Tiêu chuẩn |
   | Hàng dễ vỡ / vùng xa | Không |

6. Trong trường **Địa chỉ giao hàng chi tiết**, nhập một địa chỉ thử thuộc Gò Vấp, bấm **Chọn trên bản đồ**, rồi ghim điểm giao trong ranh giới một trong sáu phường. Địa chỉ chỉ là phần mô tả; hệ thống không tra cứu địa chỉ từ dịch vụ bên ngoài. Dòng trạng thái phải hiện **Đã chọn điểm giao** cùng tọa độ.
7. Kiểm tra các trường bắt buộc và bấm nút gửi/tạo đơn ở cuối form. Khi hộp thoại báo tạo thành công, **chép mã vận đơn** ra chỗ tạm; mã này dùng ở các bước B–J. Đơn mới phải hiện trong **Quản Lý Vận Đơn**.
8. (Tùy chọn) Tạo thêm đơn thử để kiểm tra địa chỉ lấy hàng vẫn tự điền sau khi gửi đơn trước. Không dùng mã ví dụ `SLTEST...` thay cho mã đơn vừa tạo.

**Kỳ vọng:** đơn tạo thành công với trạng thái `pending`. Cả tọa độ Shop và điểm giao đều nằm trong sáu phường An Hội Đông, An Hội Tây, An Nhơn, Gò Vấp, Hạnh Thông hoặc Thông Tây Hội. Điểm ngoài vùng phải bị từ chối. Sau khi tạo đơn, địa chỉ lấy hàng vẫn được giữ cho đơn tiếp theo; đơn nội vùng được xử lý tại Kho Tổng Gò Vấp, không luân chuyển liên kho.

**Kiểm tra cập nhật hồ sơ:** vào **Thông Tin Shop**, đổi số điện thoại hoặc địa chỉ/vị trí, lưu rồi tải lại trang. Tên và địa chỉ mới phải còn nguyên; đơn tiếp theo phải tự dùng vị trí Shop mới. Email đăng nhập chỉ đọc và không đổi được từ màn hình này.

### B. Phân tài xế lấy hàng — Điều hành

1. Đăng xuất Shop; đăng nhập `dieu_hanh@smartlogistics.vn`, mật khẩu `123`.
2. Mở `/dieu-hanh`, vào màn **Phân Tuyến Tài Xế**.
3. Tìm/nhấn đơn theo mã vận đơn đã chép ở bước A. Trước khi thao tác, đối chiếu tên người nhận `Nguyễn Thị Mai Test`.
4. Chọn chặng **Lấy hàng tại Shop** (`pickup`), chọn tài xế lấy hàng `taixe2@smartlogistics.vn`, rồi bấm nút xác nhận/lưu phân công.
5. Tải lại danh sách hoặc mở lại chi tiết đơn để xem trạng thái và kho nguồn hệ thống chọn. Vị trí Shop gần Gò Vấp thì kho nguồn dự kiến là **Kho Gò Vấp**.

**Kỳ vọng:** đơn sang `picking`; đơn xuất hiện trong danh sách nhiệm vụ của `taixe2`. Với tọa độ Shop gần `10.8231, 106.6881`, kho nguồn là Kho Tổng Gò Vấp.

### C. Lấy hàng tại Shop — Tài xế lấy hàng

1. Đăng xuất Điều hành; đăng nhập `taixe2@smartlogistics.vn`, mật khẩu `123`.
2. Mở `/tai-xe`, tìm đơn `Nguyễn Thị Mai Test` có đúng mã vận đơn.
3. Bấm **Mở camera quét mã nhận hàng** và cho phép trình duyệt dùng camera. Đưa mã vạch của đúng đơn vào khung quét.
4. Nếu camera không hoạt động/không đọc được, nhập **mã vận đơn thật vừa tạo ở bước A** vào ô dự phòng rồi nhấn **Xác nhận**. Không nhập mã ở ví dụ trong README. Có thể dùng máy quét USB/Bluetooth: đặt con trỏ vào ô dự phòng và quét nhãn.
5. Nếu hiện “Mã quét không khớp”, đối chiếu mã đang hiện trong hộp quét với nhãn; nếu hiện lỗi kết nối, kiểm tra backend đang chạy ở cổng `5000`.

**Kỳ vọng:** chỉ mã khớp với đơn đang mở mới được xác nhận; thông báo thành công hiện ra và trạng thái đơn sang `picked_up`. Sau đó bàn giao kiện cho Kho Gò Vấp quét nhập. Phải ở `/tai-xe`, không phải `/dieu-hanh`.

### D. Nhập kho nguồn — Kho

1. Đăng xuất tài xế; đăng nhập `kho@smartlogistics.vn`, mật khẩu `123`.
2. Mở `/kho` → **Máy Quét Mã Vạch**. Trước khi quét, kiểm tra tên kho đang chọn là **Kho Tổng Gò Vấp**.
3. Tại phần **Tạo nhãn vị trí kệ mới**, nhập mã `TEST-A1-03` và tên `Kệ test Gò Vấp`, sau đó nhấn **Tạo mã và nhãn mã vạch**. Nếu mã này đã tồn tại từ lần test trước, đổi mã thành `TEST-A1-04`. Khi tạo thành công, giao diện tự chọn vị trí vừa tạo.
4. Nhập/quét đúng mã vận đơn đã ghi ở bước A. Nếu không có máy quét, nhập mã vào ô lớn bên dưới rồi nhấn Enter.
5. Xác nhận kết quả nhập kho; mở danh sách tồn kho để kiểm tra đơn và vị trí kệ `TEST-A1-03` (hoặc mã mới bạn vừa tạo).

**Kỳ vọng:** đơn sang `at_origin_warehouse`, hiện trong tồn kho Kho Tổng Gò Vấp tại vị trí kệ vừa tạo.

Kho nguồn là Kho Tổng Gò Vấp. Tài khoản thủ kho được gán kho tổng này để quét nhận và xử lý tồn kho.

### E. Luân chuyển liên kho — không áp dụng cho phạm vi Gò Vấp hiện tại

Các bước tạo bao và chuyến xe liên kho bên dưới chỉ dành cho dữ liệu/môi trường cũ có tuyến ngoài Gò Vấp. Không dùng chúng để kiểm thử đơn mới: cả điểm lấy lẫn điểm giao ngoài sáu phường đều bị chặn, còn đơn nội vùng không đi qua Kho Tổng.

Hạ tầng bao/chuyến xe vẫn được giữ để tương thích với dữ liệu cũ, nhưng không thuộc luồng giao hàng Gò Vấp hiện tại.

### F. Phân tài xế giao hàng tại Gò Vấp

1. Sau khi Kho Tổng Gò Vấp nhận đơn, đăng nhập tài khoản thủ kho và mở màn hình phân công tại `/kho`.
2. Chọn tài xế giao hàng đang hoạt động, ví dụ `taixe3@smartlogistics.vn`, rồi phân công trực tiếp.
3. Nếu đơn có COD hoặc cước người nhận phải trả, tài xế cần đủ ký quỹ khả dụng.

**Kỳ vọng:** đơn vẫn ở `at_central_warehouse` sau khi phân công, được gắn tài xế và xuất hiện trong tuyến giao của tài xế. Khi tài xế bấm **Bắt đầu giao**, state machine mới chuyển sang `delivering`; không đổi trạng thái khi chỉ phân công.

### G. Giao hàng thành công hoặc thất bại — Tài xế giao hàng

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
- Giao thất bại: đơn thành `delivery_failed`, sau đó được giao lại ở `at_central_warehouse` hoặc chuyển `return_pending` theo mã lý do và giới hạn lượt. Khi hàng hoàn về kho, trạng thái là `returned`; Shop xác nhận nhận lại bằng ảnh và chữ ký. Nếu Shop yêu cầu giao lại và điều phối duyệt, đơn trở về `at_central_warehouse` để chờ phân công lượt giao mới.
- Mở lại chi tiết đơn ở Shop: ảnh minh chứng/chữ ký được hiển thị trong lịch sử; không có trường OTP nào cần nhập.

### H. Đối soát tiền

1. Kế toán đăng nhập `ketoan@smartlogistics.vn`, mở `/ke-toan`.
2. Kiểm tra các mục đối soát COD Shop, lịch sử thanh toán, ký quỹ tài xế, tiền COD tài xế nộp và phụ phí.
3. Nếu tài xế thu COD tiền mặt, tài xế tạo yêu cầu nộp tiền; Kế toán xác nhận đã nhận tiền.
4. Nếu tài xế gửi yêu cầu phụ phí, kiểm tra ảnh biên lai rồi duyệt hoặc từ chối.

**Kỳ vọng:** khoản tiền và trạng thái xử lý xuất hiện trong màn hình tương ứng; yêu cầu phụ phí được duyệt sẽ tạo điều chỉnh lương.

### I. Tra cứu và xác nhận lịch sử

1. Shop mở danh sách đơn và mở chi tiết đơn vừa tạo.
2. Đối chiếu trạng thái, lịch sử luân chuyển, ảnh minh chứng/chữ ký nếu có.
3. Dùng chức năng tra cứu vận đơn công khai trên trang khách hàng để kiểm tra cùng mã vận đơn.

**Kỳ vọng:** trạng thái/lịch sử nhất quán với các thao tác đã thực hiện.

## 8. Checklist kiểm tra từng phân hệ

| Phân hệ | Đường dẫn | Các thao tác nên thử |
|---|---|---|
| Khách hàng | `/`, `/dich-vu`, `/bang-gia`, `/tin-tuc`, `/tuyen-dung`, `/uoc-tinh-cuoc`, `/tim-buu-cuc` | Mở trang; thử tính cước, lọc bưu cục, đọc tin; gửi yêu cầu dịch vụ hoặc ứng tuyển. |
| Shop | `/cua-hang` | Cập nhật hồ sơ/tọa độ Shop mặc định; tạo đơn với cả điểm lấy và giao trong sáu phường Gò Vấp, thử xác nhận điểm ngoài vùng bị từ chối; xem danh sách/chi tiết/lịch sử, in nhãn mã vạch, nhập/xuất danh sách, theo dõi đơn, quản lý API key/webhook và yêu cầu giao lại nếu cần. |
| Tài xế | `/tai-xe` | Nhận nhiệm vụ, quét mã, cập nhật trạng thái/vị trí, hoàn tất giao, báo sự cố, xem ví COD, nộp tiền và gửi phụ phí có ảnh biên lai. |
| Kho | `/kho` | Xem tồn; khai báo vị trí kệ; quét nhận đơn; phân tài xế giao tại Kho Tổng Gò Vấp; kiểm kê. |
| Điều hành | `/dieu-hanh` | Phân tuyến tài xế theo từng chặng; quản lý xe/chuyến; theo dõi GPS; duyệt yêu cầu giao lại; gửi báo cáo. |
| Kế toán | `/ke-toan` | Đối soát COD Shop; xem lịch sử và hóa đơn; xác nhận tiền COD tài xế; quản lý ký quỹ; duyệt/từ chối phụ phí. |
| Nhân sự | `/nhan-su` | Quản lý hồ sơ/trạng thái nhân viên, nghỉ phép, chấm công, lương/điều chỉnh lương và yêu cầu từ website. |
| Chấm công | `/cham-cong` | Cấp quyền camera/GPS; chụp ảnh vào ca/tan ca; kiểm tra thời gian, vị trí và lịch sử. Nhân sự có thể lọc bản ghi nhân viên. |
| Giám đốc | `/admin` | Kiểm tra dashboard/báo cáo; duyệt báo cáo phòng ban; quản lý trưởng phòng. |
| Nội dung | `/phong-ban-noi-dung` | Tạo/sửa/xóa tin; kiểm tra nội dung công khai ở `/tin-tuc`. |
| Hỗ trợ | `/ho-tro` | Khách tạo phiên chat AI/live; CSKH demo `cskh01@smartlogistics.vn` xem hành trình/ngữ cảnh, ảnh POD và hỗ trợ hội thoại. CSKH không được sửa trạng thái đơn hoặc thao tác tiền. |

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
| Backend báo thiếu `JWT_SECRET` khi khởi động | Tạo `backend/.env` theo mục 4 và đặt một secret ngẫu nhiên vào `JWT_SECRET`. |
| Backend không khởi động/kết nối DB lỗi | Kiểm tra MySQL service đang chạy và Workbench đăng nhập được; xác nhận schema `smart_logistics_v2` đã được nạp; kiểm tra `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` trong `backend/.env`. |
| `Access denied for user` khi backend kết nối | Thông tin `DB_USER`/`DB_PASSWORD` trong `backend/.env` không khớp MySQL trên máy. Dùng cùng thông tin đăng nhập kiểm tra trong Workbench, sửa cấu hình rồi khởi động lại backend. |
| `Unknown database 'smart_logistics_v2'` | Chưa chạy hết `backend/smart_logistics_v2.sql`, hoặc script chạy trên kết nối/schema khác. Thực hiện lại mục 3 trên database test và xác nhận schema bằng `SELECT DATABASE();`. |
| Lỗi tạo bảng hoặc thiếu bảng khi chạy SQL | Kiểm tra MySQL là phiên bản 8.0 trở lên và xem lỗi đầu tiên trong **Action Output**. Đảm bảo chạy toàn bộ file SQL trên đúng kết nối; sau khi import thành công hãy khởi động lại backend để backend tạo các bảng mở rộng còn thiếu. |
| Frontend mở được nhưng API lỗi | Kiểm tra backend/MySQL, `frontend/.env` và `VITE_API_URL`. Sau khi đổi URL, khởi động lại Vite. |
| Bản đồ hiện nền xám/không thấy đường phố | Kiểm tra Docker Compose, trạng thái TileServer và cổng `8080`; frontend phải dùng đúng `VITE_MAP_TILE_URL`. Bản đồ được tự host, không dự phòng sang nhà cung cấp tile bên ngoài. |
| Đã nhập địa chỉ nhưng báo chưa chọn điểm | Địa chỉ dạng chữ không tự tra tọa độ. Bấm **Chọn trên bản đồ**, ghim vị trí thực tế trong một trong sáu phường Gò Vấp; điểm ngoài vùng bị từ chối. |
| Không tải được chỉ đường | Kiểm tra container OSRM, cổng `5001` và API backend; chỉ đường dùng dữ liệu OSM đã cắt vùng, không có dữ liệu giao thông thời gian thực. |
| Báo không có quyền | Đăng nhập đúng tài khoản/role của màn hình; đăng xuất và đăng nhập lại sau khi đổi tài khoản. |
| Kho không tải được hoặc bị chặn | Tài khoản quản lý kho phải được gán `warehouse_id`; quản lý kho bị giới hạn theo phạm vi kho. |
| Không quét được mã | Cấp quyền camera; thử nhập mã thủ công nếu giao diện có trường nhập. |
| Chấm công/GPS không chạy | Cấp quyền camera và vị trí trong trình duyệt; kiểm tra thiết bị có GPS/vị trí khả dụng. |
| Nhập kho báo sai vị trí/kho | Đơn phải đang ở đúng chặng; chọn đúng kho được phân tuyến (kho gần vị trí Shop nhất ở chặng lấy hàng) và mã kệ đã khai báo tại kho đó. |
| Không phân công được tài xế giao | Kiểm tra role tài xế, trạng thái đơn, tài xế đang có nhiệm vụ khác và số dư ký quỹ khả dụng khi đơn có khoản phải thu. |
| Không hoàn tất giao hàng | Giao thành công cần ảnh minh chứng và chữ ký; xác nhận đã thu tiền và chọn phương thức nếu đơn có khoản phải thu. Giao thất bại cần chọn lý do và ảnh minh chứng. |
| Không đăng nhập được CSKH demo | Chỉ chạy `npm run seed:cskh-demo` sau khi đặt `NODE_ENV=development` (hoặc `demo`) và `DEMO_MODE=true`; script không chạy migration hay seed lại toàn bộ dữ liệu. |

## 12. Trạng thái xác minh hiện tại

- `frontend`: `npm run build` chạy thành công; Vite cảnh báo bundle JavaScript lớn hơn 500 kB.
- `frontend`: `npm run lint` hiện không đạt (26 lỗi, 10 cảnh báo theo lần chạy kiểm tra gần nhất).
- `backend`: chưa có bộ test tự động được cấu hình.
