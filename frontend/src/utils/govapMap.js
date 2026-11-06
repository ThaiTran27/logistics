import govapWardsRaw from '../../../shared/govap-wards.geojson?raw';
import L from 'leaflet';

export const GOVAP_WARDS = JSON.parse(govapWardsRaw);
export const GOVAP_MAP_BOUNDS = GOVAP_WARDS.features.reduce((bounds, feature) => {
  const coordinates = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  coordinates.forEach((polygon) => polygon[0].forEach(([lng, lat]) => bounds.extend([lat, lng])));
  return bounds;
}, L.latLngBounds([]));
export const GOVAP_MAP_CENTER = [10.837, 106.669];
export const MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL
  || 'http://localhost:8080/styles/govap/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

const isPointInRing = (longitude, latitude, ring) => {
  let isInside = false;
  for (let currentIndex = 0, previousIndex = ring.length - 1; currentIndex < ring.length; previousIndex = currentIndex++) {
    const [currentLongitude, currentLatitude] = ring[currentIndex];
    const [previousLongitude, previousLatitude] = ring[previousIndex];
    const crossProduct = (longitude - currentLongitude) * (previousLatitude - currentLatitude)
      - (latitude - currentLatitude) * (previousLongitude - currentLongitude);
    if (Math.abs(crossProduct) < 1e-10
      && longitude >= Math.min(currentLongitude, previousLongitude)
      && longitude <= Math.max(currentLongitude, previousLongitude)
      && latitude >= Math.min(currentLatitude, previousLatitude)
      && latitude <= Math.max(currentLatitude, previousLatitude)) return true;
    if ((currentLatitude > latitude) !== (previousLatitude > latitude)
      && longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude))
        / (previousLatitude - currentLatitude) + currentLongitude) {
      isInside = !isInside;
    }
  }
  return isInside;
};

export const findGovapWard = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return GOVAP_WARDS.features.find(({ geometry }) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons.some(([outerRing, ...innerRings]) => (
      isPointInRing(longitude, latitude, outerRing)
      && !innerRings.some((innerRing) => isPointInRing(longitude, latitude, innerRing))
    ));
  }) || null;
};

export const isWithinGovapServiceArea = (lat, lng) => {
  return Boolean(findGovapWard(lat, lng));
};
