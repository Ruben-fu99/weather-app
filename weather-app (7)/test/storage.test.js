import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinateLabel, isLocation, locationLabel } from '../src/location.js';
import {
  MAX_FAVORITES,
  addRecent,
  isFavorite,
  loadDepth,
  toggleFavorite,
  withOfflineEntry,
} from '../src/storage.js';

const place = (name, lat, lon) => ({ name, state: null, country: 'TW', lat, lon });

test('addRecent puts the newest location first', () => {
  const recent = addRecent([place('Taipei', 25.03, 121.56)], place('Tokyo', 35.68, 139.69));

  assert.deepEqual(
    recent.map(({ name }) => name),
    ['Tokyo', 'Taipei']
  );
});

test('addRecent moves a repeated location to the front without duplicating it', () => {
  const start = [place('Tokyo', 35.68, 139.69), place('Taipei', 25.03, 121.56)];
  const recent = addRecent(start, place('Taipei', 25.0301, 121.5602));

  assert.deepEqual(
    recent.map(({ name }) => name),
    ['Taipei', 'Tokyo']
  );
});

test('addRecent keeps at most five entries', () => {
  let recent = [];
  for (let index = 0; index < 8; index += 1) {
    recent = addRecent(recent, place(`City ${index}`, index, index));
  }

  assert.equal(recent.length, 5);
  assert.equal(recent[0].name, 'City 7');
});

test('isLocation rejects malformed stored values', () => {
  assert.equal(isLocation(place('Taipei', 25.03, 121.56)), true);
  assert.equal(isLocation('Taipei'), false);
  assert.equal(isLocation(null), false);
  assert.equal(isLocation({ name: 'Taipei' }), false);
});

test('locationLabel skips missing parts', () => {
  assert.equal(locationLabel({ name: 'Taipei', state: null, country: 'TW' }), 'Taipei, TW');
  assert.equal(locationLabel({ name: 'Austin', state: 'Texas', country: 'US' }), 'Austin, Texas, US');
});

test('coordinateLabel formats hemispheres', () => {
  assert.equal(coordinateLabel(25.05, 121.53), '25.1°N 121.5°E');
  assert.equal(coordinateLabel(-33.87, -70.66), '33.9°S 70.7°W');
});

test('toggleFavorite adds a location and removes it on the second toggle', () => {
  const taipei = place('Taipei', 25.03, 121.56);

  const added = toggleFavorite([], taipei);
  assert.deepEqual(added.favorites, [taipei]);
  assert.equal(isFavorite(added.favorites, place('Taipei', 25.0301, 121.5602)), true);

  const removed = toggleFavorite(added.favorites, taipei);
  assert.deepEqual(removed.favorites, []);
  assert.equal(removed.full, false);
});

test('toggleFavorite refuses to exceed the limit', () => {
  const full = Array.from({ length: MAX_FAVORITES }, (_, index) => place(`City ${index}`, index, index));

  const result = toggleFavorite(full, place('Extra', 50, 50));

  assert.equal(result.full, true);
  assert.equal(result.favorites, full);
});

test('withOfflineEntry keeps only the most recently saved entries', () => {
  let entries = {};
  for (let index = 1; index <= 4; index += 1) {
    entries = withOfflineEntry(entries, `k${index}`, { savedAt: index }, 3);
  }

  assert.deepEqual(Object.keys(entries).sort(), ['k2', 'k3', 'k4']);
});

test('withOfflineEntry replaces an existing key without growing', () => {
  const entries = withOfflineEntry({ a: { savedAt: 1 } }, 'a', { savedAt: 5 }, 3);

  assert.deepEqual(entries, { a: { savedAt: 5 } });
});

test('3D effects default to on when storage is unavailable', () => {
  assert.equal(loadDepth(), true);
});
