
import { BSMInputs, BSMOutputs } from './types';

/**
 * Standard Normal Cumulative Distribution Function approximation
 * Matches the precision used in most financial libraries.
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
 * BSM Calculation aligned with the provided Python script.
 * Greeks are scaled: Vega/100, Rho/100, Theta/Day.
 */
export function calculateBSM(inputs: BSMInputs): BSMOutputs {
  const { spot: S, strike: K, riskFreeRate: r, dividendYield: q, volatility: v, optionType, expiryDate } = inputs;
  
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const totalDays = diffTime / (1000 * 60 * 60 * 24);
  const T = Math.max(totalDays / 365.25, 0.0001);

  // D1 calculation from Python script: (math.log(S/K) + (r + vol**2/2)* T) / (vol * math.sqrt(T))
  // We include q (dividend yield) for a more complete model as per inputs
  const d1 = (Math.log(S / K) + (r - q + (v * v) / 2) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);

  let price: number;
  let delta: number;
  let gamma: number;
  let vega: number;
  let theta: number;
  let rho: number;

  if (optionType === 'call') {
    // Call Price: S * exp(-qT) * N(d1) - K * exp(-rT) * N(d2)
    price = S * Math.exp(-q * T) * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
    // Call Delta: exp(-qT) * N(d1)
    delta = Math.exp(-q * T) * normCdf(d1);
    // Call Rho: (K * T * exp(-rT) * N(d2)) / 100
    rho = (K * T * Math.exp(-r * T) * normCdf(d2)) / 100;
    // Call Theta (per day scaling as per Python script)
    const term1 = -(S * Math.exp(-q * T) * v * normPdf(d1)) / (2 * Math.sqrt(T));
    const term2 = - r * K * Math.exp(-r * T) * normCdf(d2);
    const term3 = q * S * Math.exp(-q * T) * normCdf(d1);
    theta = (term1 + term2 + term3) / 365.25;
  } else {
    // Put Price: K * exp(-rT) * N(-d2) - S * exp(-qT) * N(-d1)
    price = K * Math.exp(-r * T) * normCdf(-d2) - S * Math.exp(-q * T) * normCdf(-d1);
    // Put Delta: -exp(-qT) * N(-d1)
    delta = -Math.exp(-q * T) * normCdf(-d1);
    // Put Rho: (-K * T * exp(-rT) * N(-d2)) / 100
    rho = (-K * T * Math.exp(-r * T) * normCdf(-d2)) / 100;
    // Put Theta (per day scaling)
    const term1 = -(S * Math.exp(-q * T) * v * normPdf(d1)) / (2 * Math.sqrt(T));
    const term2 = r * K * Math.exp(-r * T) * normCdf(-d2);
    const term3 = - q * S * Math.exp(-q * T) * normCdf(-d1);
    theta = (term1 + term2 + term3) / 365.25;
  }

  // Gamma: N'(d1) * exp(-qT) / (S * v * sqrt(T))
  gamma = (normPdf(d1) * Math.exp(-q * T)) / (S * v * Math.sqrt(T));
  // Vega (per 1% change as per Python script): (S * exp(-qT) * N'(d1) * sqrt(T)) / 100
  vega = (S * Math.exp(-q * T) * normPdf(d1) * Math.sqrt(T)) / 100;

  return { price, delta, gamma, vega, theta, rho, timeToExpiry: T };
}

export function generateSurfaceData(
  greek: 'delta' | 'gamma' | 'theta' | 'vega',
  inputs: BSMInputs
): { x: number[]; y: number[]; z: number[][] } {
  const steps = 25;
  // S range from 85% to 115% as per Python script
  const spotRange = Array.from({ length: steps }, (_, i) => inputs.spot * (0.85 + (i * 0.3) / steps));
  // T range from 0 to 1 year
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
  // Vol range from 25% to 400% of baseline as per Python script
  const volRange = Array.from({ length: steps }, (_, i) => inputs.volatility * (0.25 + (i / steps) * 3.75));
  // Spot range from 90% to 120% as per Python script
  const spotRange = Array.from({ length: steps }, (_, i) => inputs.spot * (0.9 + (i / steps) * 0.3));

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
