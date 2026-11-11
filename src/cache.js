import { locationKey } from './location.js';

export function cacheKey(location, units, language) {
  return `${locationKey(location)},${units},${language}`;
}

export function createCache(ttlMs, now = Date.now) {
  const entries = new Map();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return undefined;
      }
      if (now() - entry.storedAt > ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      entries.set(key, { value, storedAt: now() });
    },
  };
}
