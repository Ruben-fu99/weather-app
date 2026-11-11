import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seasonFor } from '../src/season.js';

test('festival windows are detected by local date', () => {
  assert.equal(seasonFor(new Date(2026, 11, 24)), 'christmas');
  assert.equal(seasonFor(new Date(2026, 11, 27)), null);
  assert.equal(seasonFor(new Date(2026, 9, 31)), 'halloween');
  assert.equal(seasonFor(new Date(2026, 9, 23)), null);
  assert.equal(seasonFor(new Date(2027, 1, 6)), 'newyear');
  assert.equal(seasonFor(new Date(2027, 1, 16)), 'newyear');
  assert.equal(seasonFor(new Date(2027, 1, 17)), null);
  assert.equal(seasonFor(new Date(2026, 8, 25)), 'midautumn');
  assert.equal(seasonFor(new Date(2026, 8, 28)), null);
});

test('an ordinary day has no season', () => {
  assert.equal(seasonFor(new Date(2026, 10, 9)), null);
});
