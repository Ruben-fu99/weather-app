import { adviceInputs, buildAdvice } from './advice.js';
import { adviceVisual, createLineIcon, createWeatherIcon, iconKind } from './art.js';
import { buildChartPoints } from './chart.js';
import { EXAMPLE_CITIES } from './cities.js';
import {
  UNIT_LABELS,
  aqiInfo,
  daylightProgress,
  describeError,
  formatClock,
  formatLocalDateTime,
  formatMillimeters,
  formatPercent,
  formatTemp,
  formatVisibility,
  groupDaily,
  precipitationOf,
  rangeBar,
  themeFor,
  weekdayLabel,
} from './format.js';
import { getLanguage, t } from './i18n.js';
import { locationKey, locationLabel } from './location.js';
import { buildScene, isNightIcon } from './scene.js';
import { seasonFor } from './season.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HOURLY_ENTRIES = 8;
const CHART = { width: 400, height: 196, padX: 24, padY: 70, base: 150, iconTop: 20, iconSize: 28 };
const DAYLIGHT = { centerX: 150, baseY: 88, radiusX: 130, radiusY: 74 };
const NIGHT_START_HOUR = 19;
const DAY_START_HOUR = 6;
const PERCENT = 100;
const EMPTY_VALUE = '—';

const byId = (id) => document.getElementById(id);

const els = {
  sky: byId('sky'),
  skyBack: byId('sky-back'),
  skyFront: byId('sky-front'),
  welcome: byId('welcome'),
  examples: byId('examples'),
  input: byId('city-input'),
  searchButton: byId('search-button'),
  locateButton: byId('locate-button'),
  suggestions: byId('suggestions'),
  hint: byId('form-hint'),
  status: byId('status'),
  result: byId('result'),
  offline: byId('offline-note'),
  city: byId('result-city'),
  time: byId('result-time'),
  favoriteToggle: byId('favorite-toggle'),
  icon: byId('result-icon'),
  details: byId('details'),
  humidityMeter: byId('humidity-meter'),
  rainMeter: byId('rain-meter'),
  windArrow: byId('wind-arrow'),
  daylightProgress: byId('daylight-progress'),
  daylightSun: byId('daylight-sun'),
  temp: byId('result-temp'),
  description: byId('result-description'),
  feels: byId('detail-feels'),
  humidity: byId('detail-humidity'),
  wind: byId('detail-wind'),
  pressure: byId('detail-pressure'),
  rainChance: byId('detail-rain-chance'),
  rainAmount: byId('detail-rain-amount'),
  clouds: byId('detail-clouds'),
  cloudsMeter: byId('clouds-meter'),
  visibility: byId('detail-visibility'),
  sunrise: byId('detail-sunrise'),
  sunset: byId('detail-sunset'),
  advice: byId('advice'),
  adviceList: byId('advice-list'),
  hourly: byId('hourly'),
  hourlyChart: byId('hourly-chart'),
  forecast: byId('forecast'),
  forecastList: byId('forecast-list'),
  air: byId('air'),
  airBadge: byId('air-badge'),
  airDetail: byId('air-detail'),
  airScale: byId('air-scale'),
  recent: byId('recent'),
  recentList: byId('recent-list'),
  favorites: byId('favorites'),
  favoritesList: byId('favorites-list'),
  unitButtons: document.querySelectorAll('.unit-toggle button'),
  langButtons: document.querySelectorAll('.lang-toggle button'),
};

const view = { status: null, scene: null };

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createSvgElement(tag, attributes, text) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function weatherIcon(code, size, description = '') {
  return createWeatherIcon(iconKind(code), size, description);
}

function setSkyState(state) {
  els.sky.dataset.state = state;
  els.welcome.hidden = state !== 'welcome';
}

function applyScene(theme, night) {
  document.body.dataset.theme = theme;
  els.sky.dataset.theme = theme;
  els.sky.dataset.night = String(night);

  const season = seasonFor(new Date());
  const key = `${theme}:${night}:${season}`;
  if (view.scene === key) {
    return;
  }
  view.scene = key;
  const { back, front } = buildScene(theme, night, season);
  els.skyBack.innerHTML = back;
  els.skyFront.innerHTML = front;
}

export function renderExamples() {
  const language = getLanguage();
  els.examples.replaceChildren(
    ...EXAMPLE_CITIES.map((city, index) => {
      const item = createElement('li');
      const button = createElement('button', 'example-button', city.name[language]);
      button.type = 'button';
      button.dataset.index = String(index);
      item.append(button);
      return item;
    })
  );
}

export function initVisuals() {
  document.querySelectorAll('[data-icon]').forEach((slot) => {
    slot.append(createLineIcon(slot.dataset.icon, 18));
  });
  byId('brand-mark').append(createWeatherIcon('partly-day', 28));

  const hour = new Date().getHours();
  applyScene('clear-day', hour < DAY_START_HOUR || hour >= NIGHT_START_HOUR);
  renderExamples();
}

function renderStatus() {
  const { status } = view;
  if (!status) {
    els.status.hidden = true;
    return;
  }
  els.status.dataset.state = status.kind;
  els.status.textContent = status.kind === 'loading' ? t('status.loading') : describeError(status.error);
  els.status.hidden = false;
}

export function retranslate() {
  renderStatus();
  renderExamples();
}

export function setBusy(isBusy) {
  els.searchButton.disabled = isBusy;
  els.locateButton.disabled = isBusy;
  els.input.disabled = isBusy;
  if (!isBusy) {
    els.input.focus();
  }
}

export function showHint(message) {
  els.hint.textContent = message;
  els.hint.hidden = !message;
}

function hideResults() {
  [els.result, els.details, els.advice, els.hourly, els.forecast, els.air].forEach((section) => {
    section.hidden = true;
  });
}

export function showLoading() {
  hideResults();
  clearSuggestions();
  setSkyState('loading');
  view.status = { kind: 'loading' };
  renderStatus();
  setBusy(true);
}

export function showWelcome() {
  hideResults();
  setSkyState('welcome');
  view.status = null;
  renderStatus();
  els.searchButton.disabled = false;
  els.locateButton.disabled = false;
  els.input.disabled = false;
}

export function showError(error) {
  hideResults();
  setSkyState('error');
  view.status = { kind: 'error', error };
  renderStatus();
  setBusy(false);
}

export function scrollToResult() {
  els.sky.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function renderUnits(units) {
  els.unitButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.units === units));
  });
}

export function renderLanguage(language) {
  els.langButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.lang === language));
  });
}

export function renderRecent(recent) {
  els.recentList.replaceChildren(
    ...recent.map((location, index) => {
      const item = createElement('li');
      const button = createElement('button', 'chip-button', location.name);
      button.type = 'button';
      button.dataset.index = String(index);
      button.title = locationLabel(location);
      item.append(button);
      return item;
    })
  );
  els.recent.hidden = recent.length === 0;
}

export function renderFavorites(favorites, summaries) {
  els.favoritesList.replaceChildren(
    ...favorites.map((location, index) => {
      const summary = summaries.get(locationKey(location));
      const item = createElement('li', 'favorite');

      const select = createElement('button', 'chip-button favorite-select');
      select.type = 'button';
      select.dataset.action = 'select';
      select.dataset.index = String(index);
      select.title = locationLabel(location);
      if (summary) {
        select.append(weatherIcon(summary.icon, 22));
      }
      select.append(createElement('span', 'favorite-name', location.name));
      if (summary) {
        select.append(createElement('span', 'favorite-temp', summary.temp));
      }

      const remove = createElement('button', 'chip-button favorite-remove', '×');
      remove.type = 'button';
      remove.dataset.action = 'remove';
      remove.dataset.index = String(index);
      remove.setAttribute('aria-label', t('favorites.removeNamed', { name: location.name }));

      item.append(select, remove);
      return item;
    })
  );
  els.favorites.hidden = favorites.length === 0;
}

export function renderFavoriteToggle(isFavorite) {
  els.favoriteToggle.replaceChildren(createLineIcon('star', 16), createElement('span', '', t(isFavorite ? 'favorites.saved' : 'favorites.add')));
  els.favoriteToggle.setAttribute('aria-pressed', String(isFavorite));
}

export function showOffline(age) {
  els.offline.textContent = age ? t('offline.note', { age }) : '';
  els.offline.hidden = !age;
}

export function renderSuggestions(items, activeIndex) {
  if (items.length === 0) {
    clearSuggestions();
    return;
  }

  els.suggestions.replaceChildren(
    ...items.map((location, index) => {
      const option = createElement('li', 'suggestion', locationLabel(location));
      option.id = `suggestion-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === activeIndex));
      option.dataset.index = String(index);
      return option;
    })
  );
  els.suggestions.hidden = false;
  els.input.setAttribute('aria-expanded', 'true');
  if (activeIndex >= 0) {
    els.input.setAttribute('aria-activedescendant', `suggestion-${activeIndex}`);
  } else {
    els.input.removeAttribute('aria-activedescendant');
  }
}

export function clearSuggestions() {
  els.suggestions.replaceChildren();
  els.suggestions.hidden = true;
  els.input.setAttribute('aria-expanded', 'false');
  els.input.removeAttribute('aria-activedescendant');
}

function renderDaylight(current) {
  const { fraction, isDay } = daylightProgress(current.dt, current.sys.sunrise, current.sys.sunset);
  const angle = fraction * Math.PI;
  const x = DAYLIGHT.centerX - DAYLIGHT.radiusX * Math.cos(angle);
  const y = DAYLIGHT.baseY - DAYLIGHT.radiusY * Math.sin(angle);

  els.daylightProgress.style.strokeDasharray = `${fraction * PERCENT} ${PERCENT}`;
  els.daylightSun.setAttribute('cx', x.toFixed(1));
  els.daylightSun.setAttribute('cy', y.toFixed(1));
  els.daylightSun.dataset.day = String(isDay);
}

function renderCurrent(current, forecast, location, units) {
  const labels = UNIT_LABELS[units];
  const [condition] = current.weather;
  const offset = current.timezone;
  const next = forecast?.list?.[0];
  const rainFraction = next ? (next.pop ?? 0) : 0;

  applyScene(themeFor(condition), isNightIcon(condition.icon));
  setSkyState('result');
  els.city.textContent = locationLabel(location);
  els.time.textContent = t('result.observed', { time: formatLocalDateTime(current.dt, offset) });
  els.icon.replaceChildren(weatherIcon(condition.icon, 88, condition.description));
  els.temp.textContent = formatTemp(current.main.temp, units);
  els.description.textContent = condition.description;
  els.feels.textContent = formatTemp(current.main.feels_like, units);
  els.humidity.textContent = `${current.main.humidity}%`;
  els.humidityMeter.style.width = `${current.main.humidity}%`;
  els.wind.textContent = `${current.wind.speed} ${labels.wind}`;
  const hasDirection = Number.isFinite(current.wind.deg);
  els.windArrow.hidden = !hasDirection;
  if (hasDirection) {
    els.windArrow.style.transform = `rotate(${(current.wind.deg + 180) % 360}deg)`;
  }
  els.pressure.textContent = `${current.main.pressure} hPa`;
  els.rainChance.textContent = next ? formatPercent(rainFraction) : EMPTY_VALUE;
  els.rainMeter.style.width = formatPercent(rainFraction);
  els.rainAmount.textContent = next ? formatMillimeters(precipitationOf(next)) : EMPTY_VALUE;
  const cloudCover = current.clouds?.all;
  const hasCloudCover = Number.isFinite(cloudCover);
  els.clouds.textContent = hasCloudCover ? `${cloudCover}%` : EMPTY_VALUE;
  els.cloudsMeter.style.width = hasCloudCover ? `${cloudCover}%` : '0%';
  els.visibility.textContent = formatVisibility(current.visibility, units) ?? EMPTY_VALUE;
  els.sunrise.textContent = formatClock(current.sys.sunrise, offset);
  els.sunset.textContent = formatClock(current.sys.sunset, offset);
  renderDaylight(current);
  els.result.hidden = false;
  els.details.hidden = false;
}

function renderAdvice(bundle, units) {
  const keys = buildAdvice(adviceInputs(bundle, units));
  els.adviceList.replaceChildren(
    ...keys.map((key) => {
      const { icon, tone } = adviceVisual(key);
      const item = createElement('li');
      item.dataset.tone = tone;
      const badge = createElement('span', 'advice-icon');
      badge.append(createLineIcon(icon, 20));
      item.append(badge, createElement('span', 'advice-text', t(`advice.${key}`)));
      return item;
    })
  );
  els.advice.hidden = keys.length === 0;
}

function renderHourly(forecast, units) {
  if (!forecast) {
    els.hourly.hidden = true;
    return;
  }

  const entries = forecast.list.slice(0, HOURLY_ENTRIES);
  const offset = forecast.city.timezone;
  const points = buildChartPoints(
    entries.map((entry) => entry.main.temp),
    CHART
  );
  const path = points.map(({ x, y }) => `${x} ${y}`).join('L');
  const first = points[0];
  const last = points[points.length - 1];

  const area = createSvgElement('path', {
    class: 'chart-area',
    d: `M${first.x} ${CHART.base}L${path}L${last.x} ${CHART.base}Z`,
  });
  const line = createSvgElement('polyline', {
    class: 'chart-line',
    pathLength: '1',
    points: points.map(({ x, y }) => `${x},${y}`).join(' '),
  });
  const marks = entries.flatMap((entry, index) => {
    const { x, y } = points[index];
    const icon = weatherIcon(entry.weather[0].icon, CHART.iconSize);
    icon.setAttribute('class', 'chart-icon');
    icon.setAttribute('x', x - CHART.iconSize / 2);
    icon.setAttribute('y', CHART.iconTop);
    return [
      icon,
      createSvgElement('circle', { class: 'chart-dot', cx: x, cy: y, r: 4 }),
      createSvgElement('text', { class: 'chart-temp', x, y: y - 12 }, formatTemp(entry.main.temp, units)),
      createSvgElement('text', { class: 'chart-time', x, y: CHART.height - 26 }, formatClock(entry.dt, offset)),
      createSvgElement('text', { class: 'chart-pop', x, y: CHART.height - 8 }, formatPercent(entry.pop ?? 0)),
    ];
  });

  els.hourlyChart.replaceChildren(area, line, ...marks);
  els.hourly.hidden = false;
}

function renderForecast(forecast, units) {
  if (!forecast) {
    els.forecast.hidden = true;
    return;
  }

  const days = groupDaily(forecast.list, forecast.city.timezone);
  const weekMin = Math.min(...days.map((day) => day.min));
  const weekMax = Math.max(...days.map((day) => day.max));

  els.forecastList.replaceChildren(
    ...days.map((day, index) => {
      const item = createElement('li', 'forecast-item');
      const text = createElement('div', 'forecast-text');
      const rain = createElement('span', 'forecast-rain', t('forecast.rain', { chance: Math.round(day.pop * PERCENT) }));
      text.append(createElement('span', 'forecast-description', day.description), rain);
      if (day.precipitation > 0) {
        rain.append(createElement('span', 'forecast-amount', formatMillimeters(day.precipitation)));
      }

      const { left, width } = rangeBar(day.min, day.max, weekMin, weekMax);
      const fill = createElement('span', 'range-fill');
      fill.style.left = `${left}%`;
      fill.style.width = `${width}%`;
      const range = createElement('div', 'forecast-range');
      range.append(
        createElement('span', 'range-low', formatTemp(day.min, units)),
        createElement('span', 'range-track'),
        createElement('span', 'range-high', formatTemp(day.max, units))
      );
      range.querySelector('.range-track').append(fill);

      item.append(
        createElement('span', 'forecast-day', index === 0 ? t('forecast.today') : weekdayLabel(day.dayStart)),
        weatherIcon(day.icon, 40, day.description),
        text,
        range
      );
      return item;
    })
  );
  els.forecast.hidden = false;
}

function renderAir(air) {
  const reading = air?.list?.[0];
  const info = reading ? aqiInfo(reading.main.aqi) : null;
  if (!info) {
    els.air.hidden = true;
    return;
  }

  els.airBadge.textContent = info.label;
  els.airBadge.dataset.level = String(info.level);
  [...els.airScale.children].forEach((segment, index) => {
    segment.dataset.active = String(index === info.level - 1);
  });
  els.airDetail.replaceChildren(
    createElement('span', '', `PM2.5 ${reading.components.pm2_5} μg/m³`),
    createElement('span', '', `PM10 ${reading.components.pm10} μg/m³`)
  );
  els.air.hidden = false;
}

export function showResult(bundle, location, units, offlineAge = null) {
  renderCurrent(bundle.current, bundle.forecast, location, units);
  renderAdvice(bundle, units);
  renderHourly(bundle.forecast, units);
  renderForecast(bundle.forecast, units);
  renderAir(bundle.air);
  showOffline(offlineAge);
  view.status = null;
  renderStatus();
  setBusy(false);
}
