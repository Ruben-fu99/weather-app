export function buildChartPoints(values, { width, height, padX, padY }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = values.length > 1 ? (width - 2 * padX) / (values.length - 1) : 0;

  return values.map((value, index) => {
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    return {
      x: padX + step * index,
      y: padY + (height - 2 * padY) * (1 - ratio),
    };
  });
}
