import { WeatherError } from './errors.js';
import { latToMercatorFraction, tileCoordinates } from './globe-math.js';

export const TEXTURE_WIDTH = 2048;
export const TEXTURE_HEIGHT = 1024;

const TILE_SIZE = 256;
const BASE_ZOOM = 3;
const CLOUD_ZOOM = 2;
const CLOUD_URL = 'https://tile.openweathermap.org/map/clouds_new';
const GIBS_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
const BASE_URL = `${GIBS_URL}/BlueMarble_ShadedRelief_Bathymetry/default/EPSG3857_500m`;
const SATELLITE_URL = `${GIBS_URL}/MODIS_Terra_CorrectedReflectance_TrueColor/default`;
const SATELLITE_LAYER_SET = 'GoogleMapsCompatible_Level9';
const SATELLITE_MAX_AGE_DAYS = 2;
const NO_DATA_SUM = 6;
const DAY_MS = 86400000;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`tile failed: ${url}`));
    image.src = url;
  });
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function loadMercatorCanvas(tileUrl, failureType, zoom = BASE_ZOOM) {
  const size = TILE_SIZE * 2 ** zoom;
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');

  const outcomes = await Promise.allSettled(
    tileCoordinates(zoom).map(async ({ x, y }) => {
      const image = await loadImage(tileUrl(zoom, y, x));
      context.drawImage(image, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    })
  );

  if (outcomes.every(({ status }) => status === 'rejected')) {
    throw new WeatherError(failureType);
  }
  return canvas;
}

function mercatorToEquirectangular(source) {
  const target = createCanvas(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const context = target.getContext('2d');
  context.imageSmoothingEnabled = true;

  for (let row = 0; row < TEXTURE_HEIGHT; row += 1) {
    const lat = 90 - ((row + 0.5) / TEXTURE_HEIGHT) * 180;
    const sourceRow = Math.min(source.height - 1, latToMercatorFraction(lat) * source.height);
    context.drawImage(source, 0, sourceRow, source.width, 1, 0, row, TEXTURE_WIDTH, 1);
  }

  const { width, height, data } = context.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  return { width, height, data };
}

export async function loadBaseTexture() {
  const canvas = await loadMercatorCanvas((zoom, y, x) => `${BASE_URL}/${zoom}/${y}/${x}.jpeg`, 'tiles-base');
  return mercatorToEquirectangular(canvas);
}

export function satelliteDates(now) {
  return Array.from({ length: SATELLITE_MAX_AGE_DAYS }, (_, index) =>
    new Date(now.getTime() - (index + 1) * DAY_MS).toISOString().slice(0, 10)
  );
}

export function fillGaps(satellite, base) {
  const { data } = satellite;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset] + data[offset + 1] + data[offset + 2] < NO_DATA_SUM) {
      data[offset] = base.data[offset];
      data[offset + 1] = base.data[offset + 1];
      data[offset + 2] = base.data[offset + 2];
    }
  }
  return satellite;
}

export async function loadSatelliteTexture(base, now = new Date()) {
  let lastError = null;
  for (const date of satelliteDates(now)) {
    try {
      const canvas = await loadMercatorCanvas(
        (zoom, y, x) => `${SATELLITE_URL}/${date}/${SATELLITE_LAYER_SET}/${zoom}/${y}/${x}.jpg`,
        'tiles-satellite'
      );
      return { texture: fillGaps(mercatorToEquirectangular(canvas), base), date };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function loadCloudTexture(apiKey) {
  if (!apiKey) {
    throw new WeatherError('missing-key');
  }
  const canvas = await loadMercatorCanvas(
    (zoom, y, x) => `${CLOUD_URL}/${zoom}/${x}/${y}.png?appid=${encodeURIComponent(apiKey)}`,
    'tiles-clouds',
    CLOUD_ZOOM
  );
  return { texture: mercatorToEquirectangular(canvas), loadedAt: Date.now() };
}
