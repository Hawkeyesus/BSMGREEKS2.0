
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BSMInputs, BSMOutputs, OptionType } from './types';
import { calculateBSM, generateSurfaceData, generateHeatmapData } from './mathUtils';
import { GoogleGenAI } from "@google/genai";

// Plotly is expected to be available on window from index.html script tag
declare global {
  interface Window {
    Plotly: any;
  }
}

const DEFAULT_INPUTS: BSMInputs = {
  ticker: 'AAPL',
  strike: 150,
  spot: 155,
  expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  riskFreeRate: 0.05,
  dividendYield: 0.01,
  optionType: 'call',
  volatility: 0.25,
};

const Card = ({ title, value, unit = "", subtext = "" }: { title: string; value: string | number; unit?: string; subtext?: string }) => (
  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl shadow-sm">
    <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</h3>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-zinc-500 text-sm">{unit}</span>
    </div>
    {subtext && <p className="text-zinc-500 text-[10px] mt-1 italic">{subtext}</p>}
  </div>
);

const App = () => {
  const [inputs, setInputs] = useState<BSMInputs>(DEFAULT_INPUTS);
  const [histVol, setHistVol] = useState<number | null>(null);
  const [isLoadingVol, setIsLoadingVol] = useState(false);

  const outputs = useMemo(() => calculateBSM(inputs), [inputs]);

  const chartsRef = {
    delta: useRef<HTMLDivElement>(null),
    gamma: useRef<HTMLDivElement>(null),
    theta: useRef<HTMLDivElement>(null),
    vega: useRef<HTMLDivElement>(null),
    heatmap: useRef<HTMLDivElement>(null),
  };

  const fetchHistoricalVolatility = async () => {
    setIsLoadingVol(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `What is the approximate current annualized historical volatility (30-day) for ${inputs.ticker}? Respond only with a single number representing the percentage, e.g., 0.25 for 25%. If unknown, return 0.30.`,
      });
      const vol = parseFloat(response.text?.trim() || "0.30");
      if (!isNaN(vol)) {
        setHistVol(vol);
        setInputs(prev => ({ ...prev, volatility: vol }));
      }
    } catch (error) {
      console.error("Failed to fetch volatility:", error);
    } finally {
      setIsLoadingVol(false);
    }
  };

  useEffect(() => {
    const commonLayout = {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#a1a1aa', size: 10 },
      margin: { l: 0, r: 0, b: 0, t: 30 },
      scene: {
        xaxis: { title: 'Spot Price', gridcolor: '#27272a' },
        yaxis: { title: 'Time to Expiry (Y)', gridcolor: '#27272a' },
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
          title: { text: greek.charAt(0).toUpperCase() + greek.slice(1), font: { size: 14, color: '#fff' } }
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
        title: { text: 'Price Sensitivity: Spot vs Volatility', font: { size: 14, color: '#fff' } },
        xaxis: { title: 'Underlying Spot Price' },
        yaxis: { title: 'Volatility (σ)' },
        margin: { l: 60, r: 20, b: 60, t: 40 }
      }, { responsive: true, displayModeBar: false });
    }
  }, [inputs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setInputs(prev => ({
      ...prev,
      [name]: type === 'number' || type === 'range' ? parseFloat(value) : value
    }));
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 border-r border-zinc-800 bg-zinc-900/30 p-6 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Black-Scholes Pro</h1>
          <p className="text-zinc-500 text-xs italic">Advanced Options Analytics</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs font-medium">Stock Ticker</label>
            <div className="flex gap-2">
              <input 
                name="ticker" value={inputs.ticker} onChange={handleInputChange}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
              <button 
                onClick={fetchHistoricalVolatility}
                disabled={isLoadingVol}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-bold px-2 rounded uppercase tracking-tighter transition-colors"
              >
                {isLoadingVol ? '...' : 'Fetch Vol'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs font-medium">Spot Price</label>
              <input type="number" name="spot" value={inputs.spot} onChange={handleInputChange} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs font-medium">Strike Price</label>
              <input type="number" name="strike" value={inputs.strike} onChange={handleInputChange} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs font-medium">Date of Expiry</label>
            <input type="date" name="expiryDate" value={inputs.expiryDate} onChange={handleInputChange} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs font-medium">Risk Free Rate (%)</label>
              <input type="number" step="0.001" name="riskFreeRate" value={inputs.riskFreeRate} onChange={handleInputChange} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs font-medium">Dividend (%)</label>
              <input type="number" step="0.001" name="dividendYield" value={inputs.dividendYield} onChange={handleInputChange} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs font-medium">Option Type</label>
            <select name="optionType" value={inputs.optionType} onChange={handleInputChange} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm appearance-none cursor-pointer">
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-zinc-800">
            <div className="flex justify-between items-center">
              <label className="text-zinc-400 text-xs font-medium">Volatility Dragger (σ)</label>
              <span className="text-blue-400 text-xs font-bold">{(inputs.volatility * 100).toFixed(1)}%</span>
            </div>
            <input 
              type="range" name="volatility" min="0.01" max="2.0" step="0.01" 
              value={inputs.volatility} onChange={handleInputChange}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-zinc-800">
           {histVol !== null && (
             <div className="text-[10px] text-zinc-500 space-y-1">
               <div className="flex justify-between">
                 <span>Reported Hist. Vol:</span>
                 <span className="text-zinc-300 font-mono">{(histVol * 100).toFixed(2)}%</span>
               </div>
               <div className="flex justify-between">
                 <span>Time to Expiry:</span>
                 <span className="text-zinc-300 font-mono">{outputs.timeToExpiry.toFixed(4)} Y</span>
               </div>
             </div>
           )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Output Row */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="col-span-2 md:col-span-1 bg-blue-600/10 border border-blue-500/30 p-4 rounded-xl shadow-lg ring-1 ring-blue-500/20">
            <h3 className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">Fair Price</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">${outputs.price.toFixed(4)}</span>
            </div>
          </div>
          <Card title="Delta (Δ)" value={outputs.delta.toFixed(4)} subtext="Rate of change w.r.t Spot" />
          <Card title="Gamma (Γ)" value={outputs.gamma.toFixed(4)} subtext="Rate of change w.r.t Delta" />
          <Card title="Vega (ν)" value={outputs.vega.toFixed(4)} subtext="Sensitivity to Volatility" />
          <Card title="Theta (Θ)" value={outputs.theta.toFixed(4)} subtext="Time decay (per day)" />
          <Card title="Rho (ρ)" value={outputs.rho.toFixed(4)} subtext="Sensitivity to Interest Rates" />
        </section>

        {/* 3D Greeks Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 min-h-[350px]" ref={chartsRef.delta}></div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 min-h-[350px]" ref={chartsRef.gamma}></div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 min-h-[350px]" ref={chartsRef.theta}></div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 min-h-[350px]" ref={chartsRef.vega}></div>
        </section>

        {/* Heatmap Row */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 min-h-[450px]" ref={chartsRef.heatmap}></section>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
