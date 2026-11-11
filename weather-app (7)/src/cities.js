export const GLOBAL_CITIES = [
  { name: { zh: '台北', en: 'Taipei' }, lat: 25.03, lon: 121.56 },
  { name: { zh: '東京', en: 'Tokyo' }, lat: 35.68, lon: 139.69 },
  { name: { zh: '雪梨', en: 'Sydney' }, lat: -33.87, lon: 151.21 },
  { name: { zh: '孟買', en: 'Mumbai' }, lat: 19.08, lon: 72.88 },
  { name: { zh: '杜拜', en: 'Dubai' }, lat: 25.2, lon: 55.27 },
  { name: { zh: '莫斯科', en: 'Moscow' }, lat: 55.76, lon: 37.62 },
  { name: { zh: '倫敦', en: 'London' }, lat: 51.51, lon: -0.13 },
  { name: { zh: '開羅', en: 'Cairo' }, lat: 30.04, lon: 31.24 },
  { name: { zh: '開普敦', en: 'Cape Town' }, lat: -33.92, lon: 18.42 },
  { name: { zh: '聖保羅', en: 'São Paulo' }, lat: -23.55, lon: -46.63 },
  { name: { zh: '紐約', en: 'New York' }, lat: 40.71, lon: -74.01 },
  { name: { zh: '洛杉磯', en: 'Los Angeles' }, lat: 34.05, lon: -118.24 },
];

const EXAMPLE_NAMES = ['Taipei', 'Tokyo', 'London', 'New York'];

export const EXAMPLE_CITIES = GLOBAL_CITIES.filter((city) => EXAMPLE_NAMES.includes(city.name.en));
