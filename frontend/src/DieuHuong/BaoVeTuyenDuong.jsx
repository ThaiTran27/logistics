import { Navigate } from 'react-router-dom';
import KhongCoQuyen from '../Trang/Chung/KhongCoQuyen.jsx';
import { normalizeRole } from '../utils/workspaceRoutes.js';

export default function BaoVeTuyenDuong({ children, allowedRoles }) {
  const rawRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const userRole = normalizeRole(rawRole);
  const allowed = (allowedRoles || []).map(normalizeRole);

  if (!userRole) {
    return <Navigate to="/dang-nhap" replace />;
  }

  if (allowed.length > 0 && !allowed.includes(userRole)) {
    return <KhongCoQuyen />;
  }

  return children;
}