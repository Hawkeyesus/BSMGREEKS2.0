
import { BSMInputs, BSMOutputs } from './types';

/**
 * Standard Normal Cumulative Distribution Function approximation
 */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const probs = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
  return x > 0 ? 1 - probs : probs;
}

/**
 * Standard Normal Probability Density Function
 */
export function normPdf(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Client-side fallback calculation for smooth 3D surfaces
 */
export function calculateBSM(inputs: BSMInputs): BSMOutputs {
  const { spot: S, strike: K, riskFreeRate: r, dividendYield: q, volatility: v, optionType, expiryDate } = inputs;
  
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const T = Math.max(diffTime / (1000 * 60 * 60 * 24 * 365.25), 0.0001);

  const d1 = (Math.log(S / K) + (r - q + (v * v) / 2) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);

  let price: number;
  let delta: number;
  let gamma: number;
  let vega: number;
  let theta: number;
  let rho: number;

  const daysInYear = 365.25;

  if (optionType === 'call') {
    price = S * Math.exp(-q * T) * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
    delta = Math.exp(-q * T) * normCdf(d1);
    rho = (K * T * Math.exp(-r * T) * normCdf(d2)) / 100;
    theta = (-(S * Math.exp(-q * T) * v * normPdf(d1)) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normCdf(d2) + q * S * Math.exp(-q * T) * normCdf(d1)) / daysInYear;
  } else {
    price = K * Math.exp(-r * T) * normCdf(-d2) - S * Math.exp(-q * T) * normCdf(-d1);
    delta = -Math.exp(-q * T) * normCdf(-d1);
    rho = (-K * T * Math.exp(-r * T) * normCdf(-d2)) / 100;
    theta = (-(S * Math.exp(-q * T) * v * normPdf(d1)) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normCdf(-d2) - q * S * Math.exp(-q * T) * normCdf(-d1)) / daysInYear;
  }

  gamma = (normPdf(d1) * Math.exp(-q * T)) / (S * v * Math.sqrt(T));
  vega = (S * Math.exp(-q * T) * normPdf(d1) * Math.sqrt(T)) / 100;

  return { price, delta, gamma, vega, theta, rho, timeToExpiry: T };
}

export function generateSurfaceData(
  greek: 'delta' | 'gamma' | 'theta' | 'vega',
  inputs: BSMInputs
): { x: number[]; y: number[]; z: number[][] } {
  const steps = 30;
  const spotRange = Array.from({ length: steps }, (_, i) => inputs.spot * (0.7 + (i * 0.6) / steps));
  const timeRange = Array.from({ length: steps }, (_, i) => (i + 1) / steps);

  const z: number[][] = [];
  for (let tIdx = 0; tIdx < timeRange.length; tIdx++) {
    const row: number[] = [];
    const T_sim = timeRange[tIdx];
    const expirySim = new Date(Date.now() + T_sim * 365.25 * 24 * 60 * 60 * 1000).toISOString();
    for (let sIdx = 0; sIdx < spotRange.length; sIdx++) {
      const result = calculateBSM({ ...inputs, spot: spotRange[sIdx], expiryDate: expirySim });
      row.push(result[greek]);
    }
    z.push(row);
  }
  return { x: spotRange, y: timeRange, z };
}

export function generateHeatmapData(
  inputs: BSMInputs
): { x: string[]; y: string[]; z: number[][] } {
  const steps = 12;
  const volRange = Array.from({ length: steps }, (_, i) => inputs.volatility * (0.6 + (i / steps) * 1.4));
  const spotRange = Array.from({ length: steps }, (_, i) => inputs.spot * (0.8 + (i / steps) * 0.4));

  const z: number[][] = [];
  const xLabels = spotRange.map(s => `₹${s.toFixed(0)}`);
  const yLabels = volRange.map(v => `${(v * 100).toFixed(1)}%`);

  for (let vIdx = 0; vIdx < volRange.length; vIdx++) {
    const row: number[] = [];
    for (let sIdx = 0; sIdx < spotRange.length; sIdx++) {
      const result = calculateBSM({ ...inputs, spot: spotRange[sIdx], volatility: volRange[vIdx] });
      row.push(result.price);
    }
    z.push(row);
  }
  return { x: xLabels, y: yLabels, z };
}
