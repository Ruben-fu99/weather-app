const FORECAST_WINDOW = 4;
const RAIN_CHANCE_THRESHOLD = 0.4;
const STRONG_WIND_MS = 10;
const EXERCISE_WIND_MS = 8;
const MPH_TO_MS = 0.44704;

function fahrenheitToCelsius(value) {
  return ((value - 32) * 5) / 9;
}

function coatAdvice(feelsLike) {
  if (feelsLike <= 10) {
    return feelsLike <= 3 ? 'coat.freezing' : 'coat.cold';
  }
  if (feelsLike < 18) {
    return 'coat.cool';
  }
  if (feelsLike < 24) {
    return 'coat.mild';
  }
  return feelsLike < 31 ? 'coat.warm' : 'coat.hot';
}

export function adviceInputs({ current, forecast, air }, units) {
  const toCelsius = units === 'imperial' ? fahrenheitToCelsius : (value) => value;
  const upcoming = forecast?.list?.slice(0, FORECAST_WINDOW) ?? [];

  return {
    temp: toCelsius(current.main.temp),
    feelsLike: toCelsius(current.main.feels_like),
    humidity: current.main.humidity,
    windMs: units === 'imperial' ? current.wind.speed * MPH_TO_MS : current.wind.speed,
    weatherId: current.weather[0].id,
    popMax: upcoming.length ? Math.max(...upcoming.map((entry) => entry.pop ?? 0)) : null,
    aqi: air?.list?.[0]?.main?.aqi ?? null,
  };
}

export function buildAdvice({ temp, feelsLike, humidity, windMs, weatherId, popMax, aqi }) {
  const isSnowing = weatherId >= 600 && weatherId < 700;
  const isRaining = (weatherId >= 200 && weatherId < 600) || (popMax ?? 0) >= RAIN_CHANCE_THRESHOLD;
  const isWindy = windMs >= STRONG_WIND_MS;
  const hasPoorAir = (aqi ?? 0) >= 4;
  const advice = [coatAdvice(feelsLike)];

  if (isSnowing) {
    advice.push('snow');
  } else if (isRaining) {
    advice.push('umbrella');
  }
  if (isWindy) {
    advice.push('wind');
  }
  if (temp >= 25 && humidity >= 85) {
    advice.push('muggy');
  }
  if (hasPoorAir) {
    advice.push('air');
  }

  const goodForExercise =
    feelsLike >= 5 && feelsLike <= 28 && !isRaining && !isSnowing && windMs < EXERCISE_WIND_MS && !hasPoorAir;
  advice.push(goodForExercise ? 'exercise.good' : 'exercise.indoor');

  return advice;
}
