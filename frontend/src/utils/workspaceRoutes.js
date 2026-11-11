const roleAliases = {
  hr: 'hr_manager',
  human_resources: 'hr_manager',
  nhan_su: 'hr_manager',
  fleet: 'fleet_manager',
  dispatcher: 'fleet_manager',
  dieu_hanh: 'fleet_manager',
  coordinator: 'fleet_manager',
  shipper: 'driver',
  driver: 'driver',
  pickup_driver: 'pickup_driver',
  delivery_driver: 'delivery_driver',
  linehaul_driver: 'linehaul_driver',
  admin: 'director',
  warehouse: 'warehouse_manager',
  kho: 'warehouse_manager',
  content: 'content_manager',
  content_manager: 'content_manager',
  cskh: 'customer_service',
  customer_support: 'customer_service',
  support: 'customer_service',
  customer_service: 'customer_service',
  content_team: 'content_manager',
  phong_ban_noi_dung: 'content_manager',
  marketing: 'content_manager',
  shop: 'shop',
  accountant: 'accountant',
  director: 'director',
  warehouse_manager: 'warehouse_manager',
  fleet_manager: 'fleet_manager',
  hr_manager: 'hr_manager',
  customer: 'customer'
};

const workspaceByRole = {
  shop: '/cua-hang',
  driver: '/tai-xe',
  pickup_driver: '/tai-xe',
  delivery_driver: '/tai-xe',
  linehaul_driver: '/tai-xe',
  warehouse_manager: '/kho',
  fleet_manager: '/dieu-hanh',
  accountant: '/ke-toan',
  director: '/admin',
  hr_manager: '/nhan-su',
  content_manager: '/phong-ban-noi-dung',
  customer_service: '/ho-tro',
  customer: '/'
};

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return roleAliases[role] || role;
}

export function getWorkspacePath(role) {
  return workspaceByRole[normalizeRole(role)] || '/';
}
