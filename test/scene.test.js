import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildScene, isNightIcon } from '../src/scene.js';

const count = (text, pattern) => text.split(pattern).length - 1;

test('the scene is deterministic', () => {
  assert.deepEqual(buildScene('rain', false), buildScene('rain', false));
});

test('rain and thunder draw drops, snow draws flakes, only thunder flashes', () => {
  assert.ok(count(buildScene('rain', false).back, 'rain-drop') > 20);
  assert.ok(count(buildScene('thunder', false).back, 'rain-drop') > 20);
  assert.ok(buildScene('thunder', false).back.includes('class="bolt"'));
  assert.ok(!buildScene('rain', false).back.includes('class="bolt"'));
  assert.ok(count(buildScene('snow', false).back, 'snow-flake') > 20);
  assert.ok(!buildScene('clear-day', false).back.includes('rain-drop'));
});

test('stars and moon only appear on clear nights, the sun only by day', () => {
  const night = buildScene('clear-night', true).back;
  assert.ok(night.includes('class="star"'));
  assert.ok(night.includes('class="moon"'));
  assert.ok(!night.includes('class="sun"'));

  const day = buildScene('clear-day', false).back;
  assert.ok(day.includes('class="sun"'));
  assert.ok(!day.includes('class="star"'));
  assert.ok(!buildScene('rain', true).back.includes('class="moon"'));
});

test('mist draws fog bands', () => {
  assert.equal(count(buildScene('mist', false).back, 'class="fog"'), 3);
});

test('back and front layers are valid svg and the front holds the hills', () => {
  const { back, front } = buildScene('clouds', false);
  for (const layer of [back, front]) {
    assert.ok(layer.startsWith('<svg'));
    assert.ok(layer.endsWith('</svg>'));
  }
  assert.ok(front.includes('hill-near'));
  assert.ok(!back.includes('hill-near'));
});

test('isNightIcon reads the day/night suffix', () => {
  assert.equal(isNightIcon('01n'), true);
  assert.equal(isNightIcon('01d'), false);
});

test('a meteor streaks across clear nights only', () => {
  assert.ok(buildScene('clear-night', true).back.includes('class="meteor"'));
  assert.ok(!buildScene('clear-day', false).back.includes('class="meteor"'));
  assert.ok(!buildScene('rain', true).back.includes('class="meteor"'));
});

test('seasons add their decorations and leave ordinary scenes unchanged', () => {
  assert.deepEqual(buildScene('clear-day', false, null), buildScene('clear-day', false));
  assert.ok(buildScene('clear-day', false, 'christmas').front.includes('class="bulb'));
  assert.ok(buildScene('clear-day', false, 'halloween').front.includes('class="pumpkin"'));
  assert.ok(buildScene('clear-day', false, 'newyear').back.includes('class="lantern"'));
  assert.ok(buildScene('clear-night', true, 'midautumn').back.includes('class="moon-full"'));
  assert.ok(!buildScene('clear-day', false, 'midautumn').back.includes('class="moon-full"'));
});

test('clouds are split into far, middle and near depth layers with shaded bodies', () => {
  const { back } = buildScene('clouds', false);

  for (const depth of ['far', 'mid', 'near']) {
    assert.ok(back.includes(`depth-${depth}`), depth);
  }
  assert.ok(back.includes('cloud-light'));
  assert.ok(back.includes('url(#') === false && back.includes('id="cloud-fill"'));
});

test('rain and snow fall in near and far layers with different sizes', () => {
  const rain = buildScene('rain', false).back;
  const snow = buildScene('snow', false).back;

  assert.ok(count(rain, 'rain-far') > 10 && count(rain, 'rain-near') > 10);
  assert.ok(count(snow, 'snow-far') > 10 && count(snow, 'snow-near') > 10);
});

test('hills and the skyline reach past the frame so parallax never shows a gap', () => {
  const { back, front } = buildScene('clear-day', false);

  assert.ok(back.includes('M-80 520') && front.includes('H1280V520z'));
  assert.ok(back.includes('depth-hill') && front.includes('depth-near'));
  assert.ok(front.includes('id="hill-near-fill"') && back.includes('id="hill-far-fill"'));
});
