import { describe, expect, it, vi } from 'vitest';
import optimizer from '../services/routeOptimizer.js';

const { clearRouteMatrixCache, groupStops, haversineMeters, optimizeRoute } = optimizer;

function mockOsrmTable() {
  return vi.fn(async (url) => {
    const match = url.match(/\/table\/v1\/driving\/([^?]+)/);
    const coordinates = match[1].split(';').map((pair) => {
      const [lng, lat] = pair.split(',').map(Number);
      return { lat, lng };
    });
    const distances = coordinates.map((from) => coordinates.map((to) => haversineMeters(from, to)));
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances,
        durations: distances.map((row) => row.map((distance) => distance / 8))
      })
    };
  });
}

async function optimizePickup(stops, options = {}) {
  clearRouteMatrixCache();
  return optimizeRoute({
    driverId: 17,
    mode: 'pickup',
    startPoint: { lat: 10, lng: 106 },
    endPoint: { lat: 10, lng: 106 },
    now: new Date('2025-01-01T09:00:00.000Z'),
    pickupSlaMinutes: 0,
    pickupMaxWaitMinutes: 5000,
    stops,
    fetchImpl: mockOsrmTable(),
    ...options
  });
}

describe('route optimization', () => {
  it('orders collinear delivery points from the warehouse outward and reports totals', async () => {
    clearRouteMatrixCache();
    const route = await optimizeRoute({
      driverId: 17,
      mode: 'delivery',
      startPoint: { lat: 10, lng: 106 },
      stops: [
        { order_id: 3, lat: 10, lng: 106.03, address: '30 Đường A' },
        { order_id: 1, lat: 10, lng: 106.01, address: '10 Đường A' },
        { order_id: 2, lat: 10, lng: 106.02, address: '20 Đường A' }
      ],
      fetchImpl: mockOsrmTable()
    });

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([1, 2, 3]);
    expect(route.stops.every((stop) => stop.plannedEta)).toBe(true);
    expect(route.totalDistanceM).toBeGreaterThan(0);
    expect(route.isEstimated).toBe(false);
  });

  it('promotes a far express stop ahead of a nearby standard stop', async () => {
    clearRouteMatrixCache();
    const route = await optimizeRoute({
      driverId: 17,
      mode: 'delivery',
      startPoint: { lat: 10, lng: 106 },
      stops: [
        { order_id: 1, lat: 10, lng: 106.0001, address: 'Gần', prioritySeconds: 0 },
        { order_id: 2, lat: 10, lng: 106.02, address: 'Xa', prioritySeconds: 1800 }
      ],
      fetchImpl: mockOsrmTable()
    });

    expect(route.stops[0].orderIds).toContain(2);
  });

  it('groups orders at the same shop for pickup and same address for delivery', () => {
    expect(groupStops([
      { order_id: 10, shop_id: 9, lat: 10, lng: 106, address: 'Shop A' },
      { order_id: 11, shop_id: 9, lat: 10.001, lng: 106.001, address: 'Shop A' }
    ], 'pickup')).toHaveLength(1);
    expect(groupStops([
      { order_id: 12, lat: 10, lng: 106, address: '12 Đường X, Phường A' },
      { order_id: 13, lat: 10, lng: 106, address: '12 Đường X, Phường A' }
    ], 'delivery')).toHaveLength(1);
  });

  it('uses Haversine estimates when OSRM fails', async () => {
    clearRouteMatrixCache();
    const route = await optimizeRoute({
      driverId: 17,
      mode: 'delivery',
      startPoint: { lat: 10, lng: 106 },
      stops: [{ order_id: 1, lat: 10.01, lng: 106.01, address: 'Địa chỉ' }],
      fetchImpl: vi.fn().mockRejectedValue(new Error('OSRM unavailable'))
    });

    expect(route.isEstimated).toBe(true);
    expect(route.totalDistanceM).toBeGreaterThan(0);
  });

  it('excludes completed stops from a recalculated route', async () => {
    clearRouteMatrixCache();
    const route = await optimizeRoute({
      driverId: 17,
      mode: 'delivery',
      startPoint: { lat: 10, lng: 106 },
      stops: [
        { order_id: 1, lat: 10, lng: 106.01, address: 'Đã xong', status: 'completed' },
        { order_id: 2, lat: 10, lng: 106.02, address: 'Còn lại', status: 'planned' }
      ],
      fetchImpl: mockOsrmTable()
    });

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([2]);
  });

  it('delays the appointment stop and all following ETAs until the appointment time', async () => {
    clearRouteMatrixCache();
    const now = new Date('2025-01-01T08:00:00.000Z');
    const route = await optimizeRoute({
      driverId: 17,
      mode: 'pickup',
      startPoint: { lat: 10, lng: 106 },
      endPoint: { lat: 10, lng: 106 },
      now,
      stops: [
        {
          order_id: 1,
          shop_id: 1,
          lat: 10,
          lng: 106.001,
          address: 'Shop A',
          appointmentAt: '2025-01-01T09:00:00.000Z'
        },
        { order_id: 2, shop_id: 2, lat: 10, lng: 106.002, address: 'Shop B' }
      ],
      fetchImpl: mockOsrmTable()
    });

    expect(new Date(route.stops[0].plannedEta).getTime()).toBeGreaterThanOrEqual(Date.parse('2025-01-01T09:00:00.000Z'));
    expect(new Date(route.stops[1].plannedEta).getTime()).toBeGreaterThan(new Date(route.stops[0].plannedEta).getTime());
    expect(route.totalDurationS).toBeGreaterThanOrEqual(60 * 60);
  });

  it('keeps an older FIFO bucket ahead of a closer newer stop', async () => {
    const route = await optimizePickup([
      { order_id: 1, shop_id: 1, lat: 10, lng: 106.1, address: 'Xa', created_at: '2025-01-01T08:05:00.000Z' },
      { order_id: 2, shop_id: 2, lat: 10, lng: 106.001, address: 'Gần', created_at: '2025-01-01T08:35:00.000Z' }
    ]);

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([1, 2]);
  });

  it('puts the earlier pickup deadline first within one FIFO bucket', async () => {
    const route = await optimizePickup([
      {
        order_id: 1, shop_id: 1, lat: 10, lng: 106.1, address: 'Xa',
        created_at: '2025-01-01T08:05:00.000Z',
        pickup_deadline_at: '2025-01-01T08:45:00.000Z'
      },
      {
        order_id: 2, shop_id: 2, lat: 10, lng: 106.001, address: 'Gần',
        created_at: '2025-01-01T08:20:00.000Z',
        pickup_deadline_at: '2025-01-01T08:50:00.000Z'
      }
    ]);

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([1, 2]);
  });

  it('uses the configured lexicographic order for pickup criteria', async () => {
    const route = await optimizePickup([
      {
        order_id: 1, shop_id: 1, lat: 10, lng: 106.001, address: 'FIFO cũ',
        created_at: '2025-01-01T08:05:00.000Z',
        pickup_deadline_at: '2025-01-01T08:55:00.000Z'
      },
      {
        order_id: 2, shop_id: 2, lat: 10, lng: 106.1, address: 'Hạn gấp',
        created_at: '2025-01-01T08:35:00.000Z',
        pickup_deadline_at: '2025-01-01T08:40:00.000Z'
      }
    ], { pickupPriorityOrder: 'deadline,fifo,distance' });

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([2, 1]);
  });

  it('uses the shortest OSRM matrix leg when FIFO bucket and deadline are tied', async () => {
    const route = await optimizePickup([
      {
        order_id: 1, shop_id: 1, lat: 10, lng: 106.05, address: 'Xa',
        created_at: '2025-01-01T08:05:00.000Z',
        pickup_deadline_at: '2025-01-01T08:45:00.000Z'
      },
      {
        order_id: 2, shop_id: 2, lat: 10, lng: 106.001, address: 'Gần',
        created_at: '2025-01-01T08:20:00.000Z',
        pickup_deadline_at: '2025-01-01T08:45:00.000Z'
      }
    ]);

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([2, 1]);
  });

  it('promotes a stop that exceeded the maximum wait over a closer recent stop', async () => {
    const route = await optimizePickup([
      {
        order_id: 1, shop_id: 1, lat: 10, lng: 106.1, address: 'Đợi lâu',
        created_at: '2025-01-01T06:00:00.000Z'
      },
      {
        order_id: 2, shop_id: 2, lat: 10, lng: 106.001, address: 'Mới',
        created_at: '2025-01-01T08:55:00.000Z'
      }
    ], { pickupMaxWaitMinutes: 120 });

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([1, 2]);
    expect(route.stops[0].rankingReason).toContain('Chờ quá ngưỡng 120 phút');
  });

  it('uses the configured pickup SLA deadline and records it in the ranking reason', async () => {
    const route = await optimizePickup([{
      order_id: 1, shop_id: 1, lat: 10, lng: 106.001, address: 'Shop',
      created_at: '2025-01-01T08:05:00.000Z'
    }], { pickupSlaMinutes: 60 });

    expect(route.stops[0].rankingReason).toContain('hạn SLA 16:05');
  });

  it('groups same-shop orders and ranks the stop using its oldest order', async () => {
    const route = await optimizePickup([
      {
        order_id: 11, shop_id: 7, lat: 10, lng: 106.02, address: 'Shop A',
        created_at: '2025-01-01T08:35:00.000Z'
      },
      {
        order_id: 12, shop_id: 7, lat: 10, lng: 106.02, address: 'Shop A',
        created_at: '2025-01-01T08:05:00.000Z'
      },
      {
        order_id: 13, shop_id: 8, lat: 10, lng: 106.001, address: 'Shop B',
        created_at: '2025-01-01T08:35:00.000Z'
      }
    ]);

    expect(route.stops[0].orderIds).toEqual([11, 12]);
    expect(route.stops[0].rankingReason).toContain('Khung');
    expect(route.stops[1].orderIds).toEqual([13]);
  });

  it('places express pickup stops ahead of standard stops', async () => {
    const route = await optimizePickup([
      {
        order_id: 1, shop_id: 1, lat: 10, lng: 106.001, address: 'Thường',
        created_at: '2025-01-01T08:05:00.000Z'
      },
      {
        order_id: 2, shop_id: 2, lat: 10, lng: 106.1, address: 'Hỏa tốc',
        created_at: '2025-01-01T08:35:00.000Z',
        service_type: 'express'
      }
    ]);

    expect(route.stops[0].orderIds).toContain(2);
    expect(route.stops[0].rankingReason).toContain('Hỏa tốc');
  });

  it('does not include or reorder an already picked stop during recalculation', async () => {
    const alreadyPicked = {
      order_id: 1, shop_id: 1, lat: 10, lng: 106.001, address: 'Đã lấy',
      status: 'completed', stopSequence: 1
    };
    const route = await optimizePickup([
      alreadyPicked,
      {
        order_id: 2, shop_id: 2, lat: 10, lng: 106.002, address: 'Đang chờ',
        created_at: '2025-01-01T08:35:00.000Z'
      },
      {
        order_id: 3, shop_id: 3, lat: 10, lng: 106.003, address: 'Đã lấy theo trạng thái',
        created_at: '2025-01-01T08:05:00.000Z',
        order_status: 'picked_up'
      }
    ]);

    expect(route.stops.map((stop) => stop.orderIds[0])).toEqual([2]);
    expect(alreadyPicked.stopSequence).toBe(1);
  });

  it('falls back to Haversine for pickup when OSRM fails', async () => {
    clearRouteMatrixCache();
    const route = await optimizeRoute({
      driverId: 17,
      mode: 'pickup',
      startPoint: { lat: 10, lng: 106 },
      endPoint: { lat: 10, lng: 106 },
      now: new Date('2025-01-01T09:00:00.000Z'),
      pickupSlaMinutes: 0,
      stops: [{
        order_id: 1, shop_id: 1, lat: 10.01, lng: 106.01, address: 'Shop',
        created_at: '2025-01-01T08:55:00.000Z'
      }],
      fetchImpl: vi.fn().mockRejectedValue(new Error('OSRM unavailable'))
    });

    expect(route.isEstimated).toBe(true);
    expect(route.totalDistanceM).toBeGreaterThan(0);
    expect(route.stops[0].rankingReason).toContain('cách');
  });
});
