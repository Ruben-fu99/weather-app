const SVG_NS = 'http://www.w3.org/2000/svg';
const RAY_COUNT = 8;

const PALETTE = {
  sun: '#ffb62e',
  moon: '#f6e7a8',
  cloud: '#ffffff',
  cloudEdge: '#b4c3d6',
  storm: '#9aa9bd',
  rain: '#3d9bff',
  snow: '#8fd0ff',
  bolt: '#ffc933',
  mist: '#8195ab',
};

const CLOUD_PATH = 'M18 48a9 9 0 0 1-1-18 14 14 0 0 1 27-4 11 11 0 0 1 3 22z';

function rays(cx, cy, inner, outer) {
  return Array.from({ length: RAY_COUNT }, (_, index) => {
    const angle = (index / RAY_COUNT) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const point = (distance) => `${(cx + cos * distance).toFixed(1)} ${(cy + sin * distance).toFixed(1)}`;
    return `M${point(inner)}L${point(outer)}`;
  }).join('');
}

function sun(cx, cy, scale = 1) {
  return (
    `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-32 -32)">` +
    `<circle cx="32" cy="32" r="12" fill="${PALETTE.sun}"/>` +
    `<path class="icon-rays" d="${rays(32, 32, 18, 25)}" stroke="${PALETTE.sun}" stroke-width="4" stroke-linecap="round" fill="none"/>` +
    '</g>'
  );
}

function moon(x, y, scale = 1) {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<path d="M26 4a24 24 0 1 0 22 32A19 19 0 0 1 26 4z" fill="${PALETTE.moon}"/>` +
    '</g>'
  );
}

function cloud(fill = PALETTE.cloud, transform = '') {
  return `<path d="${CLOUD_PATH}" fill="${fill}" stroke="${PALETTE.cloudEdge}" stroke-width="1.5" stroke-linejoin="round" transform="${transform}"/>`;
}

function strokes(paths, color, width = 3.5, name = '') {
  return `<path class="${name}" d="${paths}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
}

const WEATHER_BODIES = {
  'clear-day': () => sun(32, 32),
  'clear-night': () => moon(10, 10),
  'partly-day': () => sun(24, 24, 0.8) + cloud(PALETTE.cloud, 'translate(4 6)'),
  'partly-night': () => moon(2, 0, 0.7) + cloud(PALETTE.cloud, 'translate(4 6)'),
  clouds: () => cloud(PALETTE.storm, 'translate(-6 -6) scale(0.9)') + cloud(PALETTE.cloud, 'translate(4 4)'),
  rain: () => cloud(PALETTE.cloud, 'translate(0 -8)') + strokes('M24 46l-3 8M34 46l-3 8M44 46l-3 8', PALETTE.rain, 3.5, 'icon-rain'),
  thunder: () =>
    cloud(PALETTE.storm, 'translate(0 -8)') +
    `<path class="icon-bolt" d="M34 36l-9 12h7l-3 10 11-14h-7z" fill="${PALETTE.bolt}" stroke="#e29a00" stroke-width="1.2" stroke-linejoin="round"/>`,
  snow: () =>
    cloud(PALETTE.cloud, 'translate(0 -8)') +
    [22, 33, 44].map((x, index) => `<circle class="icon-snow" cx="${x}" cy="${index === 1 ? 56 : 50}" r="3" fill="${PALETTE.snow}"/>`).join(''),
  mist: () => cloud('#e4ebf3', 'translate(0 -10)') + strokes('M14 46h36M20 53h30M14 60h24', PALETTE.mist, 3, 'icon-mist'),
};

const KIND_BY_PREFIX = {
  '01': (night) => (night ? 'clear-night' : 'clear-day'),
  '02': (night) => (night ? 'partly-night' : 'partly-day'),
  '03': () => 'clouds',
  '04': () => 'clouds',
  '09': () => 'rain',
  '10': () => 'rain',
  '11': () => 'thunder',
  '13': () => 'snow',
  '50': () => 'mist',
};

export const WEATHER_KINDS = Object.keys(WEATHER_BODIES);

export function iconKind(code) {
  const resolve = KIND_BY_PREFIX[String(code).slice(0, 2)];
  return resolve ? resolve(String(code).endsWith('n')) : 'clouds';
}

export function weatherIconSvg(kind) {
  const body = WEATHER_BODIES[kind] ?? WEATHER_BODIES.clouds;
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 64 64"><g class="icon-body">${body()}</g></svg>`;
}

const LINE_PATHS = {
  thermometer: 'M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z',
  drop: 'M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z',
  drops: 'M8 4s4 4 4 7a4 4 0 0 1-8 0c0-3 4-7 4-7zM17 11s3 3 3 5.2a3 3 0 0 1-6 0c0-2.2 3-5.2 3-5.2z',
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7',
  gauge: 'M4 17a8 8 0 1 1 16 0M12 17l4-5',
  umbrella: 'M3 12a9 9 0 0 1 18 0zM12 12v6a2 2 0 0 1-4 0',
  coat: 'M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z',
  snowflake: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
  mask: 'M4 8h16v4c0 4-3.5 7-8 7s-8-3-8-7zM8 12h8M8 15h8',
  runner: 'M14 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM12 8l-3 4 3 3v5M12 8l3 3h3M9 12l-3 1',
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  sunrise: 'M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 4v6M9 7l3-3 3 3',
  sunset: 'M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 4v6M9 7l3 3 3-3',
  pin: 'M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  cloud: 'M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.6 4.7 4.7 0 0 1 17.5 18z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
};

export const LINE_ICONS = Object.keys(LINE_PATHS);

export function lineIconSvg(name) {
  return (
    `<svg xmlns="${SVG_NS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${LINE_PATHS[name]}"/></svg>`
  );
}

const ADVICE_VISUALS = {
  'coat.freezing': { icon: 'snowflake', tone: 'cold' },
  'coat.cold': { icon: 'coat', tone: 'cold' },
  'coat.cool': { icon: 'coat', tone: 'neutral' },
  'coat.mild': { icon: 'coat', tone: 'good' },
  'coat.warm': { icon: 'thermometer', tone: 'warm' },
  'coat.hot': { icon: 'thermometer', tone: 'warm' },
  umbrella: { icon: 'umbrella', tone: 'rain' },
  snow: { icon: 'snowflake', tone: 'cold' },
  wind: { icon: 'wind', tone: 'neutral' },
  muggy: { icon: 'drop', tone: 'warm' },
  air: { icon: 'mask', tone: 'warn' },
  'exercise.good': { icon: 'runner', tone: 'good' },
  'exercise.indoor': { icon: 'home', tone: 'neutral' },
};

export function adviceVisual(key) {
  return ADVICE_VISUALS[key] ?? { icon: 'thermometer', tone: 'neutral' };
}

function parseSvg(markup) {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  return document.importNode(parsed, true);
}

export function createWeatherIcon(kind, size, label = '') {
  const svg = parseSvg(weatherIconSvg(kind));
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('weather-icon');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  return svg;
}

export function createLineIcon(name, size = 20) {
  const svg = parseSvg(lineIconSvg(name));
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('line-icon');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}
