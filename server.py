"""
Black-Scholes-Merton Options Pricing API
Flask backend server for BSM Greeks Dashboard
Provides REST endpoint for calculating option prices and Greeks
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import logging
import os
from dotenv import load_dotenv

# Import our BSM calculator module
from bsm_calculator import (
    calculate_all_greeks,
    calculate_historical_volatility
)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS
allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')
CORS(app, origins=allowed_origins)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'BSM Options Calculator API',
        'version': '1.0.0'
    }), 200


@app.route('/api/calculate', methods=['POST'])
def calculate_option():
    """
    Calculate option price and Greeks
    
    Expected JSON payload:
    {
        "ticker": "RELIANCE.NS",
        "spot_price": 2500,
        "strike_price": 2550,
        "expiry_date": "2026-06-30",
        "risk_free_rate": 0.065,
        "dividend_yield": 0.005,
        "option_type": "call"
    }
    
    Returns:
    {
        "fair_price": 155.50,
        "delta": 0.5234,
        "gamma": 0.001234,
        "theta": -0.0456,
        "vega": 1.234,
        "rho": 0.567,
        "historical_volatility": 0.2234,
        "time_to_expiry": "169.0 Days",
        "time_to_expiry_years": 0.4630
    }
    """
    try:
        # Extract request data
        data = request.json
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Validate required fields
        required_fields = ['ticker', 'spot_price', 'strike_price', 'expiry_date', 
                          'risk_free_rate', 'dividend_yield', 'option_type']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Extract and convert parameters
        ticker = str(data['ticker']).strip()
        K = float(data['strike_price'])
        S = float(data['spot_price'])
        r = float(data['risk_free_rate'])
        q = float(data['dividend_yield'])
        option_type = str(data['option_type']).lower().strip()
        
        # Validate numeric inputs
        if S <= 0:
            return jsonify({'error': 'Spot price must be positive'}), 400
        
        if K <= 0:
            return jsonify({'error': 'Strike price must be positive'}), 400
        
        if option_type not in ['call', 'put']:
            return jsonify({'error': 'Option type must be "call" or "put"'}), 400
        
        if r < -0.1 or r > 1.0:
            return jsonify({'error': 'Risk-free rate seems unreasonable'}), 400
        
        if q < 0 or q > 0.5:
            return jsonify({'error': 'Dividend yield seems unreasonable'}), 400
        
        # Parse expiry date and calculate time to expiry
        try:
            expiry_date = datetime.strptime(data['expiry_date'], "%Y-%m-%d")
        except ValueError:
            return jsonify({'error': 'Invalid expiry_date format. Use YYYY-MM-DD'}), 400
        
        today = datetime.today()
        T = (expiry_date - today).days / 365.25
        
        if T < 0:
            return jsonify({'error': 'Expiry date is in the past'}), 400
        
        if T > 10:
            return jsonify({'error': 'Expiry date too far in future (max 10 years)'}), 400
        
        # Calculate historical volatility
        logger.info(f"Calculating volatility for {ticker}")
        vol = calculate_historical_volatility(ticker, lookback=30)
        logger.info(f"Historical volatility for {ticker}: {vol:.4f}")
        
        # Calculate BSM price and Greeks
        results = calculate_all_greeks(S, K, T, r, q, vol, option_type)
        
        # Format response
        response = {
            'fair_price': round(results['price'], 2),
            'delta': round(results['delta'], 4),
            'gamma': round(results['gamma'], 6),
            'vega': round(results['vega'], 4),
            'theta': round(results['theta'], 4),
            'rho': round(results['rho'], 4),
            'historical_volatility': round(vol, 4),
            'time_to_expiry': f"{T * 365.25:.1f} Days",
            'time_to_expiry_years': round(T, 4)
        }
        
        logger.info(f"Calculation successful for {ticker} {option_type} - Price: {response['fair_price']}")
        return jsonify(response), 200
    
    except KeyError as e:
        logger.error(f"Missing field in request: {e}")
        return jsonify({'error': f'Missing field: {str(e)}'}), 400
    
    except ValueError as e:
        logger.error(f"Invalid value in request: {e}")
        return jsonify({'error': f'Invalid value: {str(e)}'}), 400
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Check environment
    env = os.getenv('FLASK_ENV', 'development')
    debug = env == 'development'
    port = int(os.getenv('PORT', 5000))
    
    logger.info(f"Starting BSM Options Calculator API")
    logger.info(f"Environment: {env}")
    logger.info(f"Port: {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
