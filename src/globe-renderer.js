const TWO_PI = Math.PI * 2;
const SHADE_MIN = 0.5;
const NIGHT_LIGHT = 0.3;
const TWILIGHT = 0.12;
const ATMOSPHERE_THICKNESS = 0.07;
const ATMOSPHERE_ALPHA = 0.65;
const ATMOSPHERE_COLOR = [110, 170, 255];
const LIMB_TINT = 0.35;
const GLOW_FLOOR = 0.15;
const GLOW_REACH = 0.3;
const OCEAN_MARGIN = 25;
const OCEAN_RANGE = 50;
const SPECULAR_POWER = 48;
const SPECULAR_STRENGTH = 0.55;
const CLOUD_SHELL = 1.03;
const FLAT_SHELL = 1.001;
const CLOUD_OPACITY = 0.92;
const CLOUD_NIGHT_LIGHT = 0.16;
const CLOUD_SHADOW = 0.42;
const CLOUD_BRIGHTNESS = 250;

function wrapIndex(index, length) {
  return ((index % length) + length) % length;
}

function smoothRamp(value) {
  const ramp = Math.min(1, Math.max(0, value));
  return ramp * ramp * (3 - 2 * ramp);
}

function sampleAlpha(texture, lat, lon) {
  const { width, height, data } = texture;
  const u = (lon / TWO_PI + 0.5) * width - 0.5;
  const v = (0.5 - lat / Math.PI) * height - 0.5;
  const u0 = Math.floor(u);
  const v0 = Math.floor(v);
  const fx = u - u0;
  const fy = v - v0;
  const xa = wrapIndex(u0, width);
  const xb = wrapIndex(u0 + 1, width);
  const ya = Math.min(Math.max(v0, 0), height - 1);
  const yb = Math.min(Math.max(v0 + 1, 0), height - 1);
  const top = data[(ya * width + xa) * 4 + 3] * (1 - fx) + data[(ya * width + xb) * 4 + 3] * fx;
  const bottom = data[(yb * width + xa) * 4 + 3] * (1 - fx) + data[(yb * width + xb) * 4 + 3] * fx;
  return ((top * (1 - fy) + bottom * fy) / 255) * CLOUD_OPACITY;
}

export function renderGlobe(image, texture, view) {
  const { width, height, data } = image;
  const { width: textureWidth, height: textureHeight, data: texels } = texture;
  const { centerLat, centerLon, radius, sun, clouds } = view;
  const raised = view.depth !== false;
  const shell = raised ? CLOUD_SHELL : FLAT_SHELL;
  const shellSquared = shell * shell;
  const lat0 = (centerLat * Math.PI) / 180;
  const lon0 = (centerLon * Math.PI) / 180;
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const lastRow = textureHeight - 1;

  const sunLat = sun ? (sun.lat * Math.PI) / 180 : 0;
  const sunSin = Math.sin(sunLat);
  const sunCos = Math.cos(sunLat);
  const lonOffset = sun ? lon0 - (sun.lon * Math.PI) / 180 : 0;
  const cosOffset = Math.cos(lonOffset);
  const sinOffset = Math.sin(lonOffset);

  const sunViewX = sunCos * -sinOffset;
  const sunViewY = cosLat0 * sunSin - sinLat0 * sunCos * cosOffset;
  const sunViewZ = sinLat0 * sunSin + cosLat0 * sunCos * cosOffset;
  const halfLength = Math.hypot(sunViewX, sunViewY, sunViewZ + 1) || 1;
  const halfX = sunViewX / halfLength;
  const halfY = sunViewY / halfLength;
  const halfZ = (sunViewZ + 1) / halfLength;

  function sunDotAt(x, eastward, sinLat) {
    const hypotenuse = Math.hypot(x, eastward) || 1;
    const cosDelta = (cosOffset * eastward - sinOffset * x) / hypotenuse;
    return Math.sqrt(1 - sinLat * sinLat) * sunCos * cosDelta + sinLat * sunSin;
  }

  function shellCoverage(nx, ny, nz) {
    const sinLat = nz * sinLat0 + ny * cosLat0;
    const eastward = cosLat0 * nz - ny * sinLat0;
    return {
      alpha: sampleAlpha(clouds, Math.asin(Math.min(1, Math.max(-1, sinLat))), lon0 + Math.atan2(nx, eastward)),
      sinLat,
      eastward,
    };
  }

  function shadowCoverage(x, y, z) {
    const along = x * sunViewX + y * sunViewY + z * sunViewZ;
    const distance = -along + Math.sqrt(along * along - 1 + shellSquared);
    return shellCoverage(
      (x + distance * sunViewX) / shell,
      (y + distance * sunViewY) / shell,
      (z + distance * sunViewZ) / shell
    ).alpha;
  }

  function overlayClouds(offset, x, y, rho2) {
    if (rho2 >= shellSquared) {
      return;
    }
    const nx = x / shell;
    const ny = y / shell;
    const nz = Math.sqrt(shellSquared - rho2) / shell;
    const { alpha, sinLat, eastward } = shellCoverage(nx, ny, nz);
    const coverage = alpha * Math.min(1, (shell - Math.sqrt(rho2)) * radius);
    if (coverage <= 0) {
      return;
    }
    let lit = 1;
    if (sun) {
      lit = CLOUD_NIGHT_LIGHT + (1 - CLOUD_NIGHT_LIGHT) * smoothRamp((sunDotAt(nx, eastward, sinLat) + TWILIGHT) / (2 * TWILIGHT));
    }
    const base = data[offset + 3] / 255;
    const outAlpha = coverage + base * (1 - coverage);
    const brightness = CLOUD_BRIGHTNESS * lit;
    for (let channel = 0; channel < 3; channel += 1) {
      data[offset + channel] = (brightness * coverage + data[offset + channel] * base * (1 - coverage)) / outAlpha;
    }
    data[offset + 3] = outAlpha * 255;
  }

  for (let py = 0; py < height; py += 1) {
    const y = (halfHeight - (py + 0.5)) / radius;

    for (let px = 0; px < width; px += 1) {
      const x = (px + 0.5 - halfWidth) / radius;
      const rho2 = x * x + y * y;
      const offset = (py * width + px) * 4;

      if (rho2 >= 1) {
        const rho = Math.sqrt(rho2);
        const reach = (rho - 1) / ATMOSPHERE_THICKNESS;
        if (reach >= 1) {
          data[offset + 3] = 0;
          continue;
        }
        let glow = 1;
        if (sun) {
          const limbX = x / rho;
          const limbY = y / rho;
          const dot = sunDotAt(limbX, -limbY * sinLat0, limbY * cosLat0);
          glow = GLOW_FLOOR + (1 - GLOW_FLOOR) * smoothRamp((dot + GLOW_REACH) / (1 + GLOW_REACH));
        }
        data[offset] = ATMOSPHERE_COLOR[0];
        data[offset + 1] = ATMOSPHERE_COLOR[1];
        data[offset + 2] = ATMOSPHERE_COLOR[2];
        data[offset + 3] = (1 - reach) ** 2 * ATMOSPHERE_ALPHA * glow * 255;
        if (clouds) {
          overlayClouds(offset, x, y, rho2);
        }
        continue;
      }

      const cosC = Math.sqrt(1 - rho2);
      const sinLat = cosC * sinLat0 + y * cosLat0;
      const lat = Math.asin(sinLat);
      const eastward = cosLat0 * cosC - y * sinLat0;
      const lon = lon0 + Math.atan2(x, eastward);

      let light = 1;
      let sunDot = 1;
      if (sun) {
        sunDot = sunDotAt(x, eastward, sinLat);
        light = NIGHT_LIGHT + (1 - NIGHT_LIGHT) * smoothRamp((sunDot + TWILIGHT) / (2 * TWILIGHT));
      }

      const u = (lon / TWO_PI + 0.5) * textureWidth - 0.5;
      const v = (0.5 - lat / Math.PI) * textureHeight - 0.5;
      const u0 = Math.floor(u);
      const v0 = Math.floor(v);
      const fx = u - u0;
      const fy = v - v0;
      const xa = wrapIndex(u0, textureWidth);
      const xb = wrapIndex(u0 + 1, textureWidth);
      const ya = Math.min(Math.max(v0, 0), lastRow);
      const yb = Math.min(Math.max(v0 + 1, 0), lastRow);

      const topLeft = (ya * textureWidth + xa) * 4;
      const topRight = (ya * textureWidth + xb) * 4;
      const bottomLeft = (yb * textureWidth + xa) * 4;
      const bottomRight = (yb * textureWidth + xb) * 4;
      const shade = (SHADE_MIN + (1 - SHADE_MIN) * cosC) * light;
      const limb = (1 - cosC) ** 3 * LIMB_TINT * (sun ? GLOW_FLOOR + (1 - GLOW_FLOOR) * light : 1);
      const edgeAlpha = Math.min(1, (1 - Math.sqrt(rho2)) * radius);

      const color = [0, 0, 0];
      for (let channel = 0; channel < 3; channel += 1) {
        const top = texels[topLeft + channel] * (1 - fx) + texels[topRight + channel] * fx;
        const bottom = texels[bottomLeft + channel] * (1 - fx) + texels[bottomRight + channel] * fx;
        color[channel] = top * (1 - fy) + bottom * fy;
      }

      let specular = 0;
      if (sun) {
        const ocean = smoothRamp((color[2] - color[0] - OCEAN_MARGIN) / OCEAN_RANGE) * (color[2] > color[1] ? 1 : 0);
        const alignment = Math.max(0, x * halfX + y * halfY + cosC * halfZ);
        specular = ocean * alignment ** SPECULAR_POWER * SPECULAR_STRENGTH * smoothRamp(sunDot / TWILIGHT) * 255;
      }

      let shadow = 1;
      if (clouds && raised && sun && sunDot > 0) {
        shadow = 1 - CLOUD_SHADOW * shadowCoverage(x, y, cosC) * smoothRamp(sunDot / TWILIGHT);
      }

      for (let channel = 0; channel < 3; channel += 1) {
        const shaded = color[channel] * shade * shadow;
        data[offset + channel] = shaded * (1 - limb) + ATMOSPHERE_COLOR[channel] * limb + specular;
      }
      data[offset + 3] = edgeAlpha * 255;
      if (clouds) {
        overlayClouds(offset, x, y, rho2);
      }
    }
  }
}
