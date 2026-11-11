import { isLocation, locationKey } from './location.js';

export const MAX_FAVORITES = 8;

const KEYS = {
  recent: 'weather.recent',
  units: 'weather.units',
  depth: 'weather.depth',
  language: 'weather.language',
  favorites: 'weather.favorites',
  offline: 'weather.offline',
};
const MAX_RECENT = 5;
const MAX_OFFLINE = 5;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function loadLocations(key, limit) {
  const stored = read(key, []);
  return Array.isArray(stored) ? stored.filter(isLocation).slice(0, limit) : [];
}

export function loadUnits() {
  return read(KEYS.units, 'metric') === 'imperial' ? 'imperial' : 'metric';
}

export function saveUnits(units) {
  write(KEYS.units, units);
}

export function loadDepth() {
  return read(KEYS.depth, true) !== false;
}

export function saveDepth(enabled) {
  write(KEYS.depth, enabled);
}

export function loadLanguage() {
  const stored = read(KEYS.language, null);
  return stored === 'zh' || stored === 'en' ? stored : null;
}

export function saveLanguage(language) {
  write(KEYS.language, language);
}

export function loadRecent() {
  return loadLocations(KEYS.recent, MAX_RECENT);
}

export function saveRecent(recent) {
  write(KEYS.recent, recent);
}

export function addRecent(recent, location) {
  const key = locationKey(location);
  return [location, ...recent.filter((entry) => locationKey(entry) !== key)].slice(0, MAX_RECENT);
}

export function loadFavorites() {
  return loadLocations(KEYS.favorites, MAX_FAVORITES);
}

export function saveFavorites(favorites) {
  write(KEYS.favorites, favorites);
}

export function isFavorite(favorites, location) {
  const key = locationKey(location);
  return favorites.some((entry) => locationKey(entry) === key);
}

export function toggleFavorite(favorites, location) {
  if (isFavorite(favorites, location)) {
    const key = locationKey(location);
    return { favorites: favorites.filter((entry) => locationKey(entry) !== key), full: false };
  }
  if (favorites.length >= MAX_FAVORITES) {
    return { favorites, full: true };
  }
  return { favorites: [...favorites, location], full: false };
}

export function withOfflineEntry(entries, key, entry, limit = MAX_OFFLINE) {
  const merged = { ...entries, [key]: entry };
  const newest = Object.entries(merged)
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .slice(0, limit);
  return Object.fromEntries(newest);
}

export function loadOffline(key) {
  const entries = read(KEYS.offline, {});
  return entries?.[key] ?? null;
}

export function saveOffline(key, entry) {
  const entries = read(KEYS.offline, {});
  write(KEYS.offline, withOfflineEntry(entries ?? {}, key, entry));
}
