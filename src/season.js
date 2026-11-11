const DAY_MS = 86400000;
const LUNAR_NEW_YEAR = ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'];
const MID_AUTUMN = ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12'];
const NEW_YEAR_WINDOW = { before: 3, after: 10 };
const MID_AUTUMN_WINDOW = { before: 2, after: 2 };
const CHRISTMAS_FIRST_DAY = 18;
const CHRISTMAS_LAST_DAY = 26;
const HALLOWEEN_FIRST_DAY = 24;

function daysSince(date, iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today - Date.UTC(year, month - 1, day)) / DAY_MS);
}

function isNear(date, festivals, { before, after }) {
  return festivals.some((iso) => {
    const offset = daysSince(date, iso);
    return offset >= -before && offset <= after;
  });
}

export function seasonFor(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 12 && day >= CHRISTMAS_FIRST_DAY && day <= CHRISTMAS_LAST_DAY) {
    return 'christmas';
  }
  if (month === 10 && day >= HALLOWEEN_FIRST_DAY) {
    return 'halloween';
  }
  if (isNear(date, LUNAR_NEW_YEAR, NEW_YEAR_WINDOW)) {
    return 'newyear';
  }
  if (isNear(date, MID_AUTUMN, MID_AUTUMN_WINDOW)) {
    return 'midautumn';
  }
  return null;
}
