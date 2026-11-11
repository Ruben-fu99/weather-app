import { fetchCurrent, fetchWeatherBundle, geocode, geocodeFirst, locateUser } from './api.js';
import { cacheKey, createCache } from './cache.js';
import { EXAMPLE_CITIES, GLOBAL_CITIES } from './cities.js';
import { initDepth } from './depth.js';
import { WeatherError } from './errors.js';
import { formatAge, formatTemp, validateCity } from './format.js';
import { initGlobe } from './globe.js';
import { detectLanguage, getLanguage, setLanguage, t, translatePage } from './i18n.js';
import { coordinateLabel, locationKey, locationLabel } from './location.js';
import {
  MAX_FAVORITES,
  addRecent,
  isFavorite,
  loadFavorites,
  loadLanguage,
  loadOffline,
  loadRecent,
  loadDepth,
  loadUnits,
  saveDepth,
  saveFavorites,
  saveLanguage,
  saveOffline,
  saveRecent,
  saveUnits,
  toggleFavorite,
} from './storage.js';
import * as ui from './ui.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const SUGGESTION_DELAY_MS = 300;
const MIN_SUGGESTION_LENGTH = 2;
const MS_PER_MINUTE = 60000;

setLanguage(loadLanguage() ?? detectLanguage(navigator.language));

const form = document.getElementById('search-form');
const input = document.getElementById('city-input');
const locateButton = document.getElementById('locate-button');
const suggestionList = document.getElementById('suggestions');
const recentList = document.getElementById('recent-list');
const examplesList = document.getElementById('examples');
const favoritesList = document.getElementById('favorites-list');
const favoriteToggle = document.getElementById('favorite-toggle');
const depthButton = document.getElementById('depth-toggle');
const unitButtons = document.querySelectorAll('.unit-toggle button');
const languageButtons = document.querySelectorAll('.lang-toggle button');

const bundleCache = createCache(CACHE_TTL_MS);
const currentCache = createCache(CACHE_TTL_MS);
const state = {
  units: loadUnits(),
  depth: loadDepth(),
  recent: loadRecent(),
  favorites: loadFavorites(),
  favoriteSummaries: new Map(),
  favoritesToken: 0,
  location: null,
  requestId: 0,
  suggestionRequestId: 0,
  suggestions: [],
  activeSuggestion: -1,
};

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

async function loadBundle(location) {
  const key = cacheKey(location, state.units, getLanguage());
  const cached = bundleCache.get(key);
  if (cached) {
    return cached;
  }

  const bundle = await fetchWeatherBundle(location, state.units);
  currentCache.set(key, bundle.current);
  if (bundle.forecast && bundle.air) {
    bundleCache.set(key, bundle);
  }
  return bundle;
}

async function loadCurrent(location) {
  const key = cacheKey(location, state.units, getLanguage());
  const cached = currentCache.get(key);
  if (cached) {
    return cached;
  }

  const current = await fetchCurrent(location, state.units);
  currentCache.set(key, current);
  return current;
}

async function loadCityTemps() {
  const language = getLanguage();
  const outcomes = await Promise.allSettled(
    GLOBAL_CITIES.map(async (city) => {
      const current = await loadCurrent(city);
      return {
        lat: city.lat,
        lon: city.lon,
        label: `${city.name[language]} ${formatTemp(current.main.temp, state.units)}`,
      };
    })
  );

  const entries = outcomes.filter(({ status }) => status === 'fulfilled').map(({ value }) => value);
  if (entries.length === 0) {
    throw new WeatherError('cities');
  }
  return entries;
}

function resolveLocation(location, current) {
  return {
    ...location,
    name: location.name ?? (current.name || coordinateLabel(location.lat, location.lon)),
    country: location.country ?? current.sys.country ?? null,
  };
}

function findKnownLocation(name) {
  if (!name) {
    return null;
  }
  const wanted = name.trim().toLowerCase();
  return (
    [...state.recent, ...state.favorites].find(
      (location) =>
        location.name.toLowerCase() === wanted || locationLabel(location).toLowerCase() === wanted
    ) ?? null
  );
}

function showLocation(bundle, location, offlineAge) {
  state.location = location;
  ui.showResult(bundle, location, state.units, offlineAge);
  ui.renderFavoriteToggle(isFavorite(state.favorites, location));
  globe.setCurrent(location);
  globe.setOthers(state.recent);
}

function showOfflineFallback(error, requested, fallbackName) {
  if (error.type !== 'network' && error.type !== 'timeout') {
    return false;
  }

  const location = requested ?? findKnownLocation(fallbackName);
  const saved = location && loadOffline(cacheKey(location, state.units, getLanguage()));
  if (!saved) {
    return false;
  }

  const minutes = (Date.now() - saved.savedAt) / MS_PER_MINUTE;
  showLocation(saved.bundle, resolveLocation(location, saved.bundle.current), formatAge(minutes));
  return true;
}

async function run(getLocation, fallbackName = null, startup = false) {
  const requestId = ++state.requestId;
  if (!startup) {
    ui.showLoading();
  }
  let requested = null;

  try {
    requested = await getLocation();
    if (startup && requestId === state.requestId) {
      ui.showLoading();
    }
    const bundle = await loadBundle(requested);
    if (requestId !== state.requestId) {
      return;
    }

    const location = resolveLocation(requested, bundle.current);
    state.recent = addRecent(state.recent, location);
    saveRecent(state.recent);
    ui.renderRecent(state.recent);
    saveOffline(cacheKey(location, state.units, getLanguage()), { savedAt: Date.now(), bundle });
    showLocation(bundle, location, null);
  } catch (error) {
    if (requestId !== state.requestId) {
      return;
    }
    if (startup && error.type?.startsWith('geo-')) {
      ui.showWelcome();
    } else if (!showOfflineFallback(error, requested, fallbackName)) {
      ui.showError(error);
    }
  }
}

async function isLocationBlocked() {
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state === 'denied';
  } catch {
    return false;
  }
}

async function locateOnStart() {
  if (navigator.geolocation && !(await isLocationBlocked())) {
    run(locateUser, null, true);
  }
}

async function refreshFavorites() {
  const token = ++state.favoritesToken;
  state.favoriteSummaries = new Map();
  ui.renderFavorites(state.favorites, state.favoriteSummaries);

  const entries = await Promise.all(
    state.favorites.map(async (favorite) => {
      try {
        const current = await loadCurrent(favorite);
        return [
          locationKey(favorite),
          { temp: formatTemp(current.main.temp, state.units), icon: current.weather[0].icon },
        ];
      } catch {
        return null;
      }
    })
  );

  if (token === state.favoritesToken) {
    state.favoriteSummaries = new Map(entries.filter(Boolean));
    ui.renderFavorites(state.favorites, state.favoriteSummaries);
  }
}

function renderCollections() {
  ui.renderRecent(state.recent);
  ui.renderFavorites(state.favorites, state.favoriteSummaries);
  if (state.location) {
    ui.renderFavoriteToggle(isFavorite(state.favorites, state.location));
  }
}

function resetSuggestions() {
  state.suggestionRequestId += 1;
  state.suggestions = [];
  state.activeSuggestion = -1;
  ui.clearSuggestions();
}

function chooseSuggestion(index) {
  const location = state.suggestions[index];
  resetSuggestions();
  input.value = locationLabel(location);
  run(() => location);
}

const requestSuggestions = debounce(async (text) => {
  const requestId = ++state.suggestionRequestId;
  try {
    const items = await geocode(text);
    if (requestId !== state.suggestionRequestId) {
      return;
    }
    state.suggestions = items;
    state.activeSuggestion = -1;
    ui.renderSuggestions(items, -1);
  } catch {
    if (requestId === state.suggestionRequestId) {
      resetSuggestions();
    }
  }
}, SUGGESTION_DELAY_MS);

function moveActiveSuggestion(step) {
  const count = state.suggestions.length;
  if (count === 0) {
    return;
  }
  const slots = count + 1;
  state.activeSuggestion = ((state.activeSuggestion + 1 + step + slots) % slots) - 1;
  ui.renderSuggestions(state.suggestions, state.activeSuggestion);
}

function changeLanguage(language) {
  if (language === getLanguage()) {
    return;
  }
  setLanguage(language);
  saveLanguage(language);
  translatePage();
  ui.renderLanguage(language);
  ui.retranslate();
  renderCollections();
  globe.translate();
  globe.refreshCityTemps();
  if (state.location) {
    run(() => state.location);
  }
}

function changeUnits(units) {
  if (units === state.units) {
    return;
  }
  state.units = units;
  saveUnits(units);
  ui.renderUnits(units);
  refreshFavorites();
  globe.refreshCityTemps();
  if (state.location) {
    run(() => state.location);
  }
}

function renderDepthToggle() {
  depthButton.setAttribute('aria-pressed', String(state.depth));
}

function changeDepth() {
  state.depth = !state.depth;
  saveDepth(state.depth);
  depth.setEnabled(state.depth);
  globe.setDepth(state.depth);
  renderDepthToggle();
}

const globe = initGlobe({
  onPick: (lat, lon) => {
    input.value = '';
    run(() => ({ name: null, state: null, country: null, lat, lon })).then(ui.scrollToResult);
  },
  onSelect: (location) => {
    input.value = locationLabel(location);
    run(() => location).then(ui.scrollToResult);
  },
  loadCityTemps,
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (state.activeSuggestion >= 0) {
    chooseSuggestion(state.activeSuggestion);
    return;
  }

  const { city, error } = validateCity(input.value);
  ui.showHint(error ?? '');
  if (city) {
    resetSuggestions();
    run(() => geocodeFirst(city), city);
  }
});

input.addEventListener('input', () => {
  ui.showHint('');
  const text = input.value.trim();
  if (text.length < MIN_SUGGESTION_LENGTH) {
    resetSuggestions();
    return;
  }
  requestSuggestions(text);
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveActiveSuggestion(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveActiveSuggestion(-1);
  } else if (event.key === 'Escape') {
    resetSuggestions();
  }
});

suggestionList.addEventListener('click', (event) => {
  const option = event.target.closest('[data-index]');
  if (option) {
    chooseSuggestion(Number(option.dataset.index));
  }
});

document.addEventListener('click', (event) => {
  if (!form.contains(event.target)) {
    resetSuggestions();
  }
});

locateButton.addEventListener('click', () => {
  ui.showHint('');
  input.value = '';
  resetSuggestions();
  run(locateUser);
});

recentList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-index]');
  if (!button) {
    return;
  }
  const location = state.recent[Number(button.dataset.index)];
  ui.showHint('');
  input.value = locationLabel(location);
  run(() => location);
});

examplesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-index]');
  if (!button) {
    return;
  }
  const city = EXAMPLE_CITIES[Number(button.dataset.index)];
  const location = { name: city.name[getLanguage()], state: null, country: null, lat: city.lat, lon: city.lon };
  ui.showHint('');
  input.value = location.name;
  run(() => location);
});

favoritesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  if (button.dataset.action === 'remove') {
    state.favorites = state.favorites.filter((_, position) => position !== index);
    saveFavorites(state.favorites);
    refreshFavorites();
    if (state.location) {
      ui.renderFavoriteToggle(isFavorite(state.favorites, state.location));
    }
    return;
  }

  const favorite = state.favorites[index];
  ui.showHint('');
  input.value = locationLabel(favorite);
  run(() => favorite);
});

favoriteToggle.addEventListener('click', () => {
  if (!state.location) {
    return;
  }

  const { favorites, full } = toggleFavorite(state.favorites, state.location);
  if (full) {
    ui.showHint(t('favorites.full', { max: MAX_FAVORITES }));
    return;
  }
  state.favorites = favorites;
  saveFavorites(favorites);
  ui.renderFavoriteToggle(isFavorite(favorites, state.location));
  refreshFavorites();
});

depthButton.addEventListener('click', changeDepth);

unitButtons.forEach((button) => {
  button.addEventListener('click', () => changeUnits(button.dataset.units));
});

languageButtons.forEach((button) => {
  button.addEventListener('click', () => changeLanguage(button.dataset.lang));
});

translatePage();
ui.initVisuals();
const depth = initDepth(document.getElementById('sky'), document.querySelector('.layout'), state.depth);
globe.setDepth(state.depth);
renderDepthToggle();
ui.renderLanguage(getLanguage());
ui.renderUnits(state.units);
ui.renderRecent(state.recent);
globe.setOthers(state.recent);
refreshFavorites();
locateOnStart();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => undefined);
}
