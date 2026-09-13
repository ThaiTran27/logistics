import { Navigate } from 'react-router-dom';

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  const aliases = {
    hr: 'hr_manager',
    human_resources: 'hr_manager',
    nhan_su: 'hr_manager',
    fleet: 'fleet_manager',
    dispatcher: 'fleet_manager',
    dieu_hanh: 'fleet_manager',
    coordinator: 'fleet_manager',
    shipper: 'driver',
    driver: 'driver',
    admin: 'director',
    warehouse: 'warehouse_manager',
    kho: 'warehouse_manager',
    content: 'content_manager',
    content_manager: 'content_manager',
    content_team: 'content_manager',
    phong_ban_noi_dung: 'content_manager',
    marketing: 'content_manager',
    shop: 'shop',
    accountant: 'accountant',
    director: 'director',
    warehouse_manager: 'warehouse_manager',
    fleet_manager: 'fleet_manager',
    hr_manager: 'hr_manager'
  };

  return aliases[role] || role;
};

export default function BaoVeTuyenDuong({ children, allowedRoles }) {
  const rawRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const userRole = normalizeRole(rawRole);
  const allowed = (allowedRoles || []).map(normalizeRole);

  if (!userRole) {
    return <Navigate to="/dang-nhap" replace />;
  }

  if (allowed.length > 0 && !allowed.includes(userRole)) {
    alert('Bạn không có quyền truy cập vào phân hệ này!');
    return <Navigate to="/" replace />;
  }

  return children;
}