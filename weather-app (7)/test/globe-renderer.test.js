import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderGlobe } from '../src/globe-renderer.js';

const SIZE = 101;
const RADIUS = 45;

function gradientTexture() {
  const width = 360;
  const height = 180;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const offset = (row * width + column) * 4;
      data[offset] = column % 256;
      data[offset + 1] = row;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

function blankImage() {
  return { width: SIZE, height: SIZE, data: new Uint8ClampedArray(SIZE * SIZE * 4) };
}

function pixel(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return [...image.data.slice(offset, offset + 4)];
}

test('the center pixel samples the texture at the view center', () => {
  const image = blankImage();

  renderGlobe(image, gradientTexture(), { centerLat: 0, centerLon: 0, radius: RADIUS });

  const [red, green, , alpha] = pixel(image, 50, 50);
  assert.ok(Math.abs(red - 180) <= 2, `red ${red}`);
  assert.ok(Math.abs(green - 90) <= 2, `green ${green}`);
  assert.equal(alpha, 255);
});

test('pixels outside the sphere are transparent', () => {
  const image = blankImage();
  image.data.fill(200);

  renderGlobe(image, gradientTexture(), { centerLat: 0, centerLon: 0, radius: RADIUS });

  assert.equal(pixel(image, 0, 0)[3], 0);
  assert.equal(pixel(image, 100, 100)[3], 0);
});

test('changing the center longitude shifts the sampled column', () => {
  const image = blankImage();

  renderGlobe(image, gradientTexture(), { centerLat: 0, centerLon: 90, radius: RADIUS });

  const [red] = pixel(image, 50, 50);
  assert.ok(Math.abs(red - 270 % 256) <= 2, `red ${red}`);
});

test('the sphere is darker toward the limb than at the center', () => {
  const image = blankImage();
  const flat = {
    width: 4,
    height: 2,
    data: new Uint8ClampedArray(4 * 2 * 4).fill(200),
  };

  renderGlobe(image, flat, { centerLat: 0, centerLon: 0, radius: RADIUS });

  assert.ok(pixel(image, 50, 50)[0] > pixel(image, 90, 50)[0]);
});

test('a pixel facing the sun stays bright and one facing away is darkened', () => {
  const flat = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(200) };
  const view = { centerLat: 0, centerLon: 0, radius: RADIUS };

  const lit = blankImage();
  renderGlobe(lit, flat, { ...view, sun: { lat: 0, lon: 0 } });
  const dark = blankImage();
  renderGlobe(dark, flat, { ...view, sun: { lat: 0, lon: 180 } });
  const unshaded = blankImage();
  renderGlobe(unshaded, flat, view);

  assert.equal(pixel(lit, 50, 50)[0], pixel(unshaded, 50, 50)[0]);
  assert.ok(pixel(dark, 50, 50)[0] < pixel(unshaded, 50, 50)[0] * 0.4);
});

test('the terminator follows the sun longitude across the disc', () => {
  const flat = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(200) };
  const image = blankImage();

  renderGlobe(image, flat, { centerLat: 0, centerLon: 0, radius: RADIUS, sun: { lat: 0, lon: 90 } });

  assert.ok(pixel(image, 80, 50)[0] > pixel(image, 20, 50)[0], 'east side should be lit, west side dark');
});

test('the sun at a pole lights the polar cap and darkens the opposite side', () => {
  const flat = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(200) };
  const image = blankImage();

  renderGlobe(image, flat, { centerLat: 0, centerLon: 0, radius: RADIUS, sun: { lat: 90, lon: 0 } });

  assert.ok(pixel(image, 50, 20)[0] > pixel(image, 50, 80)[0], 'north should be lit, south dark');
});

test('a faint atmosphere glows just outside the limb and fades out', () => {
  const image = blankImage();
  const flat = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(200) };

  renderGlobe(image, flat, { centerLat: 0, centerLon: 0, radius: RADIUS });

  const [red, , blue, alpha] = pixel(image, 97, 50);
  assert.ok(alpha > 0, `alpha ${alpha}`);
  assert.ok(blue > red, 'glow is blue');
  assert.ok(pixel(image, 99, 50)[3] < alpha, 'glow fades with distance');
  assert.equal(pixel(image, 100, 50)[3], 0);
});

test('the atmosphere glows on the lit side more than on the night side', () => {
  const flat = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(200) };
  const view = { centerLat: 0, centerLon: 0, radius: RADIUS };

  const lit = blankImage();
  renderGlobe(lit, flat, { ...view, sun: { lat: 0, lon: 90 } });

  assert.ok(pixel(lit, 97, 50)[3] > pixel(lit, 3, 50)[3] * 2);
});

test('the sun glints off oceans but not off land', () => {
  const ocean = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4) };
  const land = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4) };
  for (let index = 0; index < 8; index += 1) {
    ocean.data.set([20, 60, 160, 255], index * 4);
    land.data.set([70, 150, 80, 255], index * 4);
  }
  const view = { centerLat: 0, centerLon: 0, radius: RADIUS };

  const glinting = blankImage();
  renderGlobe(glinting, ocean, { ...view, sun: { lat: 0, lon: 0 } });
  const flatOcean = blankImage();
  renderGlobe(flatOcean, ocean, view);
  const landWithSun = blankImage();
  renderGlobe(landWithSun, land, { ...view, sun: { lat: 0, lon: 0 } });
  const landFlat = blankImage();
  renderGlobe(landFlat, land, view);

  assert.ok(pixel(glinting, 50, 50)[0] > pixel(flatOcean, 50, 50)[0] + 40);
  assert.equal(pixel(landWithSun, 50, 50)[0], pixel(landFlat, 50, 50)[0]);
});

function cloudTexture(alphaAt) {
  const width = 360;
  const height = 180;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const offset = (row * width + column) * 4;
      data.set([255, 255, 255, alphaAt(column - 180, 90 - row)], offset);
    }
  }
  return { width, height, data };
}

const OVERCAST = cloudTexture(() => 255);
const FLAT_VIEW = { centerLat: 0, centerLon: 0, radius: RADIUS };

function brightness(image, x, y) {
  const [red, green, blue] = pixel(image, x, y);
  return red + green + blue;
}

test('an overcast cloud shell turns the center pixel white', () => {
  const image = blankImage();

  renderGlobe(image, gradientTexture(), { ...FLAT_VIEW, clouds: OVERCAST });

  const [red, green, blue, alpha] = pixel(image, 50, 50);
  assert.ok(red > 200 && green > 200 && blue > 200, `${red},${green},${blue}`);
  assert.equal(alpha, 255);
});

test('the cloud shell rises above the surface and is drawn beyond the limb', () => {
  const clear = blankImage();
  const cloudy = blankImage();
  const insideShell = 50 + Math.round(RADIUS * 1.015);
  const beyondShell = 50 + Math.round(RADIUS * 1.06);

  renderGlobe(clear, gradientTexture(), FLAT_VIEW);
  renderGlobe(cloudy, gradientTexture(), { ...FLAT_VIEW, clouds: OVERCAST });

  assert.ok(pixel(cloudy, insideShell, 50)[3] > pixel(clear, insideShell, 50)[3] + 50);
  assert.ok(brightness(cloudy, insideShell, 50) > 600);
  assert.deepEqual(pixel(cloudy, beyondShell, 50), pixel(clear, beyondShell, 50));
});

test('clouds on the night side are darker than in daylight', () => {
  const day = blankImage();
  const night = blankImage();

  renderGlobe(day, gradientTexture(), { ...FLAT_VIEW, clouds: OVERCAST, sun: { lat: 0, lon: 0 } });
  renderGlobe(night, gradientTexture(), { ...FLAT_VIEW, clouds: OVERCAST, sun: { lat: 0, lon: 180 } });

  assert.ok(brightness(night, 50, 50) < brightness(day, 50, 50) * 0.5);
});

test('a cloud casts its shadow on the surface away from the sun', () => {
  const patch = cloudTexture((lon) => (lon >= 2 && lon <= 4 ? 255 : 0));
  const sun = { lat: 0, lon: 60 };
  const clear = blankImage();
  const shadowed = blankImage();

  renderGlobe(clear, gradientTexture(), { ...FLAT_VIEW, sun });
  renderGlobe(shadowed, gradientTexture(), { ...FLAT_VIEW, sun, clouds: patch });

  assert.ok(brightness(shadowed, 50, 50) < brightness(clear, 50, 50) * 0.8);
  assert.equal(brightness(shadowed, 20, 50), brightness(clear, 20, 50));
});

test('with 3D off the clouds lie flat on the surface: no shell past the limb and no shadow', () => {
  const patch = cloudTexture((lon) => (lon >= 2 && lon <= 4 ? 255 : 0));
  const sun = { lat: 0, lon: 60 };
  const clear = blankImage();
  const flat = blankImage();
  const insideShell = 50 + Math.round(RADIUS * 1.015);

  renderGlobe(clear, gradientTexture(), { ...FLAT_VIEW, sun });
  renderGlobe(flat, gradientTexture(), { ...FLAT_VIEW, sun, clouds: patch, depth: false });
  assert.equal(brightness(flat, 50, 50), brightness(clear, 50, 50));

  renderGlobe(clear, gradientTexture(), FLAT_VIEW);
  renderGlobe(flat, gradientTexture(), { ...FLAT_VIEW, clouds: OVERCAST, depth: false });
  assert.deepEqual(pixel(flat, insideShell, 50), pixel(clear, insideShell, 50));
  assert.ok(brightness(flat, 50, 50) > 600);
});
