
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BSMInputs, BackendResponse } from './types';
import { generateSurfaceData, generateHeatmapData } from './mathUtils';

declare global {
  interface Window {
    Plotly: any;
  }
}

const DEFAULT_INPUTS: BSMInputs = {
  ticker: 'RELIANCE.NS',
  strike: 2500,
  spot: 2540,
  expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  riskFreeRate: 0.07,
  dividendYield: 0.01,
  optionType: 'call',
  volatility: 0.22,
};

const Card = ({ title, value, unit = "", subtext = "", highlight = false }: { title: string; value: string | number; unit?: string; subtext?: string; highlight?: boolean }) => (
  <div className={`border p-4 rounded-xl shadow-sm transition-all h-full flex flex-col justify-between ${highlight ? 'bg-emerald-600/10 border-emerald-500/40 ring-1 ring-emerald-500/20' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}>
    <div>
      <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${highlight ? 'text-emerald-400' : 'text-zinc-500'}`}>{title}</h3>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl lg:text-2xl font-bold ${highlight ? 'text-white' : 'text-zinc-100'}`}>{value}</span>
        <span className="text-zinc-500 text-xs">{unit}</span>
      </div>
    </div>
    {subtext && <p className="text-zinc-600 text-[9px] mt-2 italic font-medium">{subtext}</p>}
  </div>
);

const App = () => {
  const [inputs, setInputs] = useState<BSMInputs>(DEFAULT_INPUTS);
  const [backendData, setBackendData] = useState<BackendResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const chartsRef = {
    delta: useRef<HTMLDivElement>(null),
    gamma: useRef<HTMLDivElement>(null),
    theta: useRef<HTMLDivElement>(null),
    vega: useRef<HTMLDivElement>(null),
    heatmap: useRef<HTMLDivElement>(null),
  };

  const syncBackend = async () => {
    setIsSyncing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/calculate';
      const payload = {
        ticker: inputs.ticker,
        strike_price: inputs.strike,
        spot_price: inputs.spot,
        expiry_date: inputs.expiryDate,
        risk_free_rate: inputs.riskFreeRate,
        dividend_yield: inputs.dividendYield,
        option_type: inputs.optionType
      };
      console.log('Sending to backend:', apiUrl, payload);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data: BackendResponse = await response.json();
        setBackendData(data);
        // Sync local volatility for surface visualizations
        if (data.historical_volatility) {
          setInputs(prev => ({ ...prev, volatility: data.historical_volatility }));
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Backend error response:', response.status, errorData);
      }
    } catch (error) {
      console.error("Backend communication error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initial load
  useEffect(() => {
    syncBackend();
  }, []);

  // Handle Graph Rendering whenever backendData or inputs change
  useEffect(() => {
    if (!backendData) return;

    const commonLayout = {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#71717a', size: 10 },
      margin: { l: 0, r: 0, b: 0, t: 30 },
      scene: {
        xaxis: { title: 'Spot Price (₹)', gridcolor: '#27272a' },
        yaxis: { title: 'Time (Years)', gridcolor: '#27272a' },
        zaxis: { gridcolor: '#27272a' },
        camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
      }
    };

    const greeks: ('delta' | 'gamma' | 'theta' | 'vega')[] = ['delta', 'gamma', 'theta', 'vega'];
    greeks.forEach(greek => {
      const data = generateSurfaceData(greek, inputs);
      if (chartsRef[greek].current) {
        window.Plotly.newPlot(chartsRef[greek].current, [{
          x: data.x,
          y: data.y,
          z: data.z,
          type: 'surface',
          colorscale: 'Viridis',
          showscale: false
        }], {
          ...commonLayout,
          title: { text: `3D ${greek.charAt(0).toUpperCase() + greek.slice(1)} Surface`, font: { size: 12, color: '#e4e4e7' } }
        }, { responsive: true, displayModeBar: false });
      }
    });

    const heat = generateHeatmapData(inputs);
    if (chartsRef.heatmap.current) {
      window.Plotly.newPlot(chartsRef.heatmap.current, [{
        x: heat.x,
        y: heat.y,
        z: heat.z,
        type: 'heatmap',
        colorscale: 'RdBu',
        reversescale: true,
      }], {
        ...commonLayout,
        title: { text: 'Price Sensitivity: Spot vs Volatility', font: { size: 14, color: '#e4e4e7' } },
        xaxis: { title: 'Underlying Spot (₹)' },
        yaxis: { title: 'Volatility (σ)' },
        margin: { l: 60, r: 20, b: 50, t: 40 }
      }, { responsive: true, displayModeBar: false });
    }
  }, [backendData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setInputs(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#09090b] text-zinc-100">
      {/* Input Sidebar */}
      <aside className="w-full lg:w-80 border-r border-zinc-800 bg-zinc-900/20 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tighter text-white mb-1">GREEKS PRO</h1>
          <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Black-Scholes Analytics</p>
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Stock Ticker</label>
            <input name="ticker" value={inputs.ticker} onChange={handleInputChange} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Spot Price (₹)</label>
              <input type="number" name="spot" value={inputs.spot} onChange={handleInputChange} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Strike Price (₹)</label>
              <input type="number" name="strike" value={inputs.strike} onChange={handleInputChange} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all w-full" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Expiry Date</label>
            <input type="date" name="expiryDate" value={inputs.expiryDate} onChange={handleInputChange} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Risk Free (%)</label>
              <input type="number" step="0.001" name="riskFreeRate" value={inputs.riskFreeRate} onChange={handleInputChange} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Dividend (%)</label>
              <input type="number" step="0.001" name="dividendYield" value={inputs.dividendYield} onChange={handleInputChange} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all w-full" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Option Type</label>
            <select name="optionType" value={inputs.optionType} onChange={handleInputChange} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm appearance-none focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer w-full">
              <option value="call">Call Option (CE)</option>
              <option value="put">Put Option (PE)</option>
            </select>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4">
           <button 
             onClick={syncBackend}
             disabled={isSyncing}
             className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
           >
             {isSyncing ? (
               <>
                 <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Calculating...
               </>
             ) : (
               'Calculate'
             )}
           </button>
           
           <div className="flex flex-col gap-1">
             <div className={`text-[10px] font-bold transition-colors ${isSyncing ? 'text-emerald-500 animate-pulse' : 'text-zinc-600'}`}>
               {isSyncing ? 'SYNCING ENGINE...' : 'ENGINE READY'}
             </div>
             <p className="text-zinc-500 text-[10px]">All results, including historical volatility and time decay, are processed by your Python backend model.</p>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-y-auto bg-zinc-950">
        {/* Metric Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <div className="md:col-span-2">
            <Card 
              title="Fair Price" 
              value={backendData ? `₹${backendData.fair_price.toFixed(2)}` : '---'} 
              highlight={true} 
              subtext="Theoretical Black-Scholes Value"
            />
          </div>
          <div className="md:col-span-2">
            <Card 
              title="Historical Volatility" 
              value={backendData ? `${(backendData.historical_volatility * 100).toFixed(2)}%` : '---'} 
              subtext="Calculated from your model"
            />
          </div>
          <div className="md:col-span-2">
            <Card 
              title="Time Left to Expiry" 
              value={backendData ? backendData.time_to_expiry : '---'} 
              subtext="Engine-calculated duration"
            />
          </div>
          <Card title="Delta (Δ)" value={backendData ? backendData.delta.toFixed(4) : '---'} subtext="Spot Sensitivity" />
          <Card title="Gamma (Γ)" value={backendData ? backendData.gamma.toFixed(4) : '---'} subtext="Delta Sensitivity" />
          <Card title="Vega (ν)" value={backendData ? backendData.vega.toFixed(4) : '---'} subtext="Vol Sensitivity" />
          <Card title="Theta (Θ)" value={backendData ? backendData.theta.toFixed(4) : '---'} subtext="Time Sensitivity" />
          <Card title="Rho (ρ)" value={backendData ? backendData.rho.toFixed(4) : '---'} subtext="Rate Sensitivity" />
          <Card title="Intrinsic Val" value={backendData ? `₹${Math.max(0, inputs.optionType === 'call' ? inputs.spot - inputs.strike : inputs.strike - inputs.spot).toFixed(2)}` : '---'} />
        </section>

        {/* 3D Visualizations */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 min-h-[400px] shadow-lg shadow-black/40" ref={chartsRef.delta}></div>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 min-h-[400px] shadow-lg shadow-black/40" ref={chartsRef.gamma}></div>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 min-h-[400px] shadow-lg shadow-black/40" ref={chartsRef.theta}></div>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 min-h-[400px] shadow-lg shadow-black/40" ref={chartsRef.vega}></div>
        </section>

        {/* Sensitivity Heatmap */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 min-h-[500px] shadow-lg shadow-black/40" ref={chartsRef.heatmap}></section>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
