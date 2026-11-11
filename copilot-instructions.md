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