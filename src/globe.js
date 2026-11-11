import { describeError } from './format.js';
import { t } from './i18n.js';
import { MAX_VIEW_LAT, clamp, latLonToScreen, normalizeLon, projectRaised, screenToLatLon, shortestLonDelta } from './globe-math.js';
import { renderGlobe } from './globe-renderer.js';
import { loadBaseTexture, loadCloudTexture, loadSatelliteTexture } from './globe-textures.js';
import { extrapolate, fetchIss } from './iss.js';
import { locationKey } from './location.js';
import { fetchQuakes } from './quakes.js';
import { subsolarPoint } from './sun.js';

const RADIUS_RATIO = 0.46;
const MAX_CANVAS_SIZE = 640;
const AUTO_ROTATE_DEG_PER_SEC = 6;
const IDLE_BEFORE_ROTATE_MS = 2500;
const FOCUS_MS = 900;
const KEY_STEP_DEG = 10;
const MAX_FRAME_MS = 100;
const SUN_REFRESH_MS = 60000;
const QUAKE_REFRESH_MS = 5 * 60 * 1000;
const CLOUD_REFRESH_MS = 10 * 60 * 1000;
const QUAKE_RECENT_MS = 60 * 60 * 1000;
const PULSE_MS = 2000;
const PULSE_FRAME_MS = 66;
const ISS_POLL_MS = 5000;
const ISS_TRAIL_MAX = 90;
const STAR_COUNT = 90;
const GRID_STEP_DEG = 15;
const QUAKE_PILLAR_PER_MAGNITUDE = 0.012;
const QUAKE_PILLAR_MAX = 0.12;
const ISS_ALTITUDE = 0.063;
const GRID_SAMPLE_DEG = 6;
const ISS_COLOR = '#7cf0ff';
const CLICK_MAX_DISTANCE_PX = 6;
const CLICK_MAX_MS = 600;
const MARKER_HIT_RADIUS = 14;
const CURRENT_COLOR = '#ff4d4f';
const INITIAL_CENTER = { centerLat: 20, centerLon: 121 };

const byId = (id) => document.getElementById(id);

export function initGlobe({ onPick, onSelect, loadCityTemps }) {
  const els = {
    card: byId('globe-card'),
    canvas: byId('globe'),
    rotate: byId('globe-rotate'),
    dayNight: byId('globe-daynight'),
    cities: byId('globe-cities'),
    quakes: byId('globe-quakes'),
    grid: byId('globe-grid'),
    iss: byId('globe-iss'),
    satellite: byId('globe-satellite'),
    clouds: byId('globe-clouds'),
    live: byId('globe-live'),
    focus: byId('globe-focus'),
    reload: byId('globe-reload'),
    status: byId('globe-status'),
  };
  const context = els.canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    view: { ...INITIAL_CENTER, radius: 0, sun: null },
    size: 0,
    image: null,
    texture: null,
    base: null,
    satellite: null,
    showSatellite: false,
    satelliteLoading: false,
    clouds: null,
    showClouds: false,
    depth: true,
    cloudsLoading: false,
    sun: subsolarPoint(new Date()),
    lastSunUpdate: 0,
    showDayNight: true,
    showCities: false,
    showQuakes: false,
    showGrid: false,
    showIss: false,
    iss: { previous: null, latest: null, trail: [], loading: false, lastPoll: -Infinity, failed: false },
    stars: null,
    scratch: null,
    hasRecentQuakes: false,
    quakesLoading: false,
    lastPulse: 0,
    lastSecond: 0,
    cityEntries: null,
    citiesLoading: false,
    quakes: null,
    autoRotate: !prefersReducedMotion,
    attempted: false,
    loading: false,
    visible: false,
    dirty: true,
    current: null,
    others: [],
    focus: null,
    drag: null,
    pointerStart: null,
    lastInteraction: -Infinity,
    lastFrame: 0,
    frameId: 0,
    status: null,
  };

  function renderStatus() {
    const { status } = state;
    if (!status) {
      els.status.hidden = true;
      return;
    }
    els.status.dataset.state = status.kind;
    els.status.textContent = status.error ? describeError(status.error) : t(status.key, status.params);
    els.status.hidden = false;
  }

  function setStatus(key, params, kind) {
    state.status = { key, params, kind };
    renderStatus();
  }

  function setErrorStatus(error) {
    state.status = { error, kind: 'error' };
    renderStatus();
  }

  function clearStatus() {
    state.status = null;
    renderStatus();
  }

  function setPressed(button, value) {
    button.setAttribute('aria-pressed', String(value));
  }

  function resize() {
    const cssSize = els.canvas.clientWidth;
    if (!cssSize) {
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(Math.min(cssSize * ratio, MAX_CANVAS_SIZE));
    if (size === state.size) {
      return;
    }
    els.canvas.width = size;
    els.canvas.height = size;
    state.size = size;
    state.view.radius = size * RADIUS_RATIO;
    state.image = context.createImageData(size, size);
    state.scratch = document.createElement('canvas');
    state.scratch.width = size;
    state.scratch.height = size;
    state.stars = createStars();
    state.dirty = true;
  }

  function createStars() {
    let seed = 12345;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    return Array.from({ length: STAR_COUNT }, () => ({ x: next(), y: next(), radius: 0.4 + next() * 1.1, alpha: 0.25 + next() * 0.65 }));
  }

  function drawStars(scale) {
    const wrap = (value) => ((value % 1) + 1) % 1;
    for (const star of state.stars) {
      const x = wrap(star.x - (state.view.centerLon / 360) * 0.2) * state.size;
      const y = wrap(star.y + (state.view.centerLat / 180) * 0.1) * state.size;
      context.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      context.fillRect(x, y, star.radius * scale, star.radius * scale);
    }
  }

  function project(lat, lon) {
    return latLonToScreen(lat, lon, state.view, state.size);
  }

  function drawLabel(text, x, y, scale, bold) {
    context.font = `${(bold ? 12 : 10.5) * scale}px system-ui, sans-serif`;
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = 3 * scale;
    context.strokeStyle = 'rgba(5, 10, 25, 0.85)';
    context.strokeText(text, x, y);
    context.fillStyle = '#ffffff';
    context.fillText(text, x, y);
  }

  function drawDot(x, y, radius, fill, stroke, strokeWidth) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = strokeWidth;
    context.strokeStyle = stroke;
    context.stroke();
  }

  function projectAt(lat, lon, altitude) {
    return projectRaised(lat, lon, altitude, state.view, state.size);
  }

  function strokeLine(from, to, style, width) {
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.strokeStyle = style;
    context.lineWidth = width;
    context.stroke();
  }

  function strokePath(points, style, width, altitude = 0) {
    context.beginPath();
    let drawing = false;
    for (const { lat, lon } of points) {
      const point = projectAt(lat, lon, altitude);
      if (!point.visible) {
        drawing = false;
      } else if (drawing) {
        context.lineTo(point.x, point.y);
      } else {
        context.moveTo(point.x, point.y);
        drawing = true;
      }
    }
    context.strokeStyle = style;
    context.lineWidth = width;
    context.stroke();
  }

  function drawGrid(scale) {
    if (!state.showGrid) {
      return;
    }
    const steps = (from, to) => Array.from({ length: (to - from) / GRID_SAMPLE_DEG + 1 }, (_, index) => from + index * GRID_SAMPLE_DEG);
    for (let lat = -90 + GRID_STEP_DEG; lat < 90; lat += GRID_STEP_DEG) {
      const style = lat === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.22)';
      strokePath(steps(-180, 180).map((lon) => ({ lat, lon })), style, scale);
    }
    for (let lon = -180; lon < 180; lon += GRID_STEP_DEG) {
      strokePath(steps(-90, 90).map((lat) => ({ lat, lon })), 'rgba(255, 255, 255, 0.22)', scale);
    }
  }

  function drawIss(scale) {
    const { latest, previous, trail } = state.iss;
    if (!state.showIss || !latest) {
      return;
    }
    const position = extrapolate(previous, latest, Date.now(), ISS_POLL_MS * 2);
    const altitude = state.depth ? ISS_ALTITUDE : 0;
    strokePath([...trail, position], 'rgba(124, 240, 255, 0.75)', 1.6 * scale, altitude);
    const point = projectAt(position.lat, position.lon, altitude);
    const ground = project(position.lat, position.lon);
    if (state.depth && point.visible && ground.visible) {
      strokeLine(ground, point, 'rgba(124, 240, 255, 0.45)', scale);
      drawDot(ground.x, ground.y, 2 * scale, 'rgba(124, 240, 255, 0.6)', 'rgba(5, 10, 25, 0.6)', scale);
    }
    if (point.visible) {
      context.beginPath();
      context.arc(point.x, point.y, 9 * scale, 0, Math.PI * 2);
      context.strokeStyle = 'rgba(124, 240, 255, 0.5)';
      context.lineWidth = scale;
      context.stroke();
      drawDot(point.x, point.y, 4.5 * scale, ISS_COLOR, '#ffffff', 1.5 * scale);
      drawLabel('ISS', point.x + 12 * scale, point.y - 8 * scale, scale, true);
    }
  }

  function isRecent({ time }) {
    return time !== null && Date.now() - time < QUAKE_RECENT_MS;
  }

  function drawQuakes(scale) {
    if (!state.showQuakes || !state.quakes) {
      return;
    }
    const phase = prefersReducedMotion ? 0.5 : (performance.now() % PULSE_MS) / PULSE_MS;
    for (const quake of state.quakes.items) {
      const ground = project(quake.lat, quake.lon);
      if (ground.visible) {
        const height = state.depth ? clamp(quake.mag * QUAKE_PILLAR_PER_MAGNITUDE, 0, QUAKE_PILLAR_MAX) : 0;
        const point = projectAt(quake.lat, quake.lon, height);
        const radius = clamp((quake.mag - 1.5) * (state.depth ? 1.6 : 2.4), 2, state.depth ? 9 : 14) * scale;
        if (state.depth) {
          strokeLine(ground, point, 'rgba(255, 190, 80, 0.8)', 1.5 * scale);
          drawDot(ground.x, ground.y, 1.8 * scale, 'rgba(255, 225, 130, 0.9)', 'rgba(5, 10, 25, 0.6)', scale);
        }
        drawDot(point.x, point.y, radius, 'rgba(255, 140, 0, 0.55)', 'rgba(255, 225, 130, 0.95)', scale);
        if (isRecent(quake)) {
          context.beginPath();
          context.arc(point.x, point.y, radius + phase * 12 * scale, 0, Math.PI * 2);
          context.strokeStyle = `rgba(255, 225, 130, ${1 - phase})`;
          context.lineWidth = 1.5 * scale;
          context.stroke();
        }
      }
    }
  }

  function drawCities(scale) {
    if (!state.showCities || !state.cityEntries) {
      return;
    }
    for (const { lat, lon, label } of state.cityEntries) {
      const point = project(lat, lon);
      if (point.visible) {
        drawDot(point.x, point.y, 2.5 * scale, '#ffffff', 'rgba(5, 10, 25, 0.85)', scale);
        drawLabel(label, point.x + 6 * scale, point.y, scale, false);
      }
    }
  }

  function markerTargets() {
    const targets = state.others.map((location) => ({ location, current: false }));
    if (state.current) {
      targets.push({ location: state.current, current: true });
    }
    return targets
      .map((target) => ({ ...target, point: project(target.location.lat, target.location.lon) }))
      .filter(({ point }) => point.visible);
  }

  function drawMarkers(scale) {
    for (const { location, current, point } of markerTargets()) {
      if (current) {
        drawDot(point.x, point.y, 7 * scale, CURRENT_COLOR, '#ffffff', 2.5 * scale);
        drawLabel(location.name, point.x + 11 * scale, point.y - 9 * scale, scale, true);
      } else {
        drawDot(point.x, point.y, 4.5 * scale, '#ffffff', 'rgba(5, 10, 25, 0.85)', 1.5 * scale);
        drawLabel(location.name, point.x + 8 * scale, point.y, scale, false);
      }
    }
  }

  function draw() {
    if (!state.texture || !state.image) {
      return;
    }
    state.view.sun = state.showDayNight ? state.sun : null;
    state.view.depth = state.depth;
    state.view.clouds = state.showClouds && state.clouds ? state.clouds.texture : null;
    renderGlobe(state.image, state.texture, state.view);
    state.scratch.getContext('2d').putImageData(state.image, 0, 0);

    const scale = state.size / 360;
    context.clearRect(0, 0, state.size, state.size);
    drawStars(scale);
    context.drawImage(state.scratch, 0, 0);
    drawGrid(scale);
    drawQuakes(scale);
    drawIss(scale);
    drawCities(scale);
    drawMarkers(scale);
  }

  function advanceFocus(now) {
    const { from, to, lonDelta, start } = state.focus;
    const progress = clamp((now - start) / FOCUS_MS, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    state.view.centerLat = from.lat + (to.lat - from.lat) * eased;
    state.view.centerLon = normalizeLon(from.lon + lonDelta * eased);
    state.dirty = true;
    if (progress === 1) {
      state.focus = null;
    }
  }

  function formatCoordinate(value, positive, negative) {
    return `${Math.abs(value).toFixed(1)}°${value >= 0 ? positive : negative}`;
  }

  function renderLive() {
    const now = new Date();
    const sun = subsolarPoint(now);
    const items = [
      t('globe.liveClock', { time: now.toISOString().slice(11, 19) }),
      t('globe.sunPoint', { lat: formatCoordinate(sun.lat, 'N', 'S'), lon: formatCoordinate(sun.lon, 'E', 'W') }),
    ];
    const { latest } = state.iss;
    if (state.showIss && latest && latest.altitude !== null && latest.velocity !== null) {
      items.push(t('globe.issInfo', { altitude: Math.round(latest.altitude), speed: Math.round(latest.velocity).toLocaleString('en-US') }));
    }
    els.live.replaceChildren(
      ...items.map((text) => {
        const item = document.createElement('span');
        item.textContent = text;
        return item;
      })
    );
  }

  async function pollIss() {
    const { iss } = state;
    if (iss.loading) {
      return;
    }
    iss.loading = true;
    iss.lastPoll = performance.now();
    try {
      const sample = await fetchIss();
      iss.previous = iss.latest;
      iss.latest = sample;
      iss.trail.push({ lat: sample.lat, lon: sample.lon });
      if (iss.trail.length > ISS_TRAIL_MAX) {
        iss.trail.shift();
      }
      if (iss.failed) {
        iss.failed = false;
        clearStatus();
      }
      state.dirty = true;
      renderLive();
    } catch (error) {
      iss.failed = true;
      setErrorStatus(error);
    } finally {
      iss.loading = false;
    }
  }

  function tickLive(now) {
    const second = Math.floor(Date.now() / 1000);
    if (second !== state.lastSecond) {
      state.lastSecond = second;
      renderLive();
      if (state.showIss) {
        state.dirty = true;
      }
    }
    if (state.showIss && now - state.iss.lastPoll > ISS_POLL_MS) {
      pollIss();
    }
    if (state.showQuakes && state.hasRecentQuakes && !prefersReducedMotion && now - state.lastPulse > PULSE_FRAME_MS) {
      state.lastPulse = now;
      state.dirty = true;
    }
    if (state.showQuakes && state.quakes && Date.now() - state.quakes.loadedAt > QUAKE_REFRESH_MS) {
      loadQuakes(true);
    }
    if (state.showClouds && state.clouds && Date.now() - state.clouds.loadedAt > CLOUD_REFRESH_MS) {
      loadClouds(true);
    }
  }

  function frame(now) {
    state.frameId = 0;
    if (!state.visible) {
      return;
    }

    const delta = Math.min(now - state.lastFrame, MAX_FRAME_MS);
    state.lastFrame = now;

    if (now - state.lastSunUpdate > SUN_REFRESH_MS) {
      state.sun = subsolarPoint(new Date());
      state.lastSunUpdate = now;
      state.dirty = true;
    }

    tickLive(now);

    if (state.focus) {
      advanceFocus(now);
    } else if (state.autoRotate && !state.drag && now - state.lastInteraction > IDLE_BEFORE_ROTATE_MS) {
      state.view.centerLon = normalizeLon(state.view.centerLon + (AUTO_ROTATE_DEG_PER_SEC * delta) / 1000);
      state.dirty = true;
    }

    if (state.dirty) {
      draw();
      state.dirty = false;
    }
    schedule();
  }

  function schedule() {
    if (!state.frameId && state.visible) {
      state.frameId = requestAnimationFrame(frame);
    }
  }

  function setAutoRotate(value) {
    state.autoRotate = value;
    setPressed(els.rotate, value);
  }

  function focusOn({ lat, lon }) {
    const target = { lat: clamp(lat, -MAX_VIEW_LAT, MAX_VIEW_LAT), lon };
    setAutoRotate(false);

    if (!state.visible) {
      state.view.centerLat = target.lat;
      state.view.centerLon = normalizeLon(target.lon);
      state.dirty = true;
      return;
    }

    state.focus = {
      from: { lat: state.view.centerLat, lon: state.view.centerLon },
      to: target,
      lonDelta: shortestLonDelta(state.view.centerLon, target.lon),
      start: performance.now(),
    };
  }

  function rotateBy(lonDegrees, latDegrees) {
    state.view.centerLon = normalizeLon(state.view.centerLon + lonDegrees);
    state.view.centerLat = clamp(state.view.centerLat + latDegrees, -MAX_VIEW_LAT, MAX_VIEW_LAT);
    state.lastInteraction = performance.now();
    state.focus = null;
    state.dirty = true;
  }

  function applyTexture() {
    state.texture = state.showSatellite && state.satellite ? state.satellite.texture : state.base;
    state.dirty = true;
  }

  function showCloudsReady() {
    const time = new Date(state.clouds.loadedAt).toISOString().slice(11, 16);
    setStatus('globe.cloudsReady', { time }, 'ready');
  }

  async function loadClouds(silent) {
    if (state.cloudsLoading) {
      return;
    }
    state.cloudsLoading = true;
    if (!silent) {
      setStatus('globe.cloudsLoading', {}, 'loading');
    }
    try {
      state.clouds = await loadCloudTexture(window.OPENWEATHER_API_KEY);
      if (state.showClouds) {
        applyTexture();
        if (!silent) {
          showCloudsReady();
        }
      }
    } catch (error) {
      if (!silent) {
        state.showClouds = false;
        setPressed(els.clouds, false);
        applyTexture();
        setErrorStatus(error);
      }
    } finally {
      state.cloudsLoading = false;
    }
  }

  async function loadSatellite() {
    if (state.satelliteLoading || !state.base) {
      return;
    }
    state.satelliteLoading = true;
    setStatus('globe.satelliteLoading', {}, 'loading');
    try {
      state.satellite = await loadSatelliteTexture(state.base);
      if (state.showSatellite) {
        applyTexture();
        setStatus('globe.satelliteReady', { date: state.satellite.date }, 'ready');
      }
    } catch (error) {
      state.showSatellite = false;
      setPressed(els.satellite, false);
      applyTexture();
      setErrorStatus(error);
    } finally {
      state.satelliteLoading = false;
    }
  }

  async function load() {
    if (state.loading) {
      return;
    }
    state.attempted = true;
    state.loading = true;
    els.reload.disabled = true;
    setStatus('globe.loading', {}, 'loading');

    try {
      state.base = await loadBaseTexture();
      state.satellite = null;
      applyTexture();
      els.satellite.disabled = false;
      els.clouds.disabled = false;
      clearStatus();
      if (state.showSatellite) {
        loadSatellite();
      }
      if (state.showClouds) {
        loadClouds(false);
      }
    } catch (error) {
      setErrorStatus(error);
    } finally {
      state.loading = false;
      els.reload.disabled = false;
    }
  }

  async function loadQuakes(silent = false) {
    if (state.quakesLoading) {
      return;
    }
    state.quakesLoading = true;
    if (!silent) {
      setStatus('globe.quakesLoading', {}, 'loading');
    }
    try {
      const items = await fetchQuakes();
      state.quakes = { items, loadedAt: Date.now() };
      state.hasRecentQuakes = items.some(isRecent);
      state.dirty = true;
      if (state.showQuakes) {
        setStatus('globe.quakesCount', { count: items.length }, 'ready');
      }
    } catch (error) {
      if (!silent) {
        setErrorStatus(error);
      } else if (state.quakes) {
        state.quakes.loadedAt = Date.now();
      }
    } finally {
      state.quakesLoading = false;
    }
  }

  async function loadCities() {
    if (state.citiesLoading) {
      return;
    }
    state.citiesLoading = true;
    setStatus('globe.citiesLoading', {}, 'loading');
    try {
      state.cityEntries = await loadCityTemps();
      state.dirty = true;
      clearStatus();
    } catch (error) {
      setErrorStatus(error);
    } finally {
      state.citiesLoading = false;
    }
  }

  function handleClick(event) {
    const rect = els.canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) * els.canvas.width) / rect.width;
    const py = ((event.clientY - rect.top) * els.canvas.height) / rect.height;
    const hitRadius = MARKER_HIT_RADIUS * (state.size / 360);

    const hit = markerTargets().find(({ point }) => Math.hypot(point.x - px, point.y - py) <= hitRadius);
    if (hit) {
      onSelect(hit.location);
      return;
    }

    const picked = screenToLatLon(px, py, state.view, state.size);
    if (picked) {
      onPick(picked.lat, picked.lon);
    }
  }

  els.canvas.addEventListener('pointerdown', (event) => {
    els.canvas.setPointerCapture(event.pointerId);
    state.drag = { x: event.clientX, y: event.clientY };
    state.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    state.focus = null;
    els.canvas.classList.add('is-dragging');
  });

  els.canvas.addEventListener('pointermove', (event) => {
    if (!state.drag) {
      return;
    }
    const degreesPerPixel = 180 / (Math.PI * els.canvas.clientWidth * RADIUS_RATIO);
    rotateBy(-(event.clientX - state.drag.x) * degreesPerPixel, (event.clientY - state.drag.y) * degreesPerPixel);
    state.drag = { x: event.clientX, y: event.clientY };
  });

  function endDrag() {
    state.drag = null;
    state.lastInteraction = performance.now();
    els.canvas.classList.remove('is-dragging');
  }

  els.canvas.addEventListener('pointerup', (event) => {
    const start = state.pointerStart;
    endDrag();
    state.pointerStart = null;
    if (!start) {
      return;
    }
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved <= CLICK_MAX_DISTANCE_PX && performance.now() - start.time <= CLICK_MAX_MS) {
      handleClick(event);
    }
  });

  els.canvas.addEventListener('pointercancel', () => {
    endDrag();
    state.pointerStart = null;
  });

  els.canvas.addEventListener('keydown', (event) => {
    const steps = {
      ArrowLeft: [-KEY_STEP_DEG, 0],
      ArrowRight: [KEY_STEP_DEG, 0],
      ArrowUp: [0, KEY_STEP_DEG],
      ArrowDown: [0, -KEY_STEP_DEG],
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      rotateBy(...step);
    }
  });

  els.rotate.addEventListener('click', () => setAutoRotate(!state.autoRotate));

  els.dayNight.addEventListener('click', () => {
    state.showDayNight = !state.showDayNight;
    setPressed(els.dayNight, state.showDayNight);
    state.dirty = true;
  });

  els.cities.addEventListener('click', () => {
    state.showCities = !state.showCities;
    setPressed(els.cities, state.showCities);
    state.dirty = true;
    if (!state.showCities) {
      clearStatus();
    } else if (!state.cityEntries) {
      loadCities();
    }
  });

  els.quakes.addEventListener('click', () => {
    state.showQuakes = !state.showQuakes;
    setPressed(els.quakes, state.showQuakes);
    state.dirty = true;
    if (!state.showQuakes) {
      clearStatus();
    } else if (!state.quakes || Date.now() - state.quakes.loadedAt > QUAKE_REFRESH_MS) {
      loadQuakes();
    } else {
      setStatus('globe.quakesCount', { count: state.quakes.items.length }, 'ready');
    }
  });

  els.satellite.addEventListener('click', () => {
    state.showSatellite = !state.showSatellite;
    setPressed(els.satellite, state.showSatellite);
    if (!state.showSatellite) {
      applyTexture();
      clearStatus();
    } else if (state.satellite) {
      applyTexture();
      setStatus('globe.satelliteReady', { date: state.satellite.date }, 'ready');
    } else {
      loadSatellite();
    }
  });

  els.clouds.addEventListener('click', () => {
    state.showClouds = !state.showClouds;
    setPressed(els.clouds, state.showClouds);
    if (!state.showClouds) {
      applyTexture();
      clearStatus();
    } else if (state.clouds) {
      applyTexture();
      showCloudsReady();
      if (Date.now() - state.clouds.loadedAt > CLOUD_REFRESH_MS) {
        loadClouds(true);
      }
    } else {
      loadClouds(false);
    }
  });

  els.grid.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    setPressed(els.grid, state.showGrid);
    state.dirty = true;
  });

  els.iss.addEventListener('click', () => {
    state.showIss = !state.showIss;
    setPressed(els.iss, state.showIss);
    state.dirty = true;
    if (state.showIss) {
      state.iss = { previous: null, latest: null, trail: [], loading: false, lastPoll: -Infinity, failed: false };
    } else if (state.iss.failed) {
      state.iss.failed = false;
      clearStatus();
    }
    renderLive();
  });

  els.focus.addEventListener('click', () => {
    if (state.current) {
      focusOn(state.current);
    }
  });

  els.reload.addEventListener('click', () => {
    load();
    if (state.showQuakes) {
      loadQuakes();
    }
    if (state.showCities) {
      state.cityEntries = null;
      loadCities();
    }
  });

  new ResizeObserver(resize).observe(els.canvas);

  new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    if (!state.visible) {
      return;
    }
    resize();
    state.lastFrame = performance.now();
    state.dirty = true;
    schedule();
    if (!state.attempted) {
      load();
    }
  }).observe(els.card);

  setAutoRotate(state.autoRotate);
  setPressed(els.dayNight, state.showDayNight);
  setPressed(els.cities, state.showCities);
  setPressed(els.quakes, state.showQuakes);
  setPressed(els.satellite, state.showSatellite);
  setPressed(els.clouds, state.showClouds);
  setPressed(els.grid, state.showGrid);
  setPressed(els.iss, state.showIss);
  renderLive();

  return {
    setCurrent(location) {
      state.current = location;
      els.focus.disabled = false;
      state.others = state.others.filter((entry) => locationKey(entry) !== locationKey(location));
      focusOn(location);
    },
    setDepth(enabled) {
      state.depth = enabled;
      state.dirty = true;
    },
    setOthers(locations) {
      const currentKey = state.current ? locationKey(state.current) : null;
      state.others = locations.filter((entry) => locationKey(entry) !== currentKey);
      state.dirty = true;
    },
    refreshCityTemps() {
      state.cityEntries = null;
      if (state.showCities) {
        loadCities();
      }
    },
    translate() {
      renderStatus();
      renderLive();
    },
  };
}
