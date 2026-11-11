import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extrapolate, parseIss } from '../src/iss.js';

test('parseIss converts the API payload and rejects malformed ones', () => {
  assert.deepEqual(parseIss({ latitude: 10, longitude: 20, timestamp: 1000, altitude: 420.5, velocity: 27600 }), {
    lat: 10,
    lon: 20,
    time: 1000000,
    altitude: 420.5,
    velocity: 27600,
  });
  assert.equal(parseIss({ latitude: 10, longitude: 'x', timestamp: 1 }), null);
  assert.equal(parseIss(null), null);
  assert.equal(parseIss({ latitude: 1, longitude: 2, timestamp: 3 }).altitude, null);
});

test('extrapolate continues the last movement, capped at maxMs', () => {
  const previous = { lat: 0, lon: 10, time: 0 };
  const latest = { lat: 1, lon: 12, time: 1000 };

  assert.deepEqual(extrapolate(previous, latest, 1500, 5000), { lat: 1.5, lon: 13 });
  assert.deepEqual(extrapolate(previous, latest, 99000, 2000), { lat: 3, lon: 16 });
  assert.deepEqual(extrapolate(previous, latest, 500, 5000), { lat: 1, lon: 12 });
});

test('extrapolate crosses the antimeridian and falls back without history', () => {
  const previous = { lat: 0, lon: 179, time: 0 };
  const latest = { lat: 0, lon: -179, time: 1000 };

  assert.equal(extrapolate(previous, latest, 2000, 5000).lon, -177);
  assert.deepEqual(extrapolate(null, latest, 5000, 5000), { lat: 0, lon: -179 });
});
