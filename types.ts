
export type OptionType = 'call' | 'put';

export interface BSMInputs {
  ticker: string;
  strike: number;
  spot: number;
  expiryDate: string;
  riskFreeRate: number;
  dividendYield: number;
  optionType: OptionType;
  volatility: number; // Used for surface generation baseline
}

export interface BackendResponse {
  fair_price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  historical_volatility: number;
  time_to_expiry: string; // e.g. "24.5 Days" or "0.067 Years"
  time_to_expiry_years: number;
}

export interface BSMOutputs {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  timeToExpiry: number;
}

export interface SurfaceData {
  x: number[];
  y: number[];
  z: number[][];
}
