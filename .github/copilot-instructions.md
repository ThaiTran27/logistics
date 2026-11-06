# Quy tắc dự án: Hệ thống Logistics (last-mile + trung chuyển)

## Bối cảnh
Hệ thống quản lý vòng đời đơn hàng: khách tạo đơn → điều phối lấy hàng → shipper lấy → nhập kho lấy → trung chuyển → nhập kho phát → giao hàng → thu COD → đối soát → hoàn hàng nếu thất bại. Có tính lương tự động cho shipper.

## Vai trò
Khách gửi (shop), Shipper, Thủ kho, Điều phối, CSKH, Kế toán, Quản trị.

## Quy tắc bắt buộc
- Dùng đúng stack và cấu trúc thư mục đang có, không tự đổi framework hay thư viện lớn.
- Trạng thái đơn chỉ đổi qua MỘT state machine duy nhất. Mỗi lần đổi ghi vào bảng order_events (ai, lúc nào, GPS, lý do, ảnh).
- Luồng: MOI_TAO → CHO_LAY → DA_PHAN_CONG_LAY → DANG_LAY → DA_LAY → DA_NHAP_KHO_LAY → DANG_TRUNG_CHUYEN → DEN_KHO_PHAT → CHO_GIAO → DANG_GIAO → GIAO_THANH_CONG → DA_DOI_SOAT.
- Nhánh phụ: lấy thất bại (hẹn lại hoặc hủy), giao thất bại (giao lại, sau 2-3 lần tự chuyển hoàn), CHO_CHUYEN_HOAN → DANG_HOAN → DA_HOAN, thất lạc/hư hỏng → incident → bồi thường.
- Tiền là số nguyên (VND), không dùng float.
- Đơn giá, phụ cấp, thưởng, phạt nằm trong DB (có ngày hiệu lực), không viết cứng trong code.
- Mọi sự cố/thất bại phải có reason code (nhóm lỗi: khách / shop / shipper / công ty / bất khả kháng).
- Thao tác nhạy cảm (sửa tiền, hủy đơn, xóa, điều chỉnh lương) phải ghi audit_logs.
- Thao tác đổi trạng thái, đối soát, tính lương dùng transaction và khóa dòng để tránh race condition.
- Phân quyền theo vai trò: shipper chỉ thấy đơn của mình, kế toán không sửa được trạng thái đơn.
- Logic tiền, trạng thái, lương phải có unit test.
- Mỗi lần chỉ làm đúng việc được yêu cầu, giải thích ngắn file đã sửa và cách test.

## Quy tắc theo stack hiện tại
- Backend là Express 5 + MySQL trong `backend/server.js`. KHÔNG viết lại toàn bộ và KHÔNG đổi framework. Khi cần, tách dần logic mới ra `backend/services/` và `backend/utils/`, `server.js` chỉ gọi lại.
- Mọi thay đổi schema viết thành file migration SQL đánh số trong `backend/migrations/` (có cả phần rollback), không sửa trực tiếp `smart_logistics_v2.sql` ngoài việc cập nhật bản schema đầy đủ ở cuối.
- API hiện có phải giữ tương thích ngược với frontend; nếu bắt buộc đổi response thì sửa luôn phần frontend liên quan.
- Mọi thao tác nhiều bước liên quan đến trạng thái đơn, COD, ví, đối soát, lương phải nằm trong một transaction (`connection.beginTransaction`) và dùng `SELECT ... FOR UPDATE` trên các dòng bị ảnh hưởng.
- Trạng thái đơn hiện dùng chuỗi: `pending`, `picking`, `picked_up`, `at_origin_warehouse`, `transferring_to_central`, `at_central_warehouse`, `transferring_to_destination`, `at_destination_warehouse`, `delivering`, `completed`, `returning`, `cancelled`. Giữ nguyên các giá trị này, chỉ thêm giá trị mới khi được yêu cầu.
- Test dùng Vitest (hoặc Jest nếu đã có), đặt trong `backend/tests/`.
