import { WeatherError } from './errors.js';
import { clamp, normalizeLon, shortestLonDelta } from './globe-math.js';

const POSITION_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_LATITUDE = 90;

export function parseIss(json) {
  const { latitude, longitude, timestamp, altitude, velocity } = json ?? {};
  if (![latitude, longitude, timestamp].every(Number.isFinite)) {
    return null;
  }
  return {
    lat: latitude,
    lon: longitude,
    time: timestamp * 1000,
    altitude: Number.isFinite(altitude) ? altitude : null,
    velocity: Number.isFinite(velocity) ? velocity : null,
  };
}

export function extrapolate(previous, latest, now, maxMs) {
  if (!previous || latest.time <= previous.time) {
    return { lat: latest.lat, lon: latest.lon };
  }
  const interval = latest.time - previous.time;
  const elapsed = clamp(now - latest.time, 0, maxMs);
  const latStep = (latest.lat - previous.lat) / interval;
  const lonStep = shortestLonDelta(previous.lon, latest.lon) / interval;
  return {
    lat: clamp(latest.lat + latStep * elapsed, -MAX_LATITUDE, MAX_LATITUDE),
    lon: normalizeLon(latest.lon + lonStep * elapsed),
  };
}

export async function fetchIss() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(POSITION_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new WeatherError('iss');
    }
    const position = parseIss(await response.json());
    if (!position) {
      throw new WeatherError('iss');
    }
    return position;
  } catch {
    throw new WeatherError('iss');
  } finally {
    clearTimeout(timer);
  }
}
