import { t } from './i18n.js';

export const UNIT_LABELS = {
  metric: { temp: '°C', wind: 'm/s' },
  imperial: { temp: '°F', wind: 'mph' },
};

export const MAX_CITY_LENGTH = 100;

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const MINUTES_PER_HOUR = 60;
const NOON_HOUR = 12;
const METERS_PER_KILOMETER = 1000;
const METERS_PER_MILE = 1609.344;
const MIN_RANGE_WIDTH = 8;
const KNOWN_HTTP_STATUSES = new Set([401, 404, 429]);
const KNOWN_ERROR_TYPES = new Set([
  'missing-key',
  'not-found',
  'timeout',
  'network',
  'geo-unsupported',
  'geo-denied',
  'geo-unavailable',
  'geo-timeout',
  'tiles-base',
  'tiles-satellite',
  'tiles-clouds',
  'quakes',
  'iss',
  'cities',
]);

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatTemp(value, units) {
  return `${Math.round(value)}${UNIT_LABELS[units].temp}`;
}

export function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

export function formatMillimeters(value) {
  return `${Math.round(value * 10) / 10} mm`;
}

export function formatVisibility(meters, units) {
  if (!Number.isFinite(meters)) {
    return null;
  }
  if (units === 'imperial') {
    return `${Math.round((meters / METERS_PER_MILE) * 10) / 10} mi`;
  }
  return `${Math.round((meters / METERS_PER_KILOMETER) * 10) / 10} km`;
}

export function formatAge(minutes) {
  if (minutes < MINUTES_PER_HOUR) {
    return t('age.minutes', { n: Math.max(1, Math.round(minutes)) });
  }
  return t('age.hours', { n: Math.round(minutes / MINUTES_PER_HOUR) });
}

export function formatClock(timestamp, offsetSeconds) {
  const date = new Date((timestamp + offsetSeconds) * 1000);
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

export function formatLocalDateTime(timestamp, offsetSeconds) {
  const date = new Date((timestamp + offsetSeconds) * 1000);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()} ${formatClock(timestamp, offsetSeconds)}`;
}

export function weekdayLabel(localSeconds) {
  return t(`weekday.${new Date(localSeconds * 1000).getUTCDay()}`);
}

export function aqiInfo(aqi) {
  if (!Number.isInteger(aqi) || aqi < 1 || aqi > 5) {
    return null;
  }
  return { level: aqi, label: t(`air.l${aqi}`) };
}

export function themeFor({ id, icon }) {
  if (id >= 200 && id < 300) {
    return 'thunder';
  }
  if (id >= 300 && id < 600) {
    return 'rain';
  }
  if (id >= 600 && id < 700) {
    return 'snow';
  }
  if (id >= 700 && id < 800) {
    return 'mist';
  }
  if (id === 800) {
    return icon.endsWith('n') ? 'clear-night' : 'clear-day';
  }
  return 'clouds';
}

export function precipitationOf(entry) {
  return (entry.rain?.['3h'] ?? 0) + (entry.snow?.['3h'] ?? 0);
}

export function groupDaily(entries, offsetSeconds, maxDays = 5) {
  const days = new Map();

  for (const entry of entries) {
    const local = entry.dt + offsetSeconds;
    const dayIndex = Math.floor(local / SECONDS_PER_DAY);
    const hour = (local % SECONDS_PER_DAY) / SECONDS_PER_HOUR;
    const distance = Math.abs(hour - NOON_HOUR);
    const [condition] = entry.weather;
    const pop = entry.pop ?? 0;
    const day = days.get(dayIndex);

    if (!day) {
      days.set(dayIndex, {
        dayStart: dayIndex * SECONDS_PER_DAY,
        min: entry.main.temp_min,
        max: entry.main.temp_max,
        icon: condition.icon,
        description: condition.description,
        pop,
        precipitation: precipitationOf(entry),
        distance,
      });
      continue;
    }

    day.min = Math.min(day.min, entry.main.temp_min);
    day.max = Math.max(day.max, entry.main.temp_max);
    day.pop = Math.max(day.pop, pop);
    day.precipitation += precipitationOf(entry);
    if (distance < day.distance) {
      day.icon = condition.icon;
      day.description = condition.description;
      day.distance = distance;
    }
  }

  return [...days.values()].slice(0, maxDays).map((day) => ({
    dayStart: day.dayStart,
    min: day.min,
    max: day.max,
    icon: `${day.icon.slice(0, 2)}d`,
    description: day.description,
    pop: day.pop,
    precipitation: day.precipitation,
  }));
}

export function validateCity(rawValue) {
  const city = rawValue.trim();
  if (!city) {
    return { error: t('hint.empty') };
  }
  if (city.length > MAX_CITY_LENGTH) {
    return { error: t('hint.tooLong', { max: MAX_CITY_LENGTH }) };
  }
  return { city };
}

export function describeError(error) {
  if (error.type === 'http') {
    return KNOWN_HTTP_STATUSES.has(error.status)
      ? t(`error.http.${error.status}`)
      : t('error.httpOther', { status: error.status });
  }
  return KNOWN_ERROR_TYPES.has(error.type) ? t(`error.${error.type}`) : t('error.unknown');
}

export function daylightProgress(now, sunrise, sunset) {
  if (now < sunrise) {
    return { fraction: 0, isDay: false };
  }
  if (now > sunset) {
    return { fraction: 1, isDay: false };
  }
  return { fraction: (now - sunrise) / (sunset - sunrise), isDay: true };
}

export function rangeBar(min, max, weekMin, weekMax) {
  const span = weekMax - weekMin;
  if (span <= 0) {
    return { left: 0, width: 100 };
  }
  const width = Math.min(100, Math.max(MIN_RANGE_WIDTH, ((max - min) / span) * 100));
  const left = Math.min(((min - weekMin) / span) * 100, 100 - width);
  return { left: Math.round(left * 10) / 10, width: Math.round(width * 10) / 10 };
}
