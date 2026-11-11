import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aqiInfo,
  describeError,
  formatAge,
  formatClock,
  formatLocalDateTime,
  formatMillimeters,
  formatPercent,
  formatTemp,
  formatVisibility,
  groupDaily,
  precipitationOf,
  themeFor,
  validateCity,
  weekdayLabel,
} from '../src/format.js';
import { WeatherError } from '../src/errors.js';
import { setLanguage } from '../src/i18n.js';

const HOUR = 3600;
const DAY = 86400;

function entry(dt, { min, max, icon = '01d', description = '晴', pop, rain, snow }) {
  return {
    dt,
    pop,
    rain: rain === undefined ? undefined : { '3h': rain },
    snow: snow === undefined ? undefined : { '3h': snow },
    main: { temp_min: min, temp_max: max },
    weather: [{ icon, description }],
  };
}

test('formatTemp rounds and appends the unit symbol', () => {
  assert.equal(formatTemp(21.6, 'metric'), '22°C');
  assert.equal(formatTemp(-0.4, 'imperial'), '0°F');
  assert.equal(formatTemp(-3.6, 'metric'), '-4°C');
});

test('formatClock applies the timezone offset', () => {
  assert.equal(formatClock(0, 8 * HOUR), '08:00');
  assert.equal(formatClock(23 * HOUR, 2 * HOUR + 30 * 60), '01:30');
});

test('formatLocalDateTime includes month and day in local time', () => {
  assert.equal(formatLocalDateTime(23 * HOUR, 2 * HOUR), '1/2 01:00');
});

test('weekdayLabel returns the Chinese weekday', () => {
  assert.equal(weekdayLabel(0), '週四');
  assert.equal(weekdayLabel(3 * DAY), '週日');
});

test('aqiInfo maps 1-5 to labels and rejects other values', () => {
  assert.deepEqual(aqiInfo(1), { level: 1, label: '良好' });
  assert.deepEqual(aqiInfo(5), { level: 5, label: '非常不佳' });
  assert.equal(aqiInfo(0), null);
  assert.equal(aqiInfo(6), null);
  assert.equal(aqiInfo(undefined), null);
});

test('themeFor picks a theme from the condition id and day/night icon', () => {
  assert.equal(themeFor({ id: 211, icon: '11d' }), 'thunder');
  assert.equal(themeFor({ id: 500, icon: '10d' }), 'rain');
  assert.equal(themeFor({ id: 601, icon: '13d' }), 'snow');
  assert.equal(themeFor({ id: 741, icon: '50d' }), 'mist');
  assert.equal(themeFor({ id: 800, icon: '01d' }), 'clear-day');
  assert.equal(themeFor({ id: 800, icon: '01n' }), 'clear-night');
  assert.equal(themeFor({ id: 803, icon: '04d' }), 'clouds');
});

test('groupDaily merges entries per local day with min/max and a midday icon', () => {
  const entries = [
    entry(0, { min: 10, max: 12, icon: '01n', description: '夜' }),
    entry(12 * HOUR, { min: 18, max: 25, icon: '02d', description: '午' }),
    entry(18 * HOUR, { min: 15, max: 20, icon: '03d', description: '晚' }),
    entry(DAY + 12 * HOUR, { min: 9, max: 14, icon: '10d', description: '雨' }),
  ];

  const days = groupDaily(entries, 0);

  assert.equal(days.length, 2);
  assert.deepEqual(days[0], {
    dayStart: 0,
    min: 10,
    max: 25,
    icon: '02d',
    description: '午',
    pop: 0,
    precipitation: 0,
  });
  assert.deepEqual(days[1], {
    dayStart: DAY,
    min: 9,
    max: 14,
    icon: '10d',
    description: '雨',
    pop: 0,
    precipitation: 0,
  });
});

test('groupDaily splits days by local time and always returns day icons', () => {
  const days = groupDaily([entry(20 * HOUR, { min: 5, max: 6, icon: '01n' })], 8 * HOUR);

  assert.equal(days[0].dayStart, DAY);
  assert.equal(days[0].icon, '01d');
});

test('groupDaily limits the number of days', () => {
  const entries = Array.from({ length: 6 }, (_, index) =>
    entry(index * DAY + 12 * HOUR, { min: 1, max: 2 })
  );

  assert.equal(groupDaily(entries, 0).length, 5);
  assert.equal(groupDaily(entries, 0, 3).length, 3);
});

test('validateCity trims input and rejects empty or oversized values', () => {
  assert.deepEqual(validateCity('  Taipei '), { city: 'Taipei' });
  assert.ok(validateCity('   ').error);
  assert.ok(validateCity('a'.repeat(101)).error);
});

test('describeError maps error types and HTTP statuses to messages', () => {
  assert.match(describeError(new WeatherError('http', 401)), /金鑰/);
  assert.match(describeError(new WeatherError('http', 429)), /次數過多/);
  assert.match(describeError(new WeatherError('http', 503)), /503/);
  assert.match(describeError(new WeatherError('network')), /網路/);
  assert.match(describeError(new WeatherError('geo-denied')), /權限/);
  assert.match(describeError(new WeatherError('not-found')), /找不到/);
  assert.match(describeError(new WeatherError('tiles-base')), /底圖/);
  assert.match(describeError(new Error('boom')), /未預期/);
});

test('groupDaily takes the highest rain chance and sums rain and snow', () => {
  const entries = [
    entry(6 * HOUR, { min: 1, max: 2, pop: 0.2, rain: 1.5 }),
    entry(12 * HOUR, { min: 1, max: 2, pop: 0.7, rain: 0.5, snow: 1 }),
    entry(18 * HOUR, { min: 1, max: 2, pop: 0.3 }),
  ];

  const [day] = groupDaily(entries, 0);

  assert.equal(day.pop, 0.7);
  assert.equal(day.precipitation, 3);
});

test('precipitationOf treats missing rain and snow as zero', () => {
  assert.equal(precipitationOf({}), 0);
  assert.equal(precipitationOf({ rain: { '3h': 2.5 } }), 2.5);
  assert.equal(precipitationOf({ rain: { '3h': 1 }, snow: { '3h': 2 } }), 3);
});

test('formatPercent and formatMillimeters round for display', () => {
  assert.equal(formatPercent(0.456), '46%');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatMillimeters(2.46), '2.5 mm');
  assert.equal(formatMillimeters(0), '0 mm');
});

test('formatAge switches from minutes to hours', () => {
  assert.equal(formatAge(0.2), '1 分鐘');
  assert.equal(formatAge(12), '12 分鐘');
  assert.equal(formatAge(150), '3 小時');
});

test('formatting and messages follow the selected language', () => {
  setLanguage('en');
  try {
    assert.equal(weekdayLabel(0), 'Thu');
    assert.equal(aqiInfo(2).label, 'Fair');
    assert.equal(formatAge(12), '12 min');
    assert.match(describeError(new WeatherError('network')), /connect/);
    assert.match(describeError(new WeatherError('http', 503)), /503/);
    assert.match(validateCity('   ').error, /enter a city/i);
  } finally {
    setLanguage('zh');
  }
});

test('daylightProgress is the share of daytime elapsed, clamped outside it', async () => {
  const { daylightProgress } = await import('../src/format.js');
  assert.deepEqual(daylightProgress(1500, 1000, 2000), { fraction: 0.5, isDay: true });
  assert.deepEqual(daylightProgress(900, 1000, 2000), { fraction: 0, isDay: false });
  assert.deepEqual(daylightProgress(2100, 1000, 2000), { fraction: 1, isDay: false });
});

test('rangeBar places a day within the week range with a minimum width', async () => {
  const { rangeBar } = await import('../src/format.js');
  assert.deepEqual(rangeBar(10, 20, 10, 30), { left: 0, width: 50 });
  assert.deepEqual(rangeBar(20, 30, 10, 30), { left: 50, width: 50 });
  assert.deepEqual(rangeBar(20, 20, 10, 30), { left: 50, width: 8 });
  assert.deepEqual(rangeBar(29, 29, 10, 30), { left: 92, width: 8 });
  assert.deepEqual(rangeBar(15, 15, 15, 15), { left: 0, width: 100 });
});

test('formatVisibility converts meters to kilometers or miles', () => {
  assert.equal(formatVisibility(10000, 'metric'), '10 km');
  assert.equal(formatVisibility(3500, 'metric'), '3.5 km');
  assert.equal(formatVisibility(10000, 'imperial'), '6.2 mi');
  assert.equal(formatVisibility(undefined, 'metric'), null);
});
