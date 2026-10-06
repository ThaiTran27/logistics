# Smart Logistics

Ứng dụng quản lý giao nhận gồm frontend React/Vite, backend Express/Node.js, MySQL và cập nhật thời gian thực qua Socket.IO. Tài liệu này hướng dẫn cài đặt local và kiểm tra các luồng nghiệp vụ theo thứ tự.

## 1. Thành phần và đường dẫn

- `frontend/`: giao diện React, Vite, Tailwind CSS.
- `backend/`: API Express, Socket.IO, kết nối MySQL, tải ảnh và tài liệu.
- `backend/smart_logistics_v2.sql`: tạo schema và dữ liệu mẫu.
- `shared/hcmc-legacy-boundary.geojson`: dữ liệu vùng phục vụ TP. Hồ Chí Minh dùng cho bản đồ và kiểm tra tọa độ.

## 2. Yêu cầu trước khi chạy

- Node.js và npm.
- MySQL đang chạy local.
- Trình duyệt hiện đại. Camera, microphone hoặc GPS cần được cấp quyền khi kiểm tra các tính năng tương ứng.

Backend hiện cấu hình MySQL trực tiếp trong `backend/server.js`:

| Thuộc tính | Giá trị mặc định |
|---|---|
| Host | `localhost` |
| User | `root` |
| Password | rỗng |
| Database | `smart_logistics_v2` |

Nếu MySQL của bạn có thông tin đăng nhập khác, sửa cấu hình này trong `backend/server.js` trước khi khởi động. Các giá trị DB chưa được đọc từ biến môi trường.

## 3. Cài đặt database

> **Cảnh báo dữ liệu:** `backend/smart_logistics_v2.sql` tạo database `smart_logistics_v2`, xóa các bảng hiện có rồi tạo lại và nạp dữ liệu mẫu. Chỉ chạy trên database/máy test hoặc sao lưu dữ liệu trước. Không chạy trên môi trường có dữ liệu cần giữ.

1. Khởi động MySQL.
2. Mở `backend/smart_logistics_v2.sql` bằng MySQL Workbench hoặc công cụ MySQL tương đương.
3. Chạy toàn bộ script.
4. Xác nhận database `smart_logistics_v2` cùng các bảng và dữ liệu seed đã được tạo.

Script mẫu tạo kho tổng, kho con Gò Vấp và Quận 1, người dùng thử nghiệm, đơn hàng mẫu, tin tức, yêu cầu website, nghỉ phép, chấm công và dữ liệu nhân sự liên quan.

## 4. Cấu hình tùy chọn

Backend có file mẫu `backend/.env.example`. Tạo bản sao tên `backend/.env` nếu cần cấu hình các tính năng tùy chọn:

```dotenv
# Chat AI: để trống sẽ dùng trợ lý FAQ tích hợp sẵn
CHAT_AI_API_KEY=
CHAT_AI_BASE_URL=https://api.openai.com/v1
CHAT_AI_MODEL=gpt-4o-mini

# Dùng giá trị bí mật ổn định riêng cho mỗi môi trường
WEBHOOK_ENCRYPTION_KEY=
JWT_SECRET=

# SMTP chỉ cần khi cần gửi email thật (OTP giao hàng, hóa đơn, ...)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
```

Không đưa khóa bí mật, mật khẩu thật hoặc thông tin SMTP vào Git. Giữ `JWT_SECRET` và `WEBHOOK_ENCRYPTION_KEY` ổn định giữa các lần khởi động nếu đang cần duy trì phiên đăng nhập hoặc giải mã bí mật webhook đã lưu. Nếu `JWT_SECRET` chưa cấu hình, backend sinh khóa mới khi khởi động; các token cũ sẽ mất hiệu lực sau khi restart.

Frontend mặc định gọi API ở `http://localhost:5000`. Nếu cần đổi địa chỉ API, tạo `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:5000
```

## 5. Khởi động ứng dụng

Mở hai cửa sổ terminal.

### Terminal 1 — backend

```powershell
cd backend
npm install
npm start
```

Khi khởi động thành công, backend lắng nghe tại `http://localhost:5000`. Kiểm tra terminal có thông báo kết nối database thành công.

### Terminal 2 — frontend

```powershell
cd frontend
npm install
npm run dev
```

Mở địa chỉ local Vite in ra trong terminal, thường là `http://localhost:5173`.

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
| Kho | `kho@smartlogistics.vn`, `kho2@smartlogistics.vn` |
| Cửa hàng/Shop | `shop@smartlogistics.vn`, `shop2@smartlogistics.vn` |
| Tài xế lấy hàng | `taixe1@smartlogistics.vn`, `taixe2@smartlogistics.vn` |
| Tài xế giao hàng | `taixe3@smartlogistics.vn`, `taixe4@smartlogistics.vn` |
| Nội dung | `content@smartlogistics.vn`, `content2@smartlogistics.vn` |

Tài khoản `kho@smartlogistics.vn` được gán kho tổng; `kho2@smartlogistics.vn` được gán kho Gò Vấp. SQL seed hiện không tạo sẵn tài khoản `customer_service` hoặc `linehaul_driver`; cần tạo tài khoản có đúng role nếu muốn kiểm tra các luồng đó. Tài khoản chỉ được mở phân hệ đúng với quyền được cấp.

## 7. Checklist kiểm tra luồng giao nhận chính

Nên chạy theo đúng thứ tự dưới đây để kiểm tra trạng thái chuyển qua từng chặng. Đăng xuất và đăng nhập tài khoản tương ứng khi đổi vai trò.

### A. Tạo đơn — Shop

1. Đăng nhập `shop2@smartlogistics.vn` với mật khẩu `123`.
2. Vào `/cua-hang` → **Thông Tin Shop**. Lần đầu, nhập tên và số điện thoại Shop; tìm `Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh`, chọn kết quả trên bản đồ rồi bấm **Lưu thông tin Shop**. Đây là vị trí lấy hàng mặc định được lưu cho các đơn sau.
3. Mở **Tạo Đơn Giao Hàng**. Xác nhận địa chỉ lấy hàng đã tự điền từ hồ sơ Shop và vị trí đã được xác nhận; không cần chọn lại cho từng đơn. Nếu đổi địa chỉ Shop, cập nhật tại tab **Thông Tin Shop**.
4. Điền bộ dữ liệu test cơ bản sau (số điện thoại là dữ liệu giả; email hãy thay bằng hộp thư bạn có thể mở):

   | Trường | Giá trị để nhập |
   |---|---|
   | Tên người nhận | `Nguyễn Thị Mai Test` |
   | Số điện thoại | `0901000010` |
   | Email người nhận | Email của bạn để nhận OTP giao hàng |
   | Địa chỉ Shop/điểm lấy | Tự điền từ hồ sơ Shop đã lưu |
   | Địa chỉ giao | Tìm kiếm địa chỉ hoặc chọn trên bản đồ; có thể chọn bất kỳ khu vực nào trong TP. Hồ Chí Minh |
   | Cân nặng | `1` kg |
   | Dài × rộng × cao | `10` × `10` × `10` cm |
   | Giá trị hàng | `0` |
   | COD | `0` cho lượt test không cần ký quỹ |
   | Người trả cước | Người gửi |
   | Dịch vụ | Tiêu chuẩn |
   | Hàng dễ vỡ / vùng xa | Không |

5. Tại ô tìm vị trí giao, nhập `Số 15 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh`, bấm **Tìm** rồi chọn kết quả gợi ý. Kiểm tra trạng thái điểm giao báo **Đã xác nhận** và tọa độ nằm gần `10.7798, 106.6990`. Không phải chọn Quận/Huyện; có thể thử một địa chỉ ở khu vực khác trong TP. Hồ Chí Minh.
6. Bấm **Tìm** hoặc nhấn Enter, sau đó phải chọn một kết quả để xác nhận vị trí; chỉ gõ địa chỉ chưa đủ để lưu. Nếu không có kết quả, thử nhập tên đường/phường ngắn hơn. Có thể chọn trực tiếp trên bản đồ; nếu nền bản đồ trống hoàn toàn, kiểm tra mạng/firewall có chặn các máy chủ tile và dịch vụ địa chỉ không. Sau khi chọn điểm, không sửa tay nội dung địa chỉ vì thao tác sửa sẽ bỏ trạng thái xác nhận vị trí.
7. Gửi đơn, ghi lại mã vận đơn hiển thị. Không dùng mã ví dụ `SLTEST...` cho lượt tạo đơn mới.
8. Tạo thêm một đơn khác: địa chỉ lấy hàng phải tiếp tục tự điền như hồ sơ đã lưu; chọn một địa chỉ giao khác trong TP. Hồ Chí Minh để xác nhận không bị giới hạn vào một quận/huyện cụ thể.

**Kỳ vọng:** đơn tạo thành công với trạng thái `pending`. Tọa độ Shop được lấy từ hồ sơ và thuộc TP. Hồ Chí Minh; tọa độ giao được phép ở bất kỳ địa chỉ nào trong TP. Hồ Chí Minh. Sau khi tạo đơn, địa chỉ lấy hàng vẫn được giữ cho đơn tiếp theo. Với vị trí Shop gần `10.8231, 106.6881`, kho nguồn gần nhất cần là kho con Gò Vấp.

**Kiểm tra cập nhật hồ sơ:** vào **Thông Tin Shop**, đổi số điện thoại hoặc địa chỉ/vị trí, lưu rồi tải lại trang. Tên và địa chỉ mới phải còn nguyên; đơn tiếp theo phải tự dùng vị trí Shop mới. Email đăng nhập chỉ đọc và không đổi được từ màn hình này.

### B. Phân tài xế lấy hàng — Điều hành

1. Đăng nhập `dieu_hanh@smartlogistics.vn`.
2. Vào `/dieu-hanh` → **Phân Tuyến Tài Xế**.
3. Tìm đúng mã vận đơn vừa ghi lại; xác nhận người nhận là `Nguyễn Thị Mai Test` để tránh chọn nhầm đơn seed.
4. Chọn nhiệm vụ lấy hàng tại Shop (`pickup`) và tài xế lấy hàng đang hoạt động, ví dụ `taixe2@smartlogistics.vn`.
5. Xác nhận phân công. Hệ thống tự chọn kho con gần tọa độ Shop nhất.

**Kỳ vọng:** đơn sang `picking`; đơn xuất hiện trong danh sách nhiệm vụ của `taixe2`. Với tọa độ Shop gần `10.8231, 106.6881`, kho nguồn cần là kho con Gò Vấp.

### C. Lấy hàng tại Shop — Tài xế lấy hàng

1. Đăng xuất khỏi Điều hành; đăng nhập `taixe2@smartlogistics.vn` với mật khẩu `123`.
2. Mở `/tai-xe` → **Đơn cần lấy** → đúng đơn `Nguyễn Thị Mai Test` → **Mở camera quét mã nhận hàng**.
3. Cho phép trình duyệt dùng camera. Đưa nhãn mã vạch của đúng đơn vào khung, giữ máy ổn định và đủ sáng.
4. Nếu camera không hoạt động/không đọc được, nhập **mã vận đơn thật vừa tạo ở bước A** vào ô dự phòng rồi nhấn **Xác nhận**. Không nhập mã ở ví dụ trong README. Có thể dùng máy quét USB/Bluetooth: đặt con trỏ vào ô dự phòng và quét nhãn.
5. Nếu hiện “Mã quét không khớp”, đối chiếu mã đang hiện trong hộp quét với nhãn; nếu hiện lỗi kết nối, kiểm tra backend đang chạy ở cổng `5000`.

**Kỳ vọng:** chỉ mã khớp với đơn đang mở mới được xác nhận; thông báo thành công hiện ra và trạng thái đơn sang `picked_up`. Sau đó bàn giao kiện cho Kho Gò Vấp quét nhập. Phải ở `/tai-xe`, không phải `/dieu-hanh`.

### D. Nhập kho nguồn — Kho

1. Đăng xuất khỏi tài xế; đăng nhập `kho2@smartlogistics.vn` với mật khẩu `123`.
2. Vào `/kho` → **Máy Quét Mã Vạch**; xác nhận kho đang thao tác là **Kho con Gò Vấp**.
3. Tại phần **Tạo nhãn vị trí kệ mới**, nhập mã `TEST-A1-03` và tên `Kệ test Gò Vấp`, sau đó nhấn **Tạo mã và nhãn mã vạch**. Nếu mã này đã tồn tại từ lần test trước, đổi mã thành `TEST-A1-04`. Khi tạo thành công, giao diện tự chọn vị trí vừa tạo.
4. Nhập/quét đúng mã vận đơn đã ghi ở bước A. Nếu không có máy quét, nhập mã vào ô lớn bên dưới rồi nhấn Enter.
5. Xác nhận kết quả nhập kho; mở danh sách tồn kho để kiểm tra đơn và vị trí kệ `TEST-A1-03` (hoặc mã mới bạn vừa tạo).

**Kỳ vọng:** đơn sang `at_origin_warehouse`, hiện trong tồn kho Gò Vấp tại vị trí kệ vừa tạo. Nếu thông báo đơn được phân tuyến đến kho khác, dừng tại đây: đơn phải được tạo với vị trí Shop gần Gò Vấp **trước khi Điều hành phân công**, vì đổi địa chỉ sau khi phân công không đổi kho nguồn.

Kho nguồn được hệ thống xác định khi Điều hành phân công tài xế lấy hàng: hệ thống chọn kho con đang hoạt động gần tọa độ Shop nhất. Ví dụ, tọa độ Shop mặc định `10.762622, 106.660172` gần kho Quận 1 hơn kho Gò Vấp. Vì tài khoản `kho2` chỉ thao tác tại kho Gò Vấp, đơn được tạo ở vị trí mặc định có thể không quét nhận được tại tài khoản này. Nếu quét sai kho, backend trả tên kho được phân tuyến và tên kho đang chọn; với bộ dữ liệu mẫu ở bước A, kho nguồn dự kiến là Gò Vấp.

### E. Trung chuyển kho nguồn → kho tổng

1. Đăng nhập Điều hành; chọn đơn đang ở `at_origin_warehouse`.
2. Phân nhiệm vụ trung chuyển về kho tổng (`central_transfer`) cho tài xế lấy hàng.
3. Tài xế thực hiện nhiệm vụ trung chuyển.
4. Đăng nhập tài khoản kho tổng `kho@smartlogistics.vn`, mở `/kho` và quét nhận tại đúng kho tổng.

**Kỳ vọng:** trạng thái lần lượt qua `transferring_to_central` rồi `at_central_warehouse`.

### F. Trung chuyển kho tổng → kho đích

1. Tại `/kho`, kiểm tra/tạo bao hàng và niêm phong bao theo quy trình màn hình.
2. Điều hành hoặc Kho tổng tạo chuyến giữa kho tổng và kho con đích; chọn xe sẵn sàng và tài xế line-haul nếu đã tạo tài khoản.
3. Gán bao đúng tuyến vào chuyến, rồi thực hiện quét bao/khởi hành/đến kho theo màn hình.
4. Điều hành phân nhiệm vụ `destination_transfer` cho đơn nếu luồng đang yêu cầu phân tài xế theo đơn.
5. Kho con đích quét nhận đơn tại đúng kho đích.

**Kỳ vọng:** chuyến/bao được ghi nhận đúng tuyến; đơn đến kho con đích với trạng thái `at_destination_warehouse`. Kho tổng chỉ được lập chuyến xuất từ kho được gán.

### G. Phân tài xế giao hàng

1. Đăng nhập Điều hành, chọn đơn tại `at_destination_warehouse`.
2. Phân nhiệm vụ `delivery` cho tài xế giao hàng, ví dụ `taixe3@smartlogistics.vn`.
3. Nếu đơn có COD hoặc cước người nhận phải trả, đảm bảo tài xế có đủ ký quỹ khả dụng trước khi phân công.

**Kỳ vọng:** tài xế giao nhìn thấy đơn. Khi khoản phải thu lớn hơn 0, backend giữ ký quỹ; nếu không đủ số dư khả dụng thì phân công bị từ chối.

### H. Giao hàng thành công hoặc thất bại — Tài xế giao hàng

1. Đăng nhập tài xế giao được phân công, vào `/tai-xe`.
2. Bắt đầu giao; trạng thái chuyển sang `delivering`.
3. Với thành công, nhập OTP khách nhận được qua email, xác nhận thu COD/cước nếu có, chụp ảnh minh chứng và lấy chữ ký điện tử người nhận.
4. Với thất bại, chọn lý do hợp lệ và gửi ảnh minh chứng.

**Kỳ vọng:**

- Giao thành công: đơn thành `completed`, lưu OTP đã xác minh, ảnh, chữ ký và thông tin thu COD.
- Giao thất bại: đơn thành `returning`; khi hàng hoàn về kho hiện giữ đơn và được quét nhận, đơn kết thúc thành `cancelled`.

Nếu chưa cấu hình SMTP, có thể dùng database **test** để kiểm tra OTP được ghi ở đơn hàng; không dùng cách này trên dữ liệu thật.

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
| Backend không khởi động/kết nối DB lỗi | MySQL đang chạy chưa; database đã import chưa; thông tin host/user/password/database trong `server.js` có đúng không. |
| Frontend mở được nhưng API lỗi | Backend có chạy ở cổng `5000` không; frontend `VITE_API_URL` có đúng không. Một số màn hình hiện gọi trực tiếp `localhost:5000`. |
| Bản đồ hiện nền xám/không thấy đường phố | Màn Shop lần lượt thử nền OpenStreetMap, CARTO và Esri. Nếu cả ba không tải, kiểm tra Internet/firewall hoặc DNS có chặn máy chủ bản đồ không. Khi đó ô tìm địa chỉ thử Nominatim rồi Photon; chọn một kết quả mới xác nhận được điểm. |
| Đã gõ địa chỉ Shop nhưng vẫn báo chưa chọn địa chỉ | Bấm **Tìm** hoặc Enter, đợi kết quả, rồi bấm chọn một gợi ý. Gõ chữ trong ô tìm kiếm chưa lưu địa chỉ/tọa độ. Nếu cả hai dịch vụ tìm kiếm không truy cập được, kết nối mạng hoặc firewall cần cho phép các dịch vụ bản đồ/địa chỉ. |
| Báo không có quyền | Đăng nhập đúng tài khoản/role của màn hình; đăng xuất và đăng nhập lại sau khi đổi tài khoản. |
| Kho không tải được hoặc bị chặn | Tài khoản quản lý kho phải được gán `warehouse_id`; quản lý kho bị giới hạn theo phạm vi kho. |
| Không quét được mã | Cấp quyền camera; thử nhập mã thủ công nếu giao diện có trường nhập. |
| Chấm công/GPS không chạy | Cấp quyền camera và vị trí trong trình duyệt; kiểm tra thiết bị có GPS/vị trí khả dụng. |
| Nhập kho báo sai vị trí/kho | Đơn phải đang ở đúng chặng; chọn đúng kho được phân tuyến (kho gần vị trí Shop nhất ở chặng lấy hàng) và mã kệ đã khai báo tại kho đó. |
| Không phân công được tài xế giao | Kiểm tra role tài xế, trạng thái đơn, tài xế đang có nhiệm vụ khác và số dư ký quỹ khả dụng khi đơn có khoản phải thu. |
| Không hoàn tất giao hàng | Cần OTP đúng; ảnh minh chứng; chữ ký nếu thành công; xác nhận thu tiền và phương thức COD khi có khoản phải thu. |
| Không nhận được email OTP | Kiểm tra cấu hình SMTP và địa chỉ email người nhận. Có thể kiểm tra OTP trong database test. |
| Chat nhân viên/line-haul không có tài khoản phù hợp | Seed chưa tạo role `customer_service` và `linehaul_driver`; tạo người dùng có đúng role để kiểm tra. |

## 12. Trạng thái xác minh hiện tại

- `frontend`: `npm run build` chạy thành công; Vite cảnh báo bundle JavaScript lớn hơn 500 kB.
- `frontend`: `npm run lint` hiện không đạt (26 lỗi, 10 cảnh báo theo lần chạy kiểm tra gần nhất).
- `backend`: chưa có bộ test tự động được cấu hình.
