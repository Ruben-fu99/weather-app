import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adviceInputs, buildAdvice } from '../src/advice.js';

const calm = {
  temp: 21,
  feelsLike: 21,
  humidity: 50,
  windMs: 2,
  weatherId: 800,
  popMax: 0,
  aqi: 1,
};

test('clothing advice follows the feels-like temperature bands', () => {
  const coat = (feelsLike) => buildAdvice({ ...calm, feelsLike })[0];

  assert.equal(coat(0), 'coat.freezing');
  assert.equal(coat(8), 'coat.cold');
  assert.equal(coat(15), 'coat.cool');
  assert.equal(coat(21), 'coat.mild');
  assert.equal(coat(27), 'coat.warm');
  assert.equal(coat(34), 'coat.hot');
});

test('calm mild weather suggests outdoor exercise and nothing else', () => {
  assert.deepEqual(buildAdvice(calm), ['coat.mild', 'exercise.good']);
});

test('rain in the current conditions or a high chance suggests an umbrella', () => {
  assert.ok(buildAdvice({ ...calm, weatherId: 501 }).includes('umbrella'));
  assert.ok(buildAdvice({ ...calm, popMax: 0.6 }).includes('umbrella'));
  assert.ok(!buildAdvice({ ...calm, popMax: 0.3 }).includes('umbrella'));
});

test('snow suggests care on slippery surfaces instead of an umbrella', () => {
  const advice = buildAdvice({ ...calm, weatherId: 601 });

  assert.ok(advice.includes('snow'));
  assert.ok(!advice.includes('umbrella'));
});

test('wind, mugginess and poor air each add their own advice', () => {
  assert.ok(buildAdvice({ ...calm, windMs: 12 }).includes('wind'));
  assert.ok(buildAdvice({ ...calm, temp: 30, feelsLike: 33, humidity: 90 }).includes('muggy'));
  assert.ok(buildAdvice({ ...calm, aqi: 4 }).includes('air'));
});

test('bad conditions move exercise indoors', () => {
  const indoors = (overrides) => buildAdvice({ ...calm, ...overrides }).at(-1);

  assert.equal(indoors({ weatherId: 500 }), 'exercise.indoor');
  assert.equal(indoors({ feelsLike: 2 }), 'exercise.indoor');
  assert.equal(indoors({ feelsLike: 33 }), 'exercise.indoor');
  assert.equal(indoors({ windMs: 9 }), 'exercise.indoor');
  assert.equal(indoors({ aqi: 5 }), 'exercise.indoor');
  assert.equal(indoors({}), 'exercise.good');
});

test('missing forecast and air data are treated as no signal', () => {
  assert.deepEqual(buildAdvice({ ...calm, popMax: null, aqi: null }), ['coat.mild', 'exercise.good']);
});

const bundle = (current, extra = {}) => ({ current, forecast: null, air: null, ...extra });
const current = (temp, feels, wind) => ({
  main: { temp, feels_like: feels, humidity: 60 },
  wind: { speed: wind },
  weather: [{ id: 800 }],
});

test('adviceInputs converts imperial units to metric', () => {
  const inputs = adviceInputs(bundle(current(68, 77, 22.4)), 'imperial');

  assert.ok(Math.abs(inputs.temp - 20) < 1e-9);
  assert.ok(Math.abs(inputs.feelsLike - 25) < 1e-9);
  assert.ok(Math.abs(inputs.windMs - 10.014) < 0.01);
});

test('adviceInputs reads the highest rain chance of the next 12 hours and the air index', () => {
  const forecast = {
    list: [{ pop: 0.1 }, { pop: 0.5 }, { pop: 0.2 }, { pop: 0.3 }, { pop: 0.9 }],
  };
  const air = { list: [{ main: { aqi: 3 } }] };

  const inputs = adviceInputs(bundle(current(20, 20, 3), { forecast, air }), 'metric');

  assert.equal(inputs.popMax, 0.5);
  assert.equal(inputs.aqi, 3);
});

test('adviceInputs reports null when forecast and air data are missing', () => {
  const inputs = adviceInputs(bundle(current(20, 20, 3)), 'metric');

  assert.equal(inputs.popMax, null);
  assert.equal(inputs.aqi, null);
});
