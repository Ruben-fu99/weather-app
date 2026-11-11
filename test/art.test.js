import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LINE_ICONS, WEATHER_KINDS, adviceVisual, iconKind, lineIconSvg, weatherIconSvg } from '../src/art.js';

test('iconKind maps OpenWeather codes to illustration kinds', () => {
  assert.equal(iconKind('01d'), 'clear-day');
  assert.equal(iconKind('01n'), 'clear-night');
  assert.equal(iconKind('02d'), 'partly-day');
  assert.equal(iconKind('02n'), 'partly-night');
  assert.equal(iconKind('03d'), 'clouds');
  assert.equal(iconKind('04n'), 'clouds');
  assert.equal(iconKind('09d'), 'rain');
  assert.equal(iconKind('10n'), 'rain');
  assert.equal(iconKind('11d'), 'thunder');
  assert.equal(iconKind('13d'), 'snow');
  assert.equal(iconKind('50n'), 'mist');
  assert.equal(iconKind('??'), 'clouds');
});

test('every illustration is a self-contained svg without ids or references', () => {
  for (const kind of WEATHER_KINDS) {
    const svg = weatherIconSvg(kind);
    assert.ok(svg.startsWith('<svg'), kind);
    assert.ok(svg.endsWith('</svg>'), kind);
    assert.ok(!svg.includes('id='), kind);
    assert.ok(!svg.includes('url(#'), kind);
  }
});

test('every line icon renders with stroke styling and a path', () => {
  for (const name of LINE_ICONS) {
    const svg = lineIconSvg(name);
    assert.ok(svg.includes('currentColor'), name);
    assert.ok(/<path d="[^"]+"\/>/.test(svg), name);
  }
});

test('advice keys map to existing icons and a tone', () => {
  const keys = ['coat.freezing', 'coat.cold', 'coat.cool', 'coat.mild', 'coat.warm', 'coat.hot', 'umbrella', 'snow', 'wind', 'muggy', 'air', 'exercise.good', 'exercise.indoor'];
  for (const key of keys) {
    const { icon, tone } = adviceVisual(key);
    assert.ok(LINE_ICONS.includes(icon), key);
    assert.ok(tone, key);
  }
});
