const POINTER_EASING = 0.12;
const SETTLE_THRESHOLD = 0.002;
const TILT_DEGREES = 2.5;
const TILT_RESET = '0deg';
const TILT_GAMMA_RANGE = 30;
const TILT_BETA_REST = 45;

function clampUnit(value) {
  return Math.min(1, Math.max(-1, value));
}

function createParallax(sky, isEnabled) {
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = null;

  function step() {
    currentX += (targetX - currentX) * POINTER_EASING;
    currentY += (targetY - currentY) * POINTER_EASING;
    sky.style.setProperty('--px', currentX.toFixed(3));
    sky.style.setProperty('--py', currentY.toFixed(3));
    const settled = Math.abs(targetX - currentX) < SETTLE_THRESHOLD && Math.abs(targetY - currentY) < SETTLE_THRESHOLD;
    frame = settled ? null : requestAnimationFrame(step);
  }

  function aim(x, y) {
    targetX = clampUnit(x);
    targetY = clampUnit(y);
    if (frame === null) {
      frame = requestAnimationFrame(step);
    }
  }

  sky.addEventListener('pointermove', (event) => {
    if (!isEnabled() || event.pointerType === 'touch') {
      return;
    }
    const box = sky.getBoundingClientRect();
    aim(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1);
  });
  sky.addEventListener('pointerleave', () => aim(0, 0));
  window.addEventListener('deviceorientation', (event) => {
    if (isEnabled() && event.gamma !== null && event.beta !== null) {
      aim(event.gamma / TILT_GAMMA_RANGE, (event.beta - TILT_BETA_REST) / TILT_GAMMA_RANGE);
    }
  });

  return () => aim(0, 0);
}

function createTilt(root, isEnabled) {
  root.addEventListener('pointermove', (event) => {
    if (!isEnabled() || event.pointerType !== 'mouse') {
      return;
    }
    const panel = event.target.closest('.panel:not(.panel-flat)');
    if (!panel || !root.contains(panel)) {
      return;
    }
    const box = panel.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = ((event.clientY - box.top) / box.height) * 2 - 1;
    panel.style.setProperty('--tilt-x', `${(-y * TILT_DEGREES).toFixed(2)}deg`);
    panel.style.setProperty('--tilt-y', `${(x * TILT_DEGREES).toFixed(2)}deg`);
    panel.dataset.tilting = '';
  });
  root.addEventListener('pointerout', (event) => {
    const panel = event.target.closest('.panel');
    if (panel && !panel.contains(event.relatedTarget)) {
      panel.style.setProperty('--tilt-x', TILT_RESET);
      panel.style.setProperty('--tilt-y', TILT_RESET);
      delete panel.dataset.tilting;
    }
  });
}

export function initDepth(sky, layout, enabled = true) {
  let active = enabled;
  let recenter = () => undefined;

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    recenter = createParallax(sky, () => active);
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      createTilt(layout, () => active);
    }
  }

  function setEnabled(value) {
    active = value;
    document.documentElement.dataset.depth = value ? 'on' : 'off';
    if (!value) {
      recenter();
    }
  }

  setEnabled(enabled);
  return { setEnabled };
}
