import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cacheKey, createCache } from '../src/cache.js';

test('cache returns stored values within the ttl', () => {
  let time = 1000;
  const cache = createCache(500, () => time);

  cache.set('a', { value: 1 });
  time += 500;

  assert.deepEqual(cache.get('a'), { value: 1 });
});

test('cache drops values after the ttl', () => {
  let time = 1000;
  const cache = createCache(500, () => time);

  cache.set('a', 1);
  time += 501;

  assert.equal(cache.get('a'), undefined);
});

test('cache misses return undefined', () => {
  assert.equal(createCache(500).get('missing'), undefined);
});

test('cacheKey separates units and languages and rounds nearby coordinates together', () => {
  const taipei = { lat: 25.0330001, lon: 121.5654 };
  const nearby = { lat: 25.0332, lon: 121.5651 };

  assert.equal(cacheKey(taipei, 'metric', 'zh'), cacheKey(nearby, 'metric', 'zh'));
  assert.notEqual(cacheKey(taipei, 'metric', 'zh'), cacheKey(taipei, 'imperial', 'zh'));
  assert.notEqual(cacheKey(taipei, 'metric', 'zh'), cacheKey(taipei, 'metric', 'en'));
});
