import { Navigate } from 'react-router-dom';

export default function BaoVeTuyenDuong({ children, allowedRoles }) {
  const userRole = localStorage.getItem('role') || localStorage.getItem('user_role');

  // 1. Nếu chưa đăng nhập (không có role trong bộ nhớ) -> Đuổi về trang đăng nhập
  if (!userRole) {
    return <Navigate to="/dang-nhap" replace />;
  }

  // 2. Nếu trang này yêu cầu quyền cụ thể, mà user hiện tại không có quyền đó -> Đuổi về trang chủ
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    alert("Bạn không có quyền truy cập vào phân hệ này!");
    return <Navigate to="/" replace />;
  }

  // 3. Hợp lệ -> Cho phép đi tiếp vào component bên trong
  return children;
}