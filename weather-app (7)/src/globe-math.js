export const MAX_MERCATOR_LAT = 85.0511287798;
export const MAX_VIEW_LAT = 85;

const DEG = Math.PI / 180;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function shortestLonDelta(from, to) {
  return normalizeLon(to - from);
}

export function latToMercatorFraction(lat) {
  const radians = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT) * DEG;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
}

export function tileCoordinates(zoom) {
  const count = 2 ** zoom;
  const tiles = [];
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

export function projectRaised(lat, lon, altitude, view, size) {
  const lat0 = view.centerLat * DEG;
  const phi = lat * DEG;
  const dLon = (lon - view.centerLon) * DEG;
  const cosC = Math.sin(lat0) * Math.sin(phi) + Math.cos(lat0) * Math.cos(phi) * Math.cos(dLon);
  const scale = 1 + altitude;
  const x = scale * Math.cos(phi) * Math.sin(dLon);
  const y = scale * (Math.cos(lat0) * Math.sin(phi) - Math.sin(lat0) * Math.cos(phi) * Math.cos(dLon));

  return {
    x: size / 2 + view.radius * x,
    y: size / 2 - view.radius * y,
    visible: cosC > 0 || x * x + y * y >= 1,
  };
}

export function latLonToScreen(lat, lon, view, size) {
  return projectRaised(lat, lon, 0, view, size);
}

export function screenToLatLon(px, py, view, size) {
  const x = (px - size / 2) / view.radius;
  const y = (size / 2 - py) / view.radius;
  const rho2 = x * x + y * y;
  if (rho2 > 1) {
    return null;
  }

  const lat0 = view.centerLat * DEG;
  const cosC = Math.sqrt(1 - rho2);
  const lat = Math.asin(clamp(cosC * Math.sin(lat0) + y * Math.cos(lat0), -1, 1));
  const lon = view.centerLon * DEG + Math.atan2(x, Math.cos(lat0) * cosC - y * Math.sin(lat0));

  return { lat: lat / DEG, lon: normalizeLon(lon / DEG) };
}
