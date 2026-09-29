import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Candle } from '../types/quant';

interface Props {
  candles: Candle[];
  activePosition?: {
    type: 'LONG' | 'SHORT' | 'FLAT';
    entryPrice: number;
    contracts: number;
  };
  height?: number;
}

export const TradingViewChart: React.FC<Props> = ({
  candles,
  activePosition,
  height = 420
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(100);

  // Take the most recent slice based on visibleCount
  const sliceData = useMemo(() => {
    return candles.slice(Math.max(0, candles.length - visibleCount));
  }, [candles, visibleCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sliceData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 800;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Layout configuration
    const paddingRight = 75; // Price scale
    const paddingBottom = 30; // Time scale
    const paddingTop = 24;
    const plotWidth = width - paddingRight;
    const plotHeight = height - paddingBottom - paddingTop;
    const candleAreaHeight = plotHeight * 0.76;
    const volAreaTop = paddingTop + candleAreaHeight + 12;
    const volAreaHeight = plotHeight - candleAreaHeight - 12;

    // Background
    ctx.fillStyle = '#080C14';
    ctx.fillRect(0, 0, width, height);

    // Compute min / max prices
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    for (const c of sliceData) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    }

    const priceBuffer = (maxPrice - minPrice) * 0.05 || 10;
    minPrice -= priceBuffer;
    maxPrice += priceBuffer;
    const priceRange = maxPrice - minPrice || 1;

    const n = sliceData.length;
    const barWidth = plotWidth / n;
    const candleWidth = Math.max(1.5, barWidth * 0.72);

    // Draw Subtle Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    // Horizontal Price Grids (5 levels)
    const priceSteps = 5;
    ctx.fillStyle = '#64748B';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i <= priceSteps; i++) {
      const p = minPrice + (priceRange * i) / priceSteps;
      const y = paddingTop + candleAreaHeight - ((p - minPrice) / priceRange) * candleAreaHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      // Price Label on right axis
      ctx.fillText(p.toFixed(2), plotWidth + 8, y + 3);
    }

    // Right Axis Separator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(plotWidth, 0);
    ctx.lineTo(plotWidth, height);
    ctx.moveTo(0, paddingTop + candleAreaHeight);
    ctx.lineTo(plotWidth, paddingTop + candleAreaHeight);
    ctx.stroke();

    // Draw Volume Bars
    for (let i = 0; i < n; i++) {
      const c = sliceData[i];
      const x = i * barWidth + barWidth / 2;
      const volHeight = maxVol > 0 ? (c.volume / maxVol) * volAreaHeight : 0;
      const y = height - paddingBottom - volHeight;

      ctx.fillStyle = c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)';
      ctx.fillRect(x - candleWidth / 2, y, candleWidth, volHeight);
    }

    // Draw Candlesticks
    for (let i = 0; i < n; i++) {
      const c = sliceData[i];
      const x = i * barWidth + barWidth / 2;
      const isBull = c.close >= c.open;

      const openY = paddingTop + candleAreaHeight - ((c.open - minPrice) / priceRange) * candleAreaHeight;
      const closeY = paddingTop + candleAreaHeight - ((c.close - minPrice) / priceRange) * candleAreaHeight;
      const highY = paddingTop + candleAreaHeight - ((c.high - minPrice) / priceRange) * candleAreaHeight;
      const lowY = paddingTop + candleAreaHeight - ((c.low - minPrice) / priceRange) * candleAreaHeight;

      const color = isBull ? '#10B981' : '#F43F5E';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      // Wick
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    }

    // Draw Active Position Line if in Paper Trade
    if (activePosition && activePosition.type !== 'FLAT') {
      const posColor = activePosition.type === 'LONG' ? '#10B981' : '#F43F5E';
      const posEntryY = paddingTop + candleAreaHeight - ((activePosition.entryPrice - minPrice) / priceRange) * candleAreaHeight;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = posColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, posEntryY);
      ctx.lineTo(plotWidth, posEntryY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Position Label Box
      ctx.fillStyle = posColor;
      ctx.fillRect(plotWidth + 2, posEntryY - 9, paddingRight - 6, 18);
      ctx.fillStyle = '#030712';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`${activePosition.type} ${activePosition.contracts}x`, plotWidth + 6, posEntryY + 3);
    }

    // Draw Crosshair if hovering
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n) {
      const hc = sliceData[hoverIndex];
      const hx = hoverIndex * barWidth + barWidth / 2;
      const hy = paddingTop + candleAreaHeight - ((hc.close - minPrice) / priceRange) * candleAreaHeight;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, height - paddingBottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(plotWidth, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price Tag on Right Axis
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(plotWidth + 2, hy - 9, paddingRight - 4, 18);
      ctx.fillStyle = '#030712';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(hc.close.toFixed(2), plotWidth + 6, hy + 3);

      // Date Tag on Bottom Axis
      ctx.fillStyle = '#1E293B';
      const timeStr = hc.dateStr.substring(5, 16);
      ctx.fillRect(hx - 45, height - paddingBottom + 4, 90, 18);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, hx, height - paddingBottom + 16);
      ctx.textAlign = 'left';
    }

    // Time Axis Labels (5 interval labels)
    ctx.fillStyle = '#64748B';
    ctx.font = '10px "JetBrains Mono", monospace';
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
      const idx = Math.min(n - 1, Math.floor((n - 1) * (i / timeSteps)));
      const x = idx * barWidth + barWidth / 2;
      const label = sliceData[idx].dateStr.substring(5, 10);
      ctx.fillText(label, x - 12, height - 8);
    }
  }, [sliceData, height, hoverIndex, activePosition]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || sliceData.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - 75;

    if (x >= 0 && x <= plotWidth) {
      const barWidth = plotWidth / sliceData.length;
      const idx = Math.floor(x / barWidth);
      if (idx >= 0 && idx < sliceData.length) {
        setHoverIndex(idx);
      }
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const currentHoverCandle = hoverIndex !== null && hoverIndex < sliceData.length
    ? sliceData[hoverIndex]
    : sliceData[sliceData.length - 1];

  return (
    <div ref={containerRef} className="relative rounded-lg border border-white/[0.08] bg-[#080C14] overflow-hidden select-none">
      {/* Top HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-white/[0.06] bg-[#0B111D]/80 text-xs">
        <div className="flex items-center gap-3 font-mono">
          <span className="font-bold text-sky-400">NQ Futures</span>
          {currentHoverCandle && (
            <div className="flex items-center gap-3 text-slate-400">
              <span>O: <strong className="text-slate-200">{currentHoverCandle.open.toFixed(2)}</strong></span>
              <span>H: <strong className="text-slate-200">{currentHoverCandle.high.toFixed(2)}</strong></span>
              <span>L: <strong className="text-slate-200">{currentHoverCandle.low.toFixed(2)}</strong></span>
              <span>C: <strong className={currentHoverCandle.close >= currentHoverCandle.open ? 'text-emerald-400' : 'text-rose-400'}>{currentHoverCandle.close.toFixed(2)}</strong></span>
              <span>Vol: <strong className="text-slate-300">{currentHoverCandle.volume.toLocaleString()}</strong></span>
            </div>
          )}
        </div>

        {/* Viewport Range Controls */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <span>Bars:</span>
          {[60, 100, 180, 300].map(cnt => (
            <button
              key={cnt}
              onClick={() => setVisibleCount(cnt)}
              className={`px-2 py-0.5 rounded transition-colors ${
                visibleCount === cnt
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cnt}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas Chart */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair w-full block"
      />
    </div>
  );
};
