import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasChinese, searchChinesePlaces } from '../src/chinese-places.js';

test('hasChinese detects Chinese characters only', () => {
  assert.equal(hasChinese('台北'), true);
  assert.equal(hasChinese('Taipei 台北'), true);
  assert.equal(hasChinese('Taipei'), false);
});

test('searchChinesePlaces matches names, prefixes and administrative suffixes', () => {
  assert.equal(searchChinesePlaces('台北')[0].name, '台北');
  assert.equal(searchChinesePlaces('台北市')[0].name, '台北');
  assert.equal(searchChinesePlaces('高雄縣')[0].name, '高雄');
  assert.equal(searchChinesePlaces('臺南')[0].name, '台南');
  assert.equal(searchChinesePlaces('台')[0].name, '台北');
});

test('searchChinesePlaces returns coordinates and respects the limit', () => {
  const [taipei] = searchChinesePlaces('台北');
  assert.equal(taipei.country, 'TW');
  assert.ok(Number.isFinite(taipei.lat) && Number.isFinite(taipei.lon));
  assert.equal(searchChinesePlaces('台', 3).length, 3);
});

test('searchChinesePlaces returns nothing for unknown or empty input', () => {
  assert.deepEqual(searchChinesePlaces('不存在的地方'), []);
  assert.deepEqual(searchChinesePlaces('  '), []);
});

test('searchChinesePlaces finds districts by district name or city plus district', () => {
  const [daan] = searchChinesePlaces('台北市大安區');
  assert.deepEqual([daan.name, daan.state, daan.country], ['大安區', '台北市', 'TW']);
  assert.equal(searchChinesePlaces('臺中市西區').length, 1);
  assert.equal(searchChinesePlaces('臺中市西區')[0].state, '台中市');
  assert.equal(searchChinesePlaces('信義區')[0].state, '台北市');
  assert.deepEqual(searchChinesePlaces('信義區').map((place) => place.state), ['台北市', '基隆市']);
  assert.equal(searchChinesePlaces('高雄美濃')[0].name, '美濃區');
});

test('a city query lists the city before its districts', () => {
  const results = searchChinesePlaces('台北');
  assert.equal(results[0].name, '台北');
  assert.equal(results[1].state, '台北市');
});

test('searchChinesePlaces finds towns and townships outside the six municipalities', () => {
  const [zhubei] = searchChinesePlaces('新竹縣竹北市');
  assert.deepEqual([zhubei.name, zhubei.state], ['竹北市', '新竹縣']);
  assert.equal(searchChinesePlaces('恆春鎮')[0].state, '屏東縣');
  assert.equal(searchChinesePlaces('蘭嶼鄉')[0].state, '台東縣');
  assert.equal(searchChinesePlaces('台東蘭嶼')[0].name, '蘭嶼鄉');
  assert.equal(searchChinesePlaces('宜蘭羅東')[0].name, '羅東鎮');
  assert.equal(searchChinesePlaces('南竿鄉')[0].state, '連江縣');
});

test('every township has valid Taiwan coordinates', () => {
  for (const place of searchChinesePlaces('台', 1000)) {
    assert.ok(place.lat > 21 && place.lat < 27 && place.lon > 118 && place.lon < 123, place.name);
  }
  for (const stem of ['屏東', '花蓮', '澎湖', '金門', '彰化', '雲林']) {
    for (const place of searchChinesePlaces(stem, 1000)) {
      assert.ok(place.lat > 21 && place.lat < 27 && place.lon > 118 && place.lon < 123, place.name);
    }
  }
});
