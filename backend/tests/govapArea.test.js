import { describe, expect, it } from 'vitest';
import area from '../utils/govapArea.js';

const { findGovapWard, isPointInRing, isWithinGovapServiceArea, wards } = area;

describe('Gò Vấp service boundary', () => {
  it('loads the six supported wards', () => {
    expect(wards).toHaveLength(6);
  });

  it.each(wards.map((ward) => {
    const [minLng, minLat, maxLng, maxLat] = ward.bbox;
    let sample = null;
    const steps = 80;
    for (let latIndex = 1; latIndex < steps && !sample; latIndex += 1) {
      for (let lngIndex = 1; lngIndex < steps && !sample; lngIndex += 1) {
        const lat = minLat + ((maxLat - minLat) * latIndex) / steps;
        const lng = minLng + ((maxLng - minLng) * lngIndex) / steps;
        if (findGovapWard(lat, lng)?.id === ward.id) sample = [lat, lng];
      }
    }
    if (!sample) throw new Error(`Could not locate an interior sample for ${ward.properties.name}.`);
    return [ward.properties.name, ...sample, ward];
  }))('accepts a point inside %s', (name, lat, lng, expectedWard) => {
    expect(findGovapWard(lat, lng)?.properties.code).toBe(expectedWard.properties.code);
    expect(isWithinGovapServiceArea(lat, lng)).toBe(true);
  });

  it('rejects a point outside Gò Vấp', () => {
    expect(isWithinGovapServiceArea(10.8, 106.5)).toBe(false);
  });

  it('includes a point on the ward boundary and distinguishes points just outside it', () => {
    const polygon = wards[0].geometry.type === 'Polygon'
      ? wards[0].geometry.coordinates
      : wards[0].geometry.coordinates[0];
    const ring = polygon[0];
    let boundary;
    let inside;
    let outside;

    for (let index = 1; index < ring.length; index += 1) {
      const first = ring[index - 1];
      const second = ring[index];
      const midpoint = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
      const deltaLongitude = second[0] - first[0];
      const deltaLatitude = second[1] - first[1];
      const magnitude = Math.hypot(deltaLongitude, deltaLatitude);
      if (!magnitude) continue;

      const candidates = [
        [midpoint[0] - (deltaLatitude / magnitude) * 1e-7, midpoint[1] + (deltaLongitude / magnitude) * 1e-7],
        [midpoint[0] + (deltaLatitude / magnitude) * 1e-7, midpoint[1] - (deltaLongitude / magnitude) * 1e-7]
      ];
      const states = candidates.map(([lng, lat]) => isWithinGovapServiceArea(lat, lng));
      if (states[0] !== states[1]) {
        boundary = midpoint;
        [inside, outside] = states[0] ? candidates : [candidates[1], candidates[0]];
        break;
      }
    }

    expect(boundary).toBeDefined();
    expect(isPointInRing(boundary[0], boundary[1], ring)).toBe(true);
    expect(isWithinGovapServiceArea(inside[1], inside[0])).toBe(true);
    expect(isWithinGovapServiceArea(outside[1], outside[0])).toBe(false);
  });
});
