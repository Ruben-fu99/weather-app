export function locationKey({ lat, lon }) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export function isLocation(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.name === 'string' &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lon)
  );
}

export function locationLabel({ name, state, country }) {
  return [name, state, country].filter(Boolean).join(', ');
}

export function coordinateLabel(lat, lon) {
  const latitude = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  const longitude = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${latitude} ${longitude}`;
}
