import { WeatherError } from './errors.js';

const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const REQUEST_TIMEOUT_MS = 10000;

export function parseQuakes(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];

  return features
    .map((feature) => {
      const [lon, lat] = feature?.geometry?.coordinates ?? [];
      const time = feature?.properties?.time;
      return { lat, lon, mag: feature?.properties?.mag, place: feature?.properties?.place ?? '', time: Number.isFinite(time) ? time : null };
    })
    .filter(({ lat, lon, mag }) => Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(mag))
    .sort((a, b) => b.mag - a.mag);
}

export async function fetchQuakes() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FEED_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new WeatherError('quakes');
    }
    return parseQuakes(await response.json());
  } catch {
    throw new WeatherError('quakes');
  } finally {
    clearTimeout(timer);
  }
}
