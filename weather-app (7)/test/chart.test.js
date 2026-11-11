import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChartPoints } from '../src/chart.js';

const bounds = { width: 400, height: 150, padX: 20, padY: 40 };

test('highest value maps to the top padding and lowest to the bottom', () => {
  const [low, , high] = buildChartPoints([10, 15, 20], bounds);

  assert.equal(low.y, 110);
  assert.equal(high.y, 40);
});

test('points are spread evenly between horizontal paddings', () => {
  const points = buildChartPoints([1, 2, 3], bounds);

  assert.deepEqual(
    points.map(({ x }) => x),
    [20, 200, 380]
  );
});

test('constant values render on the vertical midline', () => {
  const points = buildChartPoints([18, 18, 18], bounds);

  assert.ok(points.every(({ y }) => y === 75));
});

test('a single value does not produce NaN coordinates', () => {
  const [point] = buildChartPoints([18], bounds);

  assert.deepEqual(point, { x: 20, y: 75 });
});
