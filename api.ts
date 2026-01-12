/**
 * API Service Layer
 * Handles all HTTP requests with error handling, retry logic, and validation
 */

import { BSMInputs, BackendResponse } from './types';
import config from './config';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with automatic retry logic
 * Implements exponential backoff for failed requests
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries: number = 3,
  backoff: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorText;
        } catch {
          // errorText is not JSON, use as is
        }

        throw new ApiError(response.status, errorMessage);
      }

      // Parse and return successful response
      const data = await response.json();
      return data as T;

    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Log retry attempt
      if (attempt < retries - 1) {
        const delay = backoff * Math.pow(2, attempt);
        console.warn(
          `Request failed (attempt ${attempt + 1}/${retries}). Retrying in ${delay}ms...`,
          error
        );
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw new ApiError(
    0,
    `Request failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`,
    lastError
  );
}

/**
 * Validate backend response structure
 */
function validateBackendResponse(data: any): BackendResponse {
  const requiredFields = [
    'fair_price',
    'delta',
    'gamma',
    'theta',
    'vega',
    'rho',
    'historical_volatility',
    'time_to_expiry',
    'time_to_expiry_years'
  ];

  const missingFields = requiredFields.filter(field => !(field in data));

  if (missingFields.length > 0) {
    throw new Error(
      `Invalid response format. Missing fields: ${missingFields.join(', ')}`
    );
  }

  return data as BackendResponse;
}

/**
 * Calculate BSM option price and Greeks via API
 */
export async function calculateBSM(inputs: BSMInputs): Promise<BackendResponse> {
  const url = `${config.apiUrl}/api/calculate`;

  const requestBody = {
    ticker: inputs.ticker,
    spot_price: inputs.spot,
    strike_price: inputs.strike,
    expiry_date: inputs.expiryDate.split('T')[0], // Extract YYYY-MM-DD
    risk_free_rate: inputs.riskFreeRate,
    dividend_yield: inputs.dividendYield,
    option_type: inputs.optionType
  };

  if (config.isDevelopment) {
    console.log('📤 API Request:', { url, body: requestBody });
  }

  try {
    const data = await fetchWithRetry<any>(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      3, // 3 retries
      1000 // 1 second initial backoff
    );

    // Validate response structure
    const validatedData = validateBackendResponse(data);

    if (config.isDevelopment) {
      console.log('📥 API Response:', validatedData);
    }

    return validatedData;

  } catch (error) {
    // Log error in development
    if (config.isDevelopment) {
      console.error('❌ API Error:', error);
    }

    // Re-throw for component to handle
    throw error;
  }
}

/**
 * Health check endpoint
 */
export async function checkHealth(): Promise<{ status: string; service: string }> {
  const url = `${config.apiUrl}/api/health`;

  try {
    const data = await fetch(url);
    return await data.json();
  } catch (error) {
    throw new ApiError(0, 'Failed to connect to backend server');
  }
}

/**
 * Format API error for user display
 */
export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Unable to connect to server. Please check if the backend is running.';
    }
    if (error.status >= 400 && error.status < 500) {
      return `Invalid input: ${error.message}`;
    }
    if (error.status >= 500) {
      return `Server error: ${error.message}`;
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}
