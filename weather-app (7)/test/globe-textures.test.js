import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillGaps, loadCloudTexture, satelliteDates } from '../src/globe-textures.js';

test('satelliteDates lists the latest complete UTC days, newest first', () => {
  assert.deepEqual(satelliteDates(new Date('2026-11-09T20:00:00Z')), ['2026-11-08', '2026-11-07']);
  assert.deepEqual(satelliteDates(new Date('2026-03-01T00:30:00Z')), ['2026-02-28', '2026-02-27']);
});

test('fillGaps replaces no-data pixels with the basemap and keeps real ones', () => {
  const satellite = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 240, 240, 250, 255]) };
  const base = { width: 2, height: 1, data: new Uint8ClampedArray([10, 60, 120, 255, 1, 2, 3, 255]) };

  fillGaps(satellite, base);

  assert.deepEqual([...satellite.data], [10, 60, 120, 255, 240, 240, 250, 255]);
});

test('dark ocean pixels are not mistaken for gaps', () => {
  const satellite = { width: 1, height: 1, data: new Uint8ClampedArray([0, 20, 40, 255]) };
  const base = { width: 1, height: 1, data: new Uint8ClampedArray([200, 200, 200, 255]) };

  assert.deepEqual([...fillGaps(satellite, base).data], [0, 20, 40, 255]);
});

test('loadCloudTexture requires an API key', async () => {
  await assert.rejects(() => loadCloudTexture(''), { type: 'missing-key' });
});
