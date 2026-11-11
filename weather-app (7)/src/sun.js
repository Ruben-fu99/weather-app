import { normalizeLon } from './globe-math.js';

const MS_PER_DAY = 86400000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DEG = Math.PI / 180;

export function subsolarPoint(date) {
  const days = (date.getTime() - J2000_MS) / MS_PER_DAY;
  const meanLongitude = 280.46 + 0.9856474 * days;
  const meanAnomaly = (357.528 + 0.9856003 * days) * DEG;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * DEG;
  const obliquity = (23.439 - 0.0000004 * days) * DEG;

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude)
  );
  const greenwichSiderealDegrees = 280.46061837 + 360.98564736629 * days;

  return {
    lat: declination / DEG,
    lon: normalizeLon(rightAscension / DEG - greenwichSiderealDegrees),
  };
}
