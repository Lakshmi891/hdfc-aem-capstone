/**
 * EMI = P × r × (1+r)^n / ((1+r)^n - 1)
 * P = principal, r = monthly rate, n = tenure in months
 */
export function calculateEMI(P, annualRate, n) {
  if (!P || !annualRate || !n || n === 0) return 0;
  const r = annualRate / (12 * 100);
  const powered = Math.pow(1 + r, n);
  return Math.round((P * r * powered) / (powered - 1));
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
