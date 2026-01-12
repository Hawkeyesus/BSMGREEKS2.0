# %%


import yfinance as yf
import numpy as np
import scipy.stats as si
import matplotlib.pyplot as plt
import mplfinance as mpf
import plotly.graph_objects as go
from datetime import datetime as datetime
import math as math
from scipy.stats import norm
from math import exp


# %%
try:
    Stock = input("Enter stock name: ").strip()
    Ticker_stock1 = yf.Ticker(Stock)
    stock_data1 = Ticker_stock1.history(period="1y")

    if stock_data1.empty:
        raise ValueError("Yahoo returned empty data")

except Exception as e:
    Stock = input("Invalid stock name. Please enter a valid stock ticker symbol: ").strip()
    Ticker_stock1 = yf.Ticker(Stock)
    stock_data1 = Ticker_stock1.history(period="1y")




# %%

K = float(input("Enter strike price:"))
S = float(input("Enter spot price:"))

r = float(input("Enter risk free rate (in decimal):"))
option_type = input("Enter option type (call/put):").lower()
q = float(input("Enter dividend yield (in decimal):"))

from datetime import date 
expiration_input = input("Enter expiration date (YYYY-MM-DD):")
expiration_dt = datetime.strptime(expiration_input, "%Y-%m-%d")
today_dt = datetime.today()
T = (expiration_dt - today_dt).days / 365.25

print (T)





# %%
link_NSE_Option_chain = "https://www.nseindia.com/option-chain"
print(f"Visit this site for option chain data: {link_NSE_Option_chain} ")


# %%

def hist_vol(stock_data, lookback=30):
    closes = stock_data['Close'].tail(lookback + 1)
    log_returns = np.log(closes / closes.shift(1)).dropna()
    daily_vol = log_returns.std()
    annual_vol = daily_vol * np.sqrt(252)
    return annual_vol

StockVol = hist_vol(stock_data1, lookback=30)
print(f"The historical volatility of the stock is: {StockVol}")
   


# %%
# HV in BSM 
vol = StockVol = input("Enter stock historical volatility (in decimal) in case the vol calculator fails:")
vol = float(vol)
D1 = (math.log(S/K) + (r+ vol**2/2)* T) / (vol * math.sqrt(T))
D2 = D1 - vol * math.sqrt(T)

if option_type == "call":
    BSMC = (S * norm.cdf(D1) - K * math.exp(-r * T) * norm.cdf(D2))
    print(f"The Black-Scholes-Merton Call option price is: {BSMC}")
elif option_type == "put":
    BSMP = (K* math.exp(-r*T) * norm.cdf(-D2) - S * norm.cdf(-D1))
    print(f"The Black-Scholes-Merton Put option price is: {BSMP}")


# %%
if option_type == "call":
    delta = math.exp(-r * T) * norm.cdf(D1) 
    gamma = norm.pdf(D1,0,1) / (S * vol *math.sqrt(T))
    theta = (1/(expiration_dt - today_dt).days)*(-(( S * math.exp(-r * T) * vol * norm.pdf(D1)) / 2 * math.sqrt(T)) - r * K * math.exp(-r * T) * norm.cdf(D2) + r * S * math.exp(-r * T) * norm.cdf(D1))
    vega = (S * math.exp(-r * T) * norm.pdf(D1) * math.sqrt(T))/100
    rho = (K * T * math.exp(-r * T) * norm.cdf(D2))/100
    print(f"Call Delta: {delta},Call Gamma: {gamma},Call Theta: {theta}, Call Vega: {vega}, Call Rho: {rho}")
elif option_type == "put":
    delta = -(math.exp(-r * T) * norm.cdf(-D1))
    gamma = norm.pdf(D1,0,1) / (S * vol *math.sqrt(T))
    theta = (1/(expiration_dt - today_dt).days)*(-(S * math.exp(-r * T) * vol * norm.pdf(D1)) / 2 * math.sqrt(T)) + r * K * math.exp(-r * T) * norm.cdf(-D2) - r * S * math.exp(-r * T) * norm.cdf(-D1)
    vega = (S * math.exp(-r * T) * norm.pdf(D1) * math.sqrt(T))/100
    rho = (-K * T * math.exp(-r * T) * norm.cdf(-D2))/100
    print(f"Put Delta: {delta},Put Gamma: {gamma}Put Theta: {theta},Put Vega: {vega},Put Rho: {rho}")

    
    
def delta_calc(option_type, S, K, T, r, q, vol):
    D1 = (math.log(S/K) + (r+ vol**2/2)* T) / (vol * math.sqrt(T))
    D2 = D1 - vol * math.sqrt(T)
    if option_type == "call":
        return math.exp(-r * T) * norm.cdf(D1)
    elif option_type == "put":
        return -(math.exp(-r * T) * norm.cdf(-D1))
print (f'{option_type} delta is {delta}')


def gamma_calc(option_type, S, K, T, r, q, vol):
    D1 = (math.log(S/K) + (r+ vol**2/2)* T) / (vol * math.sqrt(T))
    gamma = norm.pdf(D1,0,1) / (S * vol *math.sqrt(T))
    return gamma

print (f'{option_type} gamma is {gamma}')

def theta_calc(option_type, S, K, T, r, q, vol):
    D1 = (math.log(S/K) + (r+ vol**2/2)* T) / (vol * math.sqrt(T))
    if option_type == "call":
        theta = (1/(expiration_dt - today_dt).days)*(-(( S * math.exp(-r * T) * vol * norm.pdf(D1)) / 2 * math.sqrt(T)) - r * K * math.exp(-r * T) * norm.cdf(D2) + r * S * math.exp(-r * T) * norm.cdf(D1))
    elif option_type == "put":
        theta = (1/(expiration_dt - today_dt).days)*(-( S * math.exp(-r * T) * vol * norm.pdf(D1)) / 2 * math.sqrt(T)) + r * K * math.exp(-r * T) * norm.cdf(-D2) - r * S * math.exp(-r * T) * norm.cdf(-D1)
    return theta

print (f'{option_type} theta is {theta}')

def vega_calc(option_type, S, K, T, r, q, vol):
    D1 = (math.log(S/K) + (r+ vol**2/2)* T) / (vol * math.sqrt(T))
    vega = S * math.exp(-r * T) * norm.pdf(D1) * math.sqrt(T)
    return vega

print (f'{option_type} vega is {vega}')


def rho_calc(option_type, S, K, T, r, q, vol):
    D2 = D1 - vol * math.sqrt(T)
    if option_type == "call":
        rho = K * T * math.exp(-r * T) * norm.cdf(D2)
    elif option_type == "put":
        rho = -K * T * math.exp(-r * T) * norm.cdf(-D2)
    return rho
print (f'{option_type} rho is {rho}')




# %%
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

T_range = np.linspace(0,1,100)
S = np.linspace(0.85*S, 1.15*S, 100)


def greek_surface(calc_fn, option_type, S, K, r, q, vol, T_Range):
    surface = np.zeros((len(T_Range), len(S)))

    for i, T in enumerate(T_Range):
        for j, s in enumerate(S):
            surface[i, j] = calc_fn(option_type, s, K, T, r, q, vol)

    return surface

Delta_surface = greek_surface(delta_calc, option_type, S, K, r, q, vol, T_range)
Gamma_surface = greek_surface(gamma_calc, option_type, S, K, r, q, vol, T_range)
Vega_surface  = greek_surface(vega_calc,  option_type, S, K, r, q, vol, T_range)
Theta_surface = greek_surface(theta_calc, option_type, S, K, r, q, vol, T_range)




def plot_greek_surface(S, T_range, surface, greek_name):
    S_grid, T_grid = np.meshgrid(S, T_range)

    fig = plt.figure(figsize=(12, 8))
    ax = plt.axes(projection="3d")

    surf = ax.plot_surface(
        S_grid,
        T_grid,
        surface,
        cmap="jet",
        edgecolor="none"
    )

    ax.set_xlabel("Spot Price ($)")
    ax.set_ylabel("Time to Maturity (yr)")
    ax.set_zlabel(greek_name)
    ax.set_title(f"3D {greek_name} Surface (Black–Scholes)")
    ax.view_init(elev = 30, azim = 145)

    fig.colorbar(surf, shrink=0.5, aspect= 10)
    plt.show()

plot_greek_surface(S, T_range, Delta_surface, "Delta")
plot_greek_surface(S, T_range, Gamma_surface, "Gamma")
plot_greek_surface(S, T_range, Vega_surface,  "Vega")
plot_greek_surface(S, T_range, Theta_surface, "Theta")






# %%

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from scipy.stats import norm
import plotly.io as pio

pio.renderers.default = "notebook" 

S = float(input("Re-enter spot price:"))
boxes = 15

Vol_heatmap = np.linspace(0.25 * vol, 4 * vol, boxes)
Spot_heatmap = np.linspace(0.9 * S, 1.2 * S, boxes)

price_matrix = np.zeros((len(Vol_heatmap), len(Spot_heatmap)))

def BSMC1(S, K, T, r, q, vol):
    D1 = (np.log(S / K) + (r + 0.5 * vol**2) * T) / (vol * np.sqrt(T))
    D2 = D1 - vol * np.sqrt(T)
    return S * np.exp(-q * T) * norm.cdf(D1) - K * np.exp(-r * T) * norm.cdf(D2)

def BSMP1(S, K, T, r, q, vol):
    D1 = (np.log(S / K) + (r + 0.5 * vol**2) * T) / (vol * np.sqrt(T))
    D2 = D1 - vol * np.sqrt(T)
    return K * np.exp(-r * T) * norm.cdf(-D2) - S * np.exp(-q * T) * norm.cdf(-D1)

vol_multipliers = np.linspace(0.5, 8.0, 151)
frames = []

for m in vol_multipliers:

    for i in range(len(Vol_heatmap)):
        for j in range(len(Spot_heatmap)):

            if option_type.lower() == "call":
                price_matrix[i][j] = BSMC1(
                    Spot_heatmap[j], K, T, r, q, m * Vol_heatmap[i]
                )
            else:
                price_matrix[i][j] = BSMP1(
                    Spot_heatmap[j], K, T, r, q, m * Vol_heatmap[i]
                )

    frames.append(
        go.Frame(
            data=[go.Heatmap(
                z=price_matrix.copy(),
                x=[f"{s:.2f}" for s in Spot_heatmap],
                y=[f"{v:.2f}" for v in Vol_heatmap],
                text=np.round(price_matrix, 2),
                texttemplate="%{text}",
                hovertemplate="Spot=%{x}<br>Vol=%{y}<br>Price=%{z:.2f}<extra></extra>",
                colorscale='Viridis',
                xgap=2,
                ygap=2
            )],
            name=f"{m:.3f}"
        )
    )

fig = go.Figure(
    data=frames[0].data,
    frames=frames
)

fig.update_traces(
    textfont=dict(color="white", size=10)
)

fig.update_layout(
    title=f"Options Price - Interactive Heatmap for {option_type} option for the underlying {Ticker_stock1}",
    width=1200,
    margin=dict(t=80)
)

fig.update_xaxes(
    tickmode="array",
    tickvals=[f"{s:.2f}" for s in Spot_heatmap],
    ticktext=[f"{s:.2f}" for s in Spot_heatmap],
    title="Spot Price",
    fixedrange=True
)

fig.update_yaxes(
    tickmode="array",
    tickvals=[f"{v:.2f}" for v in Vol_heatmap],
    ticktext=[f"{v:.2f}" for v in Vol_heatmap],
    title="Volatility",
    fixedrange=True
)

fig.update_layout(
    sliders=[{
        "steps": [
            {
                "method": "animate",
                "args": [[f"{m:.3f}"],
                         {"mode": "immediate",
                          "frame": {"duration": 0, "redraw": True},
                          "transition": {"duration": 0}}],
                "label": f"{m:.2f}×"
            }
            for m in vol_multipliers
        ],
        "currentvalue": {
            "prefix": "Volatility Multiplier: ",
            "font": {"size": 15}
        }
    }]
)

fig.show()

# %%





