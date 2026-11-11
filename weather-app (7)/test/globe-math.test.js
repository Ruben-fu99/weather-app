import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  latLonToScreen,
  projectRaised,
  latToMercatorFraction,
  normalizeLon,
  screenToLatLon,
  shortestLonDelta,
  tileCoordinates,
} from '../src/globe-math.js';

const SIZE = 400;
const view = (centerLat, centerLon) => ({ centerLat, centerLon, radius: 180 });

function assertClose(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test('normalizeLon wraps into [-180, 180)', () => {
  assert.equal(normalizeLon(190), -170);
  assert.equal(normalizeLon(-190), 170);
  assert.equal(normalizeLon(540), -180);
  assert.equal(normalizeLon(0), 0);
});

test('shortestLonDelta takes the short way across the antimeridian', () => {
  assert.equal(shortestLonDelta(170, -170), 20);
  assert.equal(shortestLonDelta(-170, 170), -20);
  assert.equal(shortestLonDelta(10, 40), 30);
});

test('latToMercatorFraction maps the equator to the middle and the poles to the edges', () => {
  assertClose(latToMercatorFraction(0), 0.5);
  assertClose(latToMercatorFraction(85.0511287798), 0, 1e-6);
  assertClose(latToMercatorFraction(-85.0511287798), 1, 1e-6);
  assertClose(latToMercatorFraction(90), 0, 1e-6);
  assert.ok(latToMercatorFraction(30) < latToMercatorFraction(10));
});

test('tileCoordinates lists every tile at a zoom level', () => {
  const tiles = tileCoordinates(2);

  assert.equal(tiles.length, 16);
  assert.deepEqual(tiles[0], { x: 0, y: 0 });
  assert.deepEqual(tiles[15], { x: 3, y: 3 });
});

test('the view center projects to the middle of the canvas', () => {
  const point = latLonToScreen(25, 121, view(25, 121), SIZE);

  assertClose(point.x, SIZE / 2);
  assertClose(point.y, SIZE / 2);
  assert.equal(point.visible, true);
});

test('points on the far side are not visible', () => {
  assert.equal(latLonToScreen(0, 180, view(0, 0), SIZE).visible, false);
  assert.equal(latLonToScreen(0, 89, view(0, 0), SIZE).visible, true);
});

test('north is up and east is right', () => {
  const center = view(0, 0);

  assert.ok(latLonToScreen(30, 0, center, SIZE).y < SIZE / 2);
  assert.ok(latLonToScreen(0, 30, center, SIZE).x > SIZE / 2);
});

test('screenToLatLon returns null outside the sphere', () => {
  assert.equal(screenToLatLon(0, 0, view(0, 0), SIZE), null);
});

test('screenToLatLon inverts latLonToScreen for visible points', () => {
  const tilted = view(35, 100);
  const samples = [
    [25, 121],
    [0, 60],
    [60, 140],
    [-20, 90],
    [35, 100],
  ];

  for (const [lat, lon] of samples) {
    const { x, y, visible } = latLonToScreen(lat, lon, tilted, SIZE);
    assert.equal(visible, true);
    const result = screenToLatLon(x, y, tilted, SIZE);
    assertClose(result.lat, lat, 1e-6);
    assertClose(result.lon, lon, 1e-6);
  }
});

test('projectRaised lifts a point away from the globe center and keeps it visible past the limb', () => {
  const center = view(0, 0);
  const ground = projectRaised(0, 60, 0, center, SIZE);
  const raised = projectRaised(0, 60, 0.1, center, SIZE);

  assert.ok(raised.x > ground.x);
  assert.equal(projectRaised(0, 100, 0, center, SIZE).visible, false);
  assert.equal(projectRaised(0, 100, 0.1, center, SIZE).visible, true);
  assert.equal(projectRaised(0, 150, 0.1, center, SIZE).visible, false);
});
