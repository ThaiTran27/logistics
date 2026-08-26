import { Navigate } from 'react-router-dom';

export default function BaoVeTuyenDuong({ children, quyenChoPhep }) {
    // Lấy quyền của người dùng đang đăng nhập từ Local Storage
    const quyenHienTai = localStorage.getItem('user_role');

    // 1. Chặn: Nếu chưa đăng nhập -> Đuổi về trang Đăng nhập
    if (!quyenHienTai) {
        return <Navigate to="/dang-nhap" replace />;
    }

    // 2. Chặn: Nếu đã đăng nhập nhưng KHÔNG nằm trong danh sách quyền cho phép
    if (quyenChoPhep && !quyenChoPhep.includes(quyenHienTai)) {
        alert("Cảnh báo: Bạn không có quyền truy cập vào phân khu nghiệp vụ này!");
        return <Navigate to="/" replace />; // Đẩy về trang chủ tra cứu
    }

    // 3. Hợp lệ: Mở cổng cho phép vào xem giao diện
    return children;
}