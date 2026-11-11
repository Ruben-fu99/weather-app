const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 520;
const SEED = 20261109;
const DECORATION_SEED = 7;
const SUN_POSITION = { x: 790, y: 130 };

const CLOUD_COUNTS = { 'clear-day': 3, 'clear-night': 2, clouds: 7, rain: 8, thunder: 8, snow: 7, mist: 3 };
const CLOUD_PATH = 'M0 40a26 26 0 0 1 4-52 38 38 0 0 1 72-8 30 30 0 0 1 14 60z';
const CLEAR_CLOUD_START = 460;
const BLINK_SHARE = 0.1;
const BIRD_COUNT = 4;
const STAR_COUNT = 44;
const RAIN_COUNT = 90;
const SNOW_COUNT = 70;
const CLOUD_DEPTHS = ['far', 'mid', 'near'];
const CLOUD_DEPTH_STYLE = { far: { scale: 0.7, lift: -26 }, mid: { scale: 1, lift: 0 }, near: { scale: 1.3, lift: 22 } };
const STAR_THEMES = new Set(['clear-night', 'clouds']);

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function between(random, min, max) {
  return round(min + random() * (max - min));
}

function stars(random) {
  return Array.from({ length: STAR_COUNT }, () => {
    const radius = between(random, 0.8, 2);
    const delay = between(random, 0, 4);
    return `<circle class="star" cx="${between(random, 10, VIEW_WIDTH - 10)}" cy="${between(random, 8, 250)}" r="${radius}" style="animation-delay:-${delay}s"/>`;
  }).join('');
}

function celestial(theme, night, season) {
  const { x, y } = SUN_POSITION;
  if (night) {
    if (theme !== 'clear-night' && theme !== 'clouds') {
      return '';
    }
    if (season === 'midautumn') {
      return `<circle class="moon-full-glow" cx="${x}" cy="${y}" r="96"/><circle class="moon-full" cx="${x}" cy="${y}" r="54"/>`;
    }
    return `<path class="moon" d="M${x} ${y - 34}A34 34 0 1 0 ${x} ${y + 34}A40 40 0 0 1 ${x} ${y - 34}z"/>`;
  }
  if (theme === 'clear-day' || theme === 'clouds') {
    return `<circle class="sun-glow" cx="${x}" cy="${y}" r="84"/><circle class="sun" cx="${x}" cy="${y}" r="44"/>`;
  }
  return '';
}

function clouds(theme, random) {
  const count = CLOUD_COUNTS[theme];
  const layers = { far: '', mid: '', near: '' };
  for (let index = 0; index < count; index += 1) {
    const depth = CLOUD_DEPTHS[index % CLOUD_DEPTHS.length];
    const { scale: depthScale, lift } = CLOUD_DEPTH_STYLE[depth];
    const start = theme === 'clear-day' ? CLEAR_CLOUD_START : 0;
    const x = round(start + (index / count) * (VIEW_WIDTH - start) + between(random, -40, 60));
    const y = round(between(random, 150, 260) + lift);
    const scale = round(between(random, 0.9, theme === 'clear-day' ? 1.4 : 1.9) * depthScale);
    const duration = round(between(random, 70, 140) / depthScale);
    const delay = between(random, 0, duration);
    layers[depth] +=
      `<g transform="translate(${x} ${y}) scale(${scale})">` +
      `<g class="cloud" style="animation-duration:${duration}s;animation-delay:-${delay}s">` +
      `<path class="cloud-shape" d="${CLOUD_PATH}"/><ellipse class="cloud-light" cx="40" cy="-12" rx="26" ry="8"/></g></g>`;
  }
  return CLOUD_DEPTHS.map((depth) => `<g class="depth depth-${depth}">${layers[depth]}</g>`).join('');
}

function rain(random) {
  const layers = { far: '', near: '' };
  for (let index = 0; index < RAIN_COUNT; index += 1) {
    const depth = index % 2 === 0 ? 'far' : 'near';
    const x = between(random, 0, VIEW_WIDTH);
    const y = between(random, -20, 300);
    const length = depth === 'far' ? between(random, 10, 16) : between(random, 22, 34);
    const duration = depth === 'far' ? between(random, 1.1, 1.6) : between(random, 0.55, 0.85);
    const delay = between(random, 0, duration);
    layers[depth] += `<path class="rain-drop rain-${depth}" d="M${x} ${y}l-4 ${length}" style="animation-duration:${duration}s;animation-delay:-${delay}s"/>`;
  }
  return `<g class="depth depth-far">${layers.far}</g><g class="depth depth-near">${layers.near}</g>`;
}

function snow(random) {
  const layers = { far: '', near: '' };
  for (let index = 0; index < SNOW_COUNT; index += 1) {
    const depth = index % 2 === 0 ? 'far' : 'near';
    const radius = depth === 'far' ? between(random, 1.2, 2.2) : between(random, 2.8, 4.6);
    const duration = depth === 'far' ? between(random, 9, 14) : between(random, 5, 8);
    const delay = between(random, 0, duration);
    layers[depth] += `<circle class="snow-flake snow-${depth}" cx="${between(random, 0, VIEW_WIDTH)}" cy="${between(random, -20, 60)}" r="${radius}" style="animation-duration:${duration}s;animation-delay:-${delay}s"/>`;
  }
  return `<g class="depth depth-far">${layers.far}</g><g class="depth depth-near">${layers.near}</g>`;
}

function lightning() {
  return (
    '<rect class="flash" width="1200" height="520"/>' +
    '<path class="bolt" d="M610 40l-46 120h40l-34 110 92-140h-46l40-90z"/>'
  );
}

function fog() {
  return [250, 310, 370]
    .map((y, index) => `<rect class="fog" x="-100" y="${y}" width="1400" height="46" rx="23" style="animation-delay:-${index * 7}s"/>`)
    .join('');
}

function precipitation(theme, random) {
  if (theme === 'rain') {
    return rain(random);
  }
  if (theme === 'thunder') {
    return rain(random) + lightning();
  }
  if (theme === 'snow') {
    return snow(random);
  }
  if (theme === 'mist') {
    return fog();
  }
  return '';
}

function skyline(random) {
  let x = -90;
  let markup = '';
  while (x < VIEW_WIDTH + 90) {
    const width = between(random, 36, 84);
    const height = between(random, 40, 150);
    const top = round(430 - height);
    markup += `<rect class="building" x="${x}" y="${top}" width="${width}" height="${height + 120}"/>`;
    const columns = Math.floor((width - 10) / 14);
    const rows = Math.floor(height / 20);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (random() > 0.55) {
          const blink = random() < BLINK_SHARE ? ' window-blink' : '';
          markup += `<rect class="window${blink}" x="${round(x + 7 + column * 14)}" y="${top + 8 + row * 20}" width="6" height="9"/>`;
        }
      }
    }
    x += width + between(random, 2, 12);
  }
  return markup;
}

function bulbsFor(random, x, base, height, width) {
  const colors = ['a', 'b', 'c'];
  return colors
    .map((color, index) => {
      const lift = (index + 1) / 4;
      const spread = (1 - lift) * (width / 2) * between(random, -0.7, 0.7);
      const delay = between(random, 0, 3);
      return `<circle class="bulb bulb-${color}" cx="${round(x + spread)}" cy="${round(base - height * lift)}" r="2.6" style="animation-delay:-${delay}s"/>`;
    })
    .join('');
}

function trees(random, lights) {
  return Array.from({ length: 16 }, (_, index) => {
    const x = round((index / 16) * VIEW_WIDTH + between(random, 0, 60));
    const base = between(random, 452, 470);
    const height = between(random, 26, 54);
    const width = round(height * 0.55);
    return (
      `<path class="tree" d="M${x} ${base}l${-width / 2} 0 ${width / 2} ${-height} ${width / 2} ${height}z"/>` +
      `<rect class="trunk" x="${x - 1.5}" y="${base}" width="3" height="8"/>` +
      (lights ? bulbsFor(lights, x, base, height, width) : '')
    );
  }).join('');
}

function birds(random) {
  return Array.from({ length: BIRD_COUNT }, () => {
    const y = between(random, 90, 220);
    const duration = between(random, 34, 52);
    const delay = between(random, 0, duration);
    return (
      `<g transform="translate(0 ${y})"><path class="bird" d="M0 0q6-8 12 0q6-8 12 0" ` +
      `style="animation-duration:${duration}s;animation-delay:-${delay}s"/></g>`
    );
  }).join('');
}

function lanterns() {
  return [960, 1020, 1080]
    .map((x, index) => {
      const drop = 44 + index * 14;
      return (
        `<g class="lantern-sway" style="transform-origin:${x}px 0;animation-delay:-${index * 1.3}s">` +
        `<path class="lantern-string" d="M${x} 0V${drop}"/>` +
        `<rect class="lantern-cap" x="${x - 9}" y="${drop}" width="18" height="6" rx="2"/>` +
        `<ellipse class="lantern" cx="${x}" cy="${drop + 24}" rx="17" ry="20"/>` +
        `<rect class="lantern-cap" x="${x - 9}" y="${drop + 42}" width="18" height="6" rx="2"/>` +
        `<path class="lantern-string" d="M${x} ${drop + 48}v14"/></g>`
      );
    })
    .join('');
}

function pumpkins(random) {
  return [0.14, 0.43, 0.8]
    .map((share) => {
      const x = round(share * VIEW_WIDTH + between(random, -20, 20));
      return (
        `<ellipse class="pumpkin" cx="${x}" cy="480" rx="17" ry="13"/>` +
        `<rect class="pumpkin-stem" x="${x - 2}" y="464" width="4" height="6" rx="1"/>`
      );
    })
    .join('');
}

function decorations(season, random) {
  if (season === 'halloween') {
    return { back: '', front: pumpkins(random) };
  }
  if (season === 'newyear') {
    return { back: lanterns(), front: '' };
  }
  return { back: '', front: '' };
}

function gradient(id, top, bottom) {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" style="stop-color:var(${top})"/><stop offset="1" style="stop-color:var(${bottom})"/></linearGradient>`
  );
}

function wrap(content, defs = '') {
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>${defs}</defs>${content}</svg>`;
}

export function isNightIcon(code) {
  return String(code).endsWith('n');
}

export function buildScene(theme, night, season = null) {
  const random = createRandom(SEED);
  const extras = decorations(season, createRandom(DECORATION_SEED));
  const hasStars = night && STAR_THEMES.has(theme);

  const back =
    (hasStars ? stars(random) : '') +
    (theme === 'clear-night' ? '<path class="meteor" d="M420 70l-70 26"/>' : '') +
    celestial(theme, night, season) +
    clouds(theme, random) +
    precipitation(theme, random) +
    '<g class="depth depth-hill">' +
    '<path class="hill-far" d="M-80 520V400H0C150 340 300 370 450 395S800 350 1000 385s150-5 200-15H1280V520z"/>' +
    skyline(random) +
    '</g>' +
    extras.back +
    (theme === 'clear-day' ? birds(createRandom(DECORATION_SEED + 1)) : '');

  const front =
    '<g class="depth depth-mid">' +
    '<path class="hill-mid" d="M-80 520V450H0C200 410 380 440 560 455S900 420 1200 445H1280V520z"/>' +
    trees(random, season === 'christmas' ? createRandom(DECORATION_SEED) : null) +
    '</g><g class="depth depth-near">' +
    '<path class="hill-near" d="M-80 520V485H0C250 460 450 490 700 480S1050 465 1200 482H1280V520z"/>' +
    extras.front +
    '</g>';

  const backDefs = gradient('cloud-fill', '--cloud', '--cloud-shade') + gradient('hill-far-fill', '--hill-far-light', '--hill-far');
  const frontDefs = gradient('hill-mid-fill', '--hill-mid-light', '--hill-mid') + gradient('hill-near-fill', '--hill-near-light', '--hill-near');

  return { back: wrap(back, backDefs), front: wrap(front, frontDefs) };
}
