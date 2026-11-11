import { WeatherError } from './errors.js';
import { hasChinese, searchChinesePlaces } from './chinese-places.js';
import { apiLanguage, getLanguage } from './i18n.js';

const BASE_URL = 'https://api.openweathermap.org';
const REQUEST_TIMEOUT_MS = 10000;
const GEOLOCATION_TIMEOUT_MS = 10000;
const GEOLOCATION_MAX_AGE_MS = 300000;
const GEOLOCATION_ERROR_TYPES = { 1: 'geo-denied', 2: 'geo-unavailable', 3: 'geo-timeout' };

async function request(path, params) {
  const apiKey = window.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new WeatherError('missing-key');
  }

  const query = new URLSearchParams({ ...params, appid: apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}?${query}`, { signal: controller.signal });
    if (!response.ok) {
      throw new WeatherError('http', response.status);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof WeatherError) {
      throw error;
    }
    throw new WeatherError(error.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

const CHINESE_NAME_KEYS = ['zh_tw', 'zh-tw', 'zh_TW', 'zh'];

function localName(item) {
  if (getLanguage() !== 'zh' || !item.local_names) {
    return item.name;
  }
  const key = CHINESE_NAME_KEYS.find((candidate) => item.local_names[candidate]);
  return key ? item.local_names[key] : item.name;
}

function toLocation(item) {
  return {
    name: localName(item),
    state: item.state ?? null,
    country: item.country ?? null,
    lat: item.lat,
    lon: item.lon,
  };
}

async function geocodeRemote(query, limit) {
  const results = await request('/geo/1.0/direct', { q: query, limit });
  return results.map(toLocation);
}

export async function geocode(query, limit = 5) {
  if (!hasChinese(query)) {
    return geocodeRemote(query, limit);
  }

  const known = searchChinesePlaces(query, limit);
  return known.length > 0 ? known : geocodeRemote(query, limit);
}

export async function geocodeFirst(query) {
  const [first] = await geocode(query, 1);
  if (!first) {
    throw new WeatherError('not-found');
  }
  return first;
}

export function fetchCurrent({ lat, lon }, units) {
  return request('/data/2.5/weather', { lat, lon, units, lang: apiLanguage() });
}

export async function fetchWeatherBundle({ lat, lon }, units) {
  const coordinates = { lat, lon };
  const weatherParams = { ...coordinates, units, lang: apiLanguage() };

  const [current, forecast, air] = await Promise.allSettled([
    request('/data/2.5/weather', weatherParams),
    request('/data/2.5/forecast', weatherParams),
    request('/data/2.5/air_pollution', coordinates),
  ]);

  if (current.status === 'rejected') {
    throw current.reason;
  }

  return {
    current: current.value,
    forecast: forecast.status === 'fulfilled' ? forecast.value : null,
    air: air.status === 'fulfilled' ? air.value : null,
  };
}

export function locateUser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new WeatherError('geo-unsupported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ name: null, state: null, country: null, lat: coords.latitude, lon: coords.longitude }),
      (error) => reject(new WeatherError(GEOLOCATION_ERROR_TYPES[error.code] ?? 'geo-unavailable')),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: GEOLOCATION_MAX_AGE_MS }
    );
  });
}
