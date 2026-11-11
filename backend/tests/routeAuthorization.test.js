import { describe, expect, it } from 'vitest';
import routeAuthorization from '../services/routeAuthorization.js';

const { getDriverRouteScope, getRouteApiRoles } = routeAuthorization;

describe('route API authorization', () => {
  it('restricts route viewing and reorder to driver roles', () => {
    expect([...getRouteApiRoles('/api/driver/route/today', 'GET')].sort())
      .toEqual(['delivery_driver', 'pickup_driver']);
    expect([...getRouteApiRoles('/api/driver/route/reorder', 'POST')].sort())
      .toEqual(['delivery_driver', 'pickup_driver']);
  });

  it('allows only drivers to calculate expected COD remittance', () => {
    expect([...getRouteApiRoles('/api/driver/cash-remittances/expected', 'GET')].sort())
      .toEqual(['delivery_driver', 'pickup_driver']);
    expect(getRouteApiRoles('/api/driver/cash-remittances/expected', 'POST')).toBeNull();
  });

  it('allows only Shop accounts on the supported RMA methods and paths', () => {
    for (const [route, method] of [
      ['/api/shop/returns', 'GET'],
      ['/api/shop/rma', 'GET'],
      ['/api/shop/returns/42/received', 'POST'],
      ['/api/shop/rma/42/redelivery', 'POST']
    ]) {
      expect([...getRouteApiRoles(route, method)]).toEqual(['shop']);
    }
    expect(getRouteApiRoles('/api/shop/returns', 'POST')).toBeNull();
    expect(getRouteApiRoles('/api/shop/rma/42/redelivery', 'PUT')).toBeNull();
  });

  it('keeps payroll period and payslip APIs unavailable to accountants', () => {
    const routes = [
      ['/api/hr/payroll/period/2026-04', 'GET'],
      ['/api/hr/payroll/period/2026-04/lock', 'POST'],
      ['/api/hr/payroll/payslips/42', 'GET'],
      ['/api/hr/payroll/payslips/42/pdf', 'GET']
    ];
    for (const [route, method] of routes) {
      const roles = getRouteApiRoles(route, method);
      expect([...roles].sort()).toEqual(['director', 'hr_manager']);
      expect(roles.has('accountant')).toBe(false);
    }
  });

  it('prevents customer service from changing order status or accessing finance APIs', () => {
    expect([...getRouteApiRoles('/api/orders/42/status', 'PUT')].sort())
      .toEqual(['delivery_driver', 'pickup_driver']);
    expect([...getRouteApiRoles('/api/accountant/pay/12', 'PUT')])
      .toEqual(['accountant', 'director']);
  });

  it('restricts dispatcher route APIs to dispatch management roles and methods', () => {
    expect([...getRouteApiRoles('/api/dispatch/route/42/today', 'GET')].sort())
      .toEqual(['director', 'fleet_manager']);
    expect([...getRouteApiRoles('/api/dispatch/route/optimize/42', 'POST')].sort())
      .toEqual(['director', 'fleet_manager']);
    expect(getRouteApiRoles('/api/dispatch/route/42/today', 'POST')).toBeNull();
  });

  it('allows operational roles to read failure reason codes', () => {
    expect([...getRouteApiRoles('/api/reason-codes', 'GET')].sort())
      .toEqual(['delivery_driver', 'director', 'fleet_manager', 'pickup_driver', 'warehouse_manager']);
    expect(getRouteApiRoles('/api/reason-codes', 'POST')).toBeNull();
  });

  it('scopes route IDs and modes to the authenticated driver account', () => {
    expect(getDriverRouteScope({ id: 27, role: 'pickup_driver' }))
      .toEqual({ driverId: 27, modes: ['pickup'] });
    expect(getDriverRouteScope({ id: 32, role: 'delivery_driver' }))
      .toEqual({ driverId: 32, modes: ['delivery'] });
    expect(() => getDriverRouteScope({ id: 27, role: 'fleet_manager' })).toThrow();
  });
});
