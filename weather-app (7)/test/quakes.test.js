import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQuakes } from '../src/quakes.js';

const feature = (lon, lat, mag, place = 'somewhere') => ({
  properties: { mag, place },
  geometry: { coordinates: [lon, lat, 10] },
});

test('parseQuakes maps GeoJSON coordinates to lat/lon and sorts by magnitude', () => {
  const quakes = parseQuakes({
    features: [feature(121.5, 24.1, 3.1, 'Hualien'), feature(-120, 36, 5.4, 'California')],
  });

  assert.deepEqual(quakes, [
    { lat: 36, lon: -120, mag: 5.4, place: 'California', time: null },
    { lat: 24.1, lon: 121.5, mag: 3.1, place: 'Hualien', time: null },
  ]);
});

test('parseQuakes drops malformed features', () => {
  const quakes = parseQuakes({
    features: [
      feature(10, 20, 4),
      { properties: { mag: 3 }, geometry: null },
      { properties: { mag: null }, geometry: { coordinates: [1, 2, 3] } },
      { properties: { mag: 3 }, geometry: { coordinates: ['x', 2, 3] } },
      null,
    ],
  });

  assert.equal(quakes.length, 1);
});

test('parseQuakes returns an empty list for unexpected payloads', () => {
  assert.deepEqual(parseQuakes(null), []);
  assert.deepEqual(parseQuakes({}), []);
  assert.deepEqual(parseQuakes({ features: 'nope' }), []);
});

test('parseQuakes keeps the event time when the feed provides it', () => {
  const [quake] = parseQuakes({
    features: [{ properties: { mag: 4, place: 'x', time: 1762560000000 }, geometry: { coordinates: [1, 2, 3] } }],
  });

  assert.equal(quake.time, 1762560000000);
});
