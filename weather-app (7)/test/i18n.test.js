import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DICTIONARIES, apiLanguage, detectLanguage, getLanguage, setLanguage, t } from '../src/i18n.js';

test('both languages define exactly the same keys', () => {
  const zh = Object.keys(DICTIONARIES.zh).sort();
  const en = Object.keys(DICTIONARIES.en).sort();

  assert.deepEqual(en, zh);
});

test('both languages use the same placeholders for each key', () => {
  const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');

  for (const key of Object.keys(DICTIONARIES.zh)) {
    assert.equal(placeholders(DICTIONARIES.en[key]), placeholders(DICTIONARIES.zh[key]), key);
  }
});

test('t interpolates params and falls back to the key when missing', () => {
  assert.equal(t('forecast.rain', { chance: 40 }), '降雨 40%');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('forecast.rain'), '降雨 {chance}%');
});

test('setLanguage switches dictionaries and ignores unknown languages', () => {
  setLanguage('en');
  try {
    assert.equal(getLanguage(), 'en');
    assert.equal(t('forecast.rain', { chance: 40 }), 'Rain 40%');
    assert.equal(apiLanguage(), 'en');

    setLanguage('fr');
    assert.equal(getLanguage(), 'zh');
    assert.equal(apiLanguage(), 'zh_tw');
  } finally {
    setLanguage('zh');
  }
});

test('detectLanguage prefers Chinese for zh locales and English otherwise', () => {
  assert.equal(detectLanguage('zh-TW'), 'zh');
  assert.equal(detectLanguage('zh-Hant-HK'), 'zh');
  assert.equal(detectLanguage('en-US'), 'en');
  assert.equal(detectLanguage('ja'), 'en');
  assert.equal(detectLanguage(undefined), 'en');
});
