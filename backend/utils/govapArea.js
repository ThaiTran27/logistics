const fs = require('node:fs');
const path = require('node:path');

const wardsFile = path.join(__dirname, '..', '..', 'shared', 'govap-wards.geojson');
const wards = JSON.parse(fs.readFileSync(wardsFile, 'utf8')).features;

function isPointOnSegment(longitude, latitude, [firstLongitude, firstLatitude], [secondLongitude, secondLatitude]) {
  const cross = (longitude - firstLongitude) * (secondLatitude - firstLatitude)
    - (latitude - firstLatitude) * (secondLongitude - firstLongitude);
  const tolerance = 1e-10;
  return Math.abs(cross) <= tolerance
    && longitude >= Math.min(firstLongitude, secondLongitude) - tolerance
    && longitude <= Math.max(firstLongitude, secondLongitude) + tolerance
    && latitude >= Math.min(firstLatitude, secondLatitude) - tolerance
    && latitude <= Math.max(firstLatitude, secondLatitude) + tolerance;
}

function isPointInRing(longitude, latitude, ring) {
  let isInside = false;
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
    const current = ring[index];
    const previous = ring[previousIndex];
    if (isPointOnSegment(longitude, latitude, current, previous)) return true;

    if ((current[1] > latitude) !== (previous[1] > latitude)
      && longitude < ((previous[0] - current[0]) * (latitude - current[1]))
        / (previous[1] - current[1]) + current[0]) {
      isInside = !isInside;
    }
  }
  return isInside;
}

function isPointInGeometry(longitude, latitude, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(([outerRing, ...innerRings]) => (
    isPointInRing(longitude, latitude, outerRing)
    && !innerRings.some((innerRing) => isPointInRing(longitude, latitude, innerRing))
  ));
}

function findGovapWard(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return wards.find((ward) => isPointInGeometry(longitude, latitude, ward.geometry)) || null;
}

function isWithinGovapServiceArea(lat, lng) {
  return findGovapWard(lat, lng) !== null;
}

module.exports = { findGovapWard, isPointInGeometry, isPointInRing, isWithinGovapServiceArea, wards };
