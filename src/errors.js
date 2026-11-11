export class WeatherError extends Error {
  constructor(type, status) {
    super(type);
    this.name = 'WeatherError';
    this.type = type;
    this.status = status;
  }
}
