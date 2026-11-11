'use strict';

const { findGovapWard } = require('../utils/govapArea');

async function reverseGeocodeGovap(lat, lng, {
  fetchImpl = fetch,
  routingUrl = process.env.OSRM_URL || 'http://localhost:5001'
} = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const ward = findGovapWard(latitude, longitude);
  if (!ward) {
    const error = new Error('Tọa độ phải nằm trong 6 phường Gò Vấp.');
    error.statusCode = 400;
    throw error;
  }

  const baseUrl = routingUrl.replace(/\/+$/, '');
  const response = await fetchImpl(
    `${baseUrl}/nearest/v1/driving/${longitude},${latitude}?number=1`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);

  const result = await response.json();
  if (result.code !== 'Ok') throw new Error('Không tìm được tên đường từ dữ liệu bản đồ nội bộ.');

  const roadName = String(result.waypoints?.[0]?.name || '').trim();
  const wardName = String(ward.properties.name || '').trim();
  const address = [
    roadName,
    `Phường ${wardName}`,
    'TP. Hồ Chí Minh'
  ].filter(Boolean).join(', ');

  return { address, road_name: roadName, ward_name: wardName };
}

module.exports = { reverseGeocodeGovap };
