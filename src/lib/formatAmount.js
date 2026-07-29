// Formats a scaled quantity as a friendly fraction where possible
// (1.5 -> "1 1/2") instead of showing raw floating point noise.
const FRACTIONS = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [1 / 2, '1/2'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
];

export function formatAmount(value) {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';

  const whole = Math.floor(value);
  const fraction = value - whole;

  if (fraction < 0.03) {
    return String(whole);
  }

  let closest = null;
  let closestDiff = Infinity;
  for (const [decimal, label] of FRACTIONS) {
    const diff = Math.abs(fraction - decimal);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = label;
    }
  }

  // Fraction is close enough to a "nice" one to display it that way.
  if (closestDiff < 0.06) {
    return whole > 0 ? `${whole} ${closest}` : closest;
  }

  // Otherwise fall back to a rounded decimal.
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}
