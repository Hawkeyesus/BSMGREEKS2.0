"""
Black-Scholes-Merton Calculator Module
Pure functions for options pricing and Greeks calculations
Extracted from BSM_Greeks.py for API integration
"""

import yfinance as yf
import numpy as np
import math
from scipy.stats import norm
from typing import Dict, Tuple


def calculate_historical_volatility(ticker: str, lookback: int = 30) -> float:
    """
    Calculate annualized historical volatility using log returns
    
    Args:
        ticker: Stock symbol (e.g., 'RELIANCE.NS')
        lookback: Number of days for volatility calculation
    
    Returns:
        Annualized volatility (e.g., 0.22 for 22%)
    """
    try:
        stock = yf.Ticker(ticker)
        stock_data = stock.history(period="1y")
        
        if stock_data.empty or len(stock_data) < lookback + 1:
            return 0.22  # Default fallback
        
        closes = stock_data['Close'].tail(lookback + 1)
        log_returns = np.log(closes / closes.shift(1)).dropna()
        daily_vol = log_returns.std()
        annual_vol = daily_vol * np.sqrt(252)
        
        return float(annual_vol)
    
    except Exception:
        return 0.22  # Fallback default


def calculate_d1_d2(S: float, K: float, T: float, r: float, q: float, vol: float) -> Tuple[float, float]:
    """
    Calculate d1 and d2 for Black-Scholes-Merton formula
    
    Args:
        S: Spot price
        K: Strike price
        T: Time to expiry (years)
        r: Risk-free rate (decimal)
        q: Dividend yield (decimal)
        vol: Volatility (decimal)
    
    Returns:
        Tuple of (d1, d2)
    """
    d1 = (math.log(S / K) + (r - q + vol**2 / 2) * T) / (vol * math.sqrt(T))
    d2 = d1 - vol * math.sqrt(T)
    return d1, d2


def calculate_option_price(S: float, K: float, T: float, r: float, q: float, 
                          vol: float, option_type: str) -> float:
    """
    Calculate Black-Scholes-Merton option price
    
    Args:
        S: Spot price
        K: Strike price
        T: Time to expiry (years)
        r: Risk-free rate (decimal)
        q: Dividend yield (decimal)
        vol: Volatility (decimal)
        option_type: 'call' or 'put'
    
    Returns:
        Option price
    """
    if T <= 0:
        # Option expired - return intrinsic value
        if option_type.lower() == 'call':
            return max(S - K, 0)
        else:
            return max(K - S, 0)
    
    d1, d2 = calculate_d1_d2(S, K, T, r, q, vol)
    
    if option_type.lower() == 'call':
        price = (S * math.exp(-q * T) * norm.cdf(d1) - 
                K * math.exp(-r * T) * norm.cdf(d2))
    else:  # put
        price = (K * math.exp(-r * T) * norm.cdf(-d2) - 
                S * math.exp(-q * T) * norm.cdf(-d1))
    
    return price


def calculate_delta(S: float, K: float, T: float, r: float, q: float, 
                   vol: float, option_type: str) -> float:
    """Calculate option delta (∂V/∂S)"""
    if T <= 0:
        if option_type.lower() == 'call':
            return 1.0 if S > K else 0.0
        else:
            return -1.0 if S < K else 0.0
    
    d1, _ = calculate_d1_d2(S, K, T, r, q, vol)
    
    if option_type.lower() == 'call':
        return math.exp(-q * T) * norm.cdf(d1)
    else:  # put
        return -math.exp(-q * T) * norm.cdf(-d1)


def calculate_gamma(S: float, K: float, T: float, r: float, q: float, vol: float) -> float:
    """Calculate option gamma (∂²V/∂S²) - same for calls and puts"""
    if T <= 0:
        return 0.0
    
    d1, _ = calculate_d1_d2(S, K, T, r, q, vol)
    gamma = (math.exp(-q * T) * norm.pdf(d1)) / (S * vol * math.sqrt(T))
    return gamma


def calculate_theta(S: float, K: float, T: float, r: float, q: float, 
                   vol: float, option_type: str) -> float:
    """Calculate option theta (∂V/∂t) - per day"""
    if T <= 0:
        return 0.0
    
    d1, d2 = calculate_d1_d2(S, K, T, r, q, vol)
    
    # Common term for both call and put
    term1 = -(S * math.exp(-q * T) * vol * norm.pdf(d1)) / (2 * math.sqrt(T))
    
    if option_type.lower() == 'call':
        term2 = -r * K * math.exp(-r * T) * norm.cdf(d2)
        term3 = q * S * math.exp(-q * T) * norm.cdf(d1)
        theta = (term1 + term2 + term3) / 365.25  # Per day
    else:  # put
        term2 = r * K * math.exp(-r * T) * norm.cdf(-d2)
        term3 = -q * S * math.exp(-q * T) * norm.cdf(-d1)
        theta = (term1 + term2 + term3) / 365.25  # Per day
    
    return theta


def calculate_vega(S: float, K: float, T: float, r: float, q: float, vol: float) -> float:
    """Calculate option vega (∂V/∂σ) - per 1% change in volatility"""
    if T <= 0:
        return 0.0
    
    d1, _ = calculate_d1_d2(S, K, T, r, q, vol)
    vega = (S * math.exp(-q * T) * norm.pdf(d1) * math.sqrt(T)) / 100
    return vega


def calculate_rho(S: float, K: float, T: float, r: float, q: float, 
                 vol: float, option_type: str) -> float:
    """Calculate option rho (∂V/∂r) - per 1% change in interest rate"""
    if T <= 0:
        return 0.0
    
    _, d2 = calculate_d1_d2(S, K, T, r, q, vol)
    
    if option_type.lower() == 'call':
        rho = (K * T * math.exp(-r * T) * norm.cdf(d2)) / 100
    else:  # put
        rho = (-K * T * math.exp(-r * T) * norm.cdf(-d2)) / 100
    
    return rho


def calculate_all_greeks(S: float, K: float, T: float, r: float, q: float, 
                        vol: float, option_type: str) -> Dict[str, float]:
    """
    Calculate option price and all Greeks in one call
    
    Returns:
        Dictionary with 'price', 'delta', 'gamma', 'theta', 'vega', 'rho'
    """
    price = calculate_option_price(S, K, T, r, q, vol, option_type)
    delta = calculate_delta(S, K, T, r, q, vol, option_type)
    gamma = calculate_gamma(S, K, T, r, q, vol)
    theta = calculate_theta(S, K, T, r, q, vol, option_type)
    vega = calculate_vega(S, K, T, r, q, vol)
    rho = calculate_rho(S, K, T, r, q, vol, option_type)
    
    return {
        'price': price,
        'delta': delta,
        'gamma': gamma,
        'theta': theta,
        'vega': vega,
        'rho': rho
    }
