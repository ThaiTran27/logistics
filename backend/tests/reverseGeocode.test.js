import { describe, expect, it, vi } from 'vitest';
import reverseGeocode from '../services/reverseGeocode.js';

const { reverseGeocodeGovap } = reverseGeocode;

describe('Gò Vấp reverse geocoding', () => {
  it('returns a local road name and ward for a point in service area', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', waypoints: [{ name: 'Nguyễn Văn Bảo' }] })
    });

    await expect(reverseGeocodeGovap(10.8231, 106.6881, {
      fetchImpl,
      routingUrl: 'http://routing.test/'
    })).resolves.toMatchObject({
      address: 'Nguyễn Văn Bảo, Phường An Nhơn, TP. Hồ Chí Minh',
      road_name: 'Nguyễn Văn Bảo',
      ward_name: 'An Nhơn'
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://routing.test/nearest/v1/driving/106.6881,10.8231?number=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('rejects coordinates outside the service boundary without contacting routing', async () => {
    const fetchImpl = vi.fn();
    await expect(reverseGeocodeGovap(10.8, 106.5, { fetchImpl }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns the ward address when the routing data has no road name', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', waypoints: [{ name: '' }] })
    });
    const result = await reverseGeocodeGovap(10.8231, 106.6881, { fetchImpl });
    expect(result.address).toContain(`Phường ${result.ward_name}`);
    expect(result.address).toContain('TP. Hồ Chí Minh');
    expect(result.address).not.toContain('Gò Vấp');
  });
});
