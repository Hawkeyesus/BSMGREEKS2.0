"""
Flask REST API Server for BSM Greeks Calculator
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from bsm_calculator import calculate_all_greeks
import os

app = Flask(__name__)
CORS(app)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'BSM Options Calculator API',
        'version': '1.0.0'
    })


@app.route('/api/calculate', methods=['POST'])
def calculate_bsm():
    """
    Calculate Black-Scholes-Merton option price and Greeks
    
    Expected JSON payload:
    {
        "ticker": "RELIANCE",
        "spot_price": 2540,
        "strike_price": 2500,
        "expiry_date": "2024-12-31",
        "risk_free_rate": 0.07,
        "dividend_yield": 0.01,
        "option_type": "call"
    }
    """
    try:
        data = request.get_json()
        
        # Log incoming request for debugging
        print(f"Received request data: {data}")
        
        # Validate required fields
        required_fields = ['ticker', 'spot_price', 'strike_price', 'expiry_date', 
                          'risk_free_rate', 'dividend_yield', 'option_type']
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            print(f"Missing fields: {missing_fields}")
            return jsonify({
                'error': 'Missing required fields',
                'missing': missing_fields
            }), 400
        
        # Validate option type
        if data['option_type'].lower() not in ['call', 'put']:
            return jsonify({
                'error': 'Invalid option_type. Must be "call" or "put"'
            }), 400
        
        # Validate numeric fields
        try:
            spot_price = float(data['spot_price'])
            strike_price = float(data['strike_price'])
            risk_free_rate = float(data['risk_free_rate'])
            dividend_yield = float(data['dividend_yield'])
            
            if spot_price <= 0 or strike_price <= 0:
                return jsonify({
                    'error': 'Spot price and strike price must be positive'
                }), 400
            
        except (ValueError, TypeError) as e:
            return jsonify({
                'error': 'Invalid numeric values',
                'details': str(e)
            }), 400
        
        # Calculate Greeks
        result = calculate_all_greeks(
            ticker=data['ticker'],
            S=spot_price,
            K=strike_price,
            expiry_date=data['expiry_date'],
            r=risk_free_rate,
            q=dividend_yield,
            option_type=data['option_type']
        )
        
        return jsonify(result), 200
        
    except ValueError as e:
        return jsonify({
            'error': 'Calculation error',
            'details': str(e)
        }), 400
        
    except Exception as e:
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'error': 'Endpoint not found',
        'message': 'The requested endpoint does not exist'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV', 'production') == 'development'
    
    print(f"Starting Flask server on port {port}")
    print(f"Debug mode: {debug_mode}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug_mode
    )
