"""
Vercel Serverless Function for BSM Greeks Calculation
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# Add parent directory to path to import bsm_calculator
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from bsm_calculator import calculate_all_greeks

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            # Validate required fields
            required_fields = ['ticker', 'spot_price', 'strike_price', 'expiry_date', 
                              'risk_free_rate', 'dividend_yield', 'option_type']
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Missing required fields',
                    'missing': missing_fields
                }).encode())
                return
            
            # Validate option type
            if data['option_type'].lower() not in ['call', 'put']:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Invalid option_type. Must be "call" or "put"'
                }).encode())
                return
            
            # Validate numeric fields
            try:
                spot_price = float(data['spot_price'])
                strike_price = float(data['strike_price'])
                risk_free_rate = float(data['risk_free_rate'])
                dividend_yield = float(data['dividend_yield'])
                
                if spot_price <= 0 or strike_price <= 0:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'error': 'Spot price and strike price must be positive'
                    }).encode())
                    return
                
            except (ValueError, TypeError) as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Invalid numeric values',
                    'details': str(e)
                }).encode())
                return
            
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
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except ValueError as e:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'Calculation error',
                'details': str(e)
            }).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            }).encode())
    
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
