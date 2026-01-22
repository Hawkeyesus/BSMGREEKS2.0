"""
Black-Scholes-Merton Calculator Module
Pure calculation functions for option pricing and Greeks
"""

import yfinance as yf
import numpy as np
from scipy.stats import norm
from datetime import datetime
import math


def calculate_historical_volatility(ticker: str, lookback: int = 30) -> float:
    """
    Calculate historical volatility using log returns
    
    Args:
        ticker: Stock ticker symbol
        lookback: Number of days to look back
        
    Returns:
        Annualized historical volatility
    """
    try:
        stock = yf.Ticker(ticker)
        hist_data = stock.history(period=f"{lookback + 10}d")
        
        if hist_data.empty:
            raise ValueError(f"No data found for ticker {ticker}")
        
        closes = hist_data['Close'].tail(lookback + 1)
        log_returns = np.log(closes / closes.shift(1)).dropna()
        daily_vol = log_returns.std()
        annual_vol = daily_vol * np.sqrt(252)
        
        return float(annual_vol)
    except Exception as e:
        raise ValueError(f"Failed to calculate historical volatility: {str(e)}")


def calculate_d1_d2(S: float, K: float, T: float, r: float, q: float, vol: float) -> tuple:
    """
    Calculate d1 and d2 for Black-Scholes-Merton formula
    
    Args:
        S: Spot price
        K: Strike price
        T: Time to expiry (years)
        r: Risk-free rate
        q: Dividend yield
        vol: Volatility
        
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
        r: Risk-free rate
        q: Dividend yield
        vol: Volatility
        option_type: 'call' or 'put'
        
    Returns:
        Option price
    """
    d1, d2 = calculate_d1_d2(S, K, T, r, q, vol)
    
    if option_type.lower() == 'call':
        price = S * math.exp(-q * T) * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    else:  # put
        price = K * math.exp(-r * T) * norm.cdf(-d2) - S * math.exp(-q * T) * norm.cdf(-d1)
    
    return float(price)


def calculate_delta(S: float, K: float, T: float, r: float, q: float, 
                   vol: float, option_type: str) -> float:
    """Calculate option delta"""
    d1, _ = calculate_d1_d2(S, K, T, r, q, vol)
    
    if option_type.lower() == 'call':
        delta = math.exp(-q * T) * norm.cdf(d1)
    else:  # put
        delta = -math.exp(-q * T) * norm.cdf(-d1)
    
    return float(delta)


def calculate_gamma(S: float, K: float, T: float, r: float, q: float, vol: float) -> float:
    """Calculate option gamma (same for call and put)"""
    d1, _ = calculate_d1_d2(S, K, T, r, q, vol)
    gamma = (math.exp(-q * T) * norm.pdf(d1)) / (S * vol * math.sqrt(T))
    return float(gamma)


def calculate_vega(S: float, K: float, T: float, r: float, q: float, vol: float) -> float:
    """Calculate option vega (same for call and put)"""
    d1, _ = calculate_d1_d2(S, K, T, r, q, vol)
    vega = (S * math.exp(-q * T) * norm.pdf(d1) * math.sqrt(T)) / 100
    return float(vega)


def calculate_theta(S: float, K: float, T: float, r: float, q: float, 
                   vol: float, option_type: str, days_to_expiry: int) -> float:
    """Calculate option theta"""
    d1, d2 = calculate_d1_d2(S, K, T, r, q, vol)
    
    if option_type.lower() == 'call':
        theta = (1 / days_to_expiry) * (
            -(S * math.exp(-q * T) * vol * norm.pdf(d1)) / (2 * math.sqrt(T))
            - r * K * math.exp(-r * T) * norm.cdf(d2)
            + q * S * math.exp(-q * T) * norm.cdf(d1)
        )
    else:  # put
        theta = (1 / days_to_expiry) * (
            -(S * math.exp(-q * T) * vol * norm.pdf(d1)) / (2 * math.sqrt(T))
            + r * K * math.exp(-r * T) * norm.cdf(-d2)
            - q * S * math.exp(-q * T) * norm.cdf(-d1)
        )
    
    return float(theta)


def calculate_rho(S: float, K: float, T: float, r: float, q: float, 
                 vol: float, option_type: str) -> float:
    """Calculate option rho"""
    _, d2 = calculate_d1_d2(S, K, T, r, q, vol)
    
    if option_type.lower() == 'call':
        rho = (K * T * math.exp(-r * T) * norm.cdf(d2)) / 100
    else:  # put
        rho = -(K * T * math.exp(-r * T) * norm.cdf(-d2)) / 100
    
    return float(rho)


def calculate_all_greeks(ticker: str, S: float, K: float, expiry_date: str,
                        r: float, q: float, option_type: str) -> dict:
    """
    Calculate all Greeks and option price
    
    Args:
        ticker: Stock ticker symbol
        S: Spot price
        K: Strike price
        expiry_date: Expiry date in YYYY-MM-DD format
        r: Risk-free rate
        q: Dividend yield
        option_type: 'call' or 'put'
        
    Returns:
        Dictionary with all calculated values
    """
    # Calculate time to expiry
    expiry_dt = datetime.strptime(expiry_date, "%Y-%m-%d")
    today_dt = datetime.today()
    days_to_expiry = (expiry_dt - today_dt).days
    T = days_to_expiry / 365.25
    
    if T <= 0:
        raise ValueError("Expiry date must be in the future")
    
    # Calculate historical volatility
    vol = calculate_historical_volatility(ticker, lookback=30)
    
    # Calculate option price
    price = calculate_option_price(S, K, T, r, q, vol, option_type)
    
    # Calculate Greeks
    delta = calculate_delta(S, K, T, r, q, vol, option_type)
    gamma = calculate_gamma(S, K, T, r, q, vol)
    vega = calculate_vega(S, K, T, r, q, vol)
    theta = calculate_theta(S, K, T, r, q, vol, option_type, days_to_expiry)
    rho = calculate_rho(S, K, T, r, q, vol, option_type)
    
    return {
        'fair_price': price,
        'historical_volatility': vol,
        'time_to_expiry': f"{days_to_expiry} days ({T:.4f} years)",
        'delta': delta,
        'gamma': gamma,
        'vega': vega,
        'theta': theta,
        'rho': rho
    }
