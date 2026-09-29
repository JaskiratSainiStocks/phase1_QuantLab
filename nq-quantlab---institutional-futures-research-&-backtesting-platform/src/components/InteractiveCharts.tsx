import React, { useMemo } from 'react';
import { MonteCarloResult } from '../types/quant';

interface EquityCurveProps {
  equityCurve: number[];
  drawdownPcts: number[];
  height?: number;
}

export const EquityCurveChart: React.FC<EquityCurveProps> = ({ equityCurve, height = 240 }) => {
  const { pathData, peakData, minVal, maxVal } = useMemo(() => {
    if (equityCurve.length === 0) return { pathData: '', peakData: '', minVal: 0, maxVal: 100000 };

    let min = Infinity;
    let max = -Infinity;
    let runningPeak = equityCurve[0];
    const peaks: number[] = [];

    for (const v of equityCurve) {
      if (v > runningPeak) runningPeak = v;
      peaks.push(runningPeak);
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const buffer = (max - min) * 0.05 || 5000;
    min -= buffer;
    max += buffer;
    const range = max - min || 1;

    const n = equityCurve.length;
    const points: string[] = [];
    const peakPoints: string[] = [];

    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1 || 1)) * 1000;
      const y = 200 - ((equityCurve[i] - min) / range) * 190;
      const peakY = 200 - ((peaks[i] - min) / range) * 190;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      peakPoints.push(`${x.toFixed(1)},${peakY.toFixed(1)}`);
    }

    return {
      pathData: points.join(' '),
      peakData: peakPoints.join(' '),
      minVal: min,
      maxVal: max,
    };
  }, [equityCurve]);

  return (
    <div className="relative w-full rounded-lg border border-white/[0.08] bg-[#0B111D] p-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-semibold text-slate-300">Cumulative Portfolio Equity</span>
        <span className="font-mono text-sky-400 font-bold">
          ${(equityCurve[equityCurve.length - 1] || 100000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="relative w-full" style={{ height: `${height}px` }}>
        <svg viewBox="0 0 1000 210" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="50" x2="1000" y2="50" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <line x1="0" y1="100" x2="1000" y2="100" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <line x1="0" y1="150" x2="1000" y2="150" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

          {/* Area Fill */}
          {pathData && (
            <polygon
              points={`0,205 ${pathData} 1000,205`}
              fill="url(#eqGradient)"
            />
          )}

          {/* Peak High Watermark Line */}
          {peakData && (
            <polyline
              points={peakData}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
          )}

          {/* Main Equity Line */}
          {pathData && (
            <polyline
              points={pathData}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
        <span>Trade #0</span>
        <span>Trade #{equityCurve.length - 1}</span>
      </div>
    </div>
  );
};

export const DrawdownChart: React.FC<{ drawdownPcts: number[]; height?: number }> = ({ drawdownPcts, height = 240 }) => {
  const { pathData, minDD } = useMemo(() => {
    if (drawdownPcts.length === 0) return { pathData: '', minDD: 0 };
    const min = Math.min(...drawdownPcts);
    const range = Math.abs(min) || 10;
    const n = drawdownPcts.length;

    const points: string[] = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1 || 1)) * 1000;
      const y = (Math.abs(drawdownPcts[i]) / range) * 180 + 10;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return { pathData: points.join(' '), minDD: min };
  }, [drawdownPcts]);

  return (
    <div className="relative w-full rounded-lg border border-white/[0.08] bg-[#0B111D] p-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-semibold text-slate-300">Underwater Drawdown</span>
        <span className="font-mono text-rose-400 font-bold">{minDD.toFixed(1)}% Max DD</span>
      </div>

      <div className="relative w-full" style={{ height: `${height}px` }}>
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {/* Zero baseline */}
          <line x1="0" y1="10" x2="1000" y2="10" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

          {/* Area Fill */}
          {pathData && (
            <polygon
              points={`0,10 ${pathData} 1000,10`}
              fill="url(#ddGradient)"
            />
          )}

          {/* Drawdown Curve */}
          {pathData && (
            <polyline
              points={pathData}
              fill="none"
              stroke="#F43F5E"
              strokeWidth="2"
            />
          )}
        </svg>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
        <span>0.0%</span>
        <span>{minDD.toFixed(1)}%</span>
      </div>
    </div>
  );
};

export const MonteCarloChart: React.FC<{ result: MonteCarloResult; height?: number }> = ({ result, height = 240 }) => {
  const { p95Points, p50Points, p05Points, minVal, maxVal } = useMemo(() => {
    if (!result.p50 || result.p50.length === 0) return { p95Points: '', p50Points: '', p05Points: '', minVal: 0, maxVal: 0 };
    const allVals = [...result.p95, ...result.p50, ...result.p05];
    let min = Math.min(...allVals);
    let max = Math.max(...allVals);
    const buffer = (max - min) * 0.05 || 5000;
    min -= buffer;
    max += buffer;
    const range = max - min || 1;
    const n = result.p50.length;

    const toPoints = (arr: number[]) => {
      return arr.map((v, i) => {
        const x = (i / (n - 1 || 1)) * 1000;
        const y = 200 - ((v - min) / range) * 190;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    };

    return {
      p95Points: toPoints(result.p95),
      p50Points: toPoints(result.p50),
      p05Points: toPoints(result.p05),
      minVal: min,
      maxVal: max,
    };
  }, [result]);

  return (
    <div className="relative w-full rounded-lg border border-white/[0.08] bg-[#0B111D] p-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-semibold text-slate-300">Monte Carlo Simulation (100 Reshuffled Paths)</span>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-emerald-400">95th %ile</span>
          <span className="text-sky-400">50th %ile (Median)</span>
          <span className="text-rose-400">5th %ile (Worst)</span>
        </div>
      </div>

      <div className="relative w-full" style={{ height: `${height}px` }}>
        <svg viewBox="0 0 1000 210" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          {/* Subtle background paths */}
          {result.paths.slice(0, 30).map((path, idx) => {
            const range = maxVal - minVal || 1;
            const pts = path.map((v, i) => {
              const x = (i / (path.length - 1 || 1)) * 1000;
              const y = 200 - ((v - minVal) / range) * 190;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            return (
              <polyline
                key={idx}
                points={pts}
                fill="none"
                stroke="rgba(56, 189, 248, 0.05)"
                strokeWidth="1"
              />
            );
          })}

          {/* 95th Percentile */}
          {p95Points && <polyline points={p95Points} fill="none" stroke="#10B981" strokeWidth="2" />}
          {/* 50th Percentile */}
          {p50Points && <polyline points={p50Points} fill="none" stroke="#38BDF8" strokeWidth="2.5" />}
          {/* 5th Percentile */}
          {p05Points && <polyline points={p05Points} fill="none" stroke="#F43F5E" strokeWidth="2" />}
        </svg>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
        <span>Worst Case: ${result.p05[result.p05.length - 1]?.toLocaleString() || 0}</span>
        <span>Median: ${result.p50[result.p50.length - 1]?.toLocaleString() || 0}</span>
        <span>Best Case: ${result.p95[result.p95.length - 1]?.toLocaleString() || 0}</span>
      </div>
    </div>
  );
};

export const TradeDistributionChart: React.FC<{ pnls: number[]; height?: number }> = ({ pnls, height = 240 }) => {
  const { bins, maxBinCount } = useMemo(() => {
    if (pnls.length === 0) return { bins: [], maxBinCount: 1 };
    const numBins = 16;
    const min = Math.min(...pnls);
    const max = Math.max(...pnls);
    const binWidth = (max - min) / numBins || 1;

    const b = Array.from({ length: numBins }, (_, i) => ({
      from: min + i * binWidth,
      to: min + (i + 1) * binWidth,
      count: 0,
      isPositive: min + (i + 0.5) * binWidth >= 0,
    }));

    for (const p of pnls) {
      const idx = Math.min(numBins - 1, Math.floor((p - min) / binWidth));
      if (idx >= 0 && idx < numBins) b[idx].count++;
    }

    const maxCount = Math.max(...b.map(x => x.count)) || 1;
    return { bins: b, maxBinCount: maxCount };
  }, [pnls]);

  return (
    <div className="relative w-full rounded-lg border border-white/[0.08] bg-[#0B111D] p-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-semibold text-slate-300">Trade PnL Distribution</span>
        <span className="font-mono text-slate-400">{pnls.length} Trades</span>
      </div>

      <div className="flex items-end justify-between gap-1 w-full" style={{ height: `${height}px` }}>
        {bins.map((bin, i) => {
          const hPct = (bin.count / maxBinCount) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              <div
                style={{ height: `${Math.max(4, hPct)}%` }}
                className={`w-full rounded-t transition-all ${
                  bin.isPositive
                    ? 'bg-emerald-500/60 hover:bg-emerald-400'
                    : 'bg-rose-500/60 hover:bg-rose-400'
                }`}
              />
              {/* Tooltip */}
              <div className="absolute -top-7 hidden group-hover:block bg-[#1E293B] text-[10px] font-mono text-slate-200 px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                {bin.count} trades (${bin.from.toFixed(0)} to ${bin.to.toFixed(0)})
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
        <span>Loss Tail</span>
        <span>Breakeven ($0)</span>
        <span>Profit Tail</span>
      </div>
    </div>
  );
};
