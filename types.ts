
export type OptionType = 'call' | 'put';

export interface BSMInputs {
  ticker: string;
  strike: number;
  spot: number;
  expiryDate: string;
  riskFreeRate: number;
  dividendYield: number;
  optionType: OptionType;
  volatility: number;
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
