const DRIVER_ROLES = new Set(['pickup_driver', 'delivery_driver']);
const DISPATCH_ROLES = new Set(['fleet_manager', 'director']);
const SHOP_ROLES = new Set(['shop']);
const PAYROLL_ROLES = new Set(['hr_manager', 'director']);

function getRouteApiRoles(route, method) {
  if (route === '/api/shop/returns' && method === 'GET'
    || route === '/api/shop/rma' && method === 'GET'
    || /^\/api\/shop\/returns\/\d+\/received$/.test(route) && method === 'POST'
    || /^\/api\/shop\/rma\/\d+\/redelivery$/.test(route) && method === 'POST') return SHOP_ROLES;
  if (/^\/api\/hr\/payroll\/period\/\d{4}-\d{2}$/.test(route) && method === 'GET'
    || /^\/api\/hr\/payroll\/period\/\d{4}-\d{2}\/lock$/.test(route) && method === 'POST'
    || /^\/api\/hr\/payroll\/payslips\/\d+$/.test(route) && method === 'GET'
    || /^\/api\/hr\/payroll\/payslips\/\d+\/pdf$/.test(route) && method === 'GET') return PAYROLL_ROLES;
  if (/^\/api\/orders\/\d+\/status$/.test(route)) return DRIVER_ROLES;
  if (route.startsWith('/api/accountant/')) return new Set(['accountant', 'director']);
  if (route === '/api/driver/route/today' && method === 'GET'
    || route === '/api/driver/route/reorder' && method === 'POST') return DRIVER_ROLES;
  if (route === '/api/driver/cash-remittances/expected' && method === 'GET') return DRIVER_ROLES;
  if (route === '/api/reason-codes' && method === 'GET') {
    return new Set([...DRIVER_ROLES, 'warehouse_manager', 'fleet_manager', 'director']);
  }
  if (/^\/api\/dispatch\/route\/\d+\/today$/.test(route) && method === 'GET'
    || /^\/api\/dispatch\/route\/optimize\/\d+$/.test(route) && method === 'POST') {
    return DISPATCH_ROLES;
  }
  return null;
}

function getDriverRouteScope(user) {
  const driverId = Number(user?.id);
  const role = String(user?.role || '');
  if (!Number.isSafeInteger(driverId) || driverId <= 0 || !DRIVER_ROLES.has(role)) {
    throw new Error('An authenticated driver account is required.');
  }
  return {
    driverId,
    modes: role === 'pickup_driver' ? ['pickup'] : ['delivery']
  };
}

module.exports = { getDriverRouteScope, getRouteApiRoles };
