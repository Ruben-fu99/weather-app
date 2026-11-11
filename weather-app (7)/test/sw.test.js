import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

function precacheList() {
  const source = readFileSync(new URL('sw.js', root), 'utf8');
  const [, body] = source.match(/const PRECACHE = \[([\s\S]*?)\];/);
  return [...body.matchAll(/'([^']+)'/g)].map(([, path]) => path).sort();
}

function listFiles(directory, prefix) {
  return readdirSync(new URL(`${directory}/`, root)).map((name) => `${prefix}/${name}`);
}

test('the service worker precaches every source file, icon and page asset', () => {
  const expected = [
    './',
    'index.html',
    'style.css',
    'manifest.webmanifest',
    ...listFiles('src', 'src'),
    ...listFiles('icons', 'icons'),
  ].sort();

  assert.deepEqual(precacheList(), expected);
});

test('the manifest references icons that exist and is installable', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  const icons = new Set(listFiles('icons', 'icons'));

  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url);
  assert.ok(manifest.icons.some(({ sizes }) => sizes === '192x192'));
  assert.ok(manifest.icons.some(({ sizes }) => sizes === '512x512'));
  for (const { src } of manifest.icons) {
    assert.ok(icons.has(src), `${src} is missing`);
  }
});

test('the deploy workflow ships every file the service worker needs', () => {
  const workflow = readFileSync(new URL('.github/workflows/deploy.yml', root), 'utf8');

  for (const required of ['manifest.webmanifest', 'sw.js', 'src', 'icons', '__VERSION__']) {
    assert.ok(workflow.includes(required), `${required} is not deployed`);
  }
});
