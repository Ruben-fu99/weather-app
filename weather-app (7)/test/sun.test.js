import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeLon } from '../src/globe-math.js';
import { subsolarPoint } from '../src/sun.js';

function assertWithin(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test('the sun is overhead near +23.4° at the June solstice and -23.4° in December', () => {
  assertWithin(subsolarPoint(new Date('2026-06-21T12:00:00Z')).lat, 23.4, 0.3);
  assertWithin(subsolarPoint(new Date('2026-12-21T12:00:00Z')).lat, -23.4, 0.3);
});

test('the sun is overhead near the equator at the equinoxes', () => {
  assertWithin(subsolarPoint(new Date('2026-03-20T12:00:00Z')).lat, 0, 0.7);
  assertWithin(subsolarPoint(new Date('2026-09-23T12:00:00Z')).lat, 0, 0.7);
});

test('the subsolar longitude follows UTC time at 15° per hour', () => {
  assertWithin(subsolarPoint(new Date('2026-03-20T12:00:00Z')).lon, 0, 5);
  assertWithin(subsolarPoint(new Date('2026-03-20T18:00:00Z')).lon, -90, 5);
  assertWithin(normalizeLon(subsolarPoint(new Date('2026-03-20T00:00:00Z')).lon - 180), 0, 5);
});

test('the subsolar longitude is always normalized', () => {
  for (let hour = 0; hour < 48; hour += 5) {
    const { lon } = subsolarPoint(new Date(Date.UTC(2026, 5, 1, hour)));
    assert.ok(lon >= -180 && lon < 180, `${lon}`);
  }
});
