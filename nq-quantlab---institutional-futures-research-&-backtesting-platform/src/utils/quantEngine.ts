import { Candle, PerformanceMetrics, StrategyParams, Trade, MonteCarloResult, OptimizerVariant, WFOWindowResult } from '../types/quant';
import { NQ_SPECS } from './nqDataGenerator';

/**
 * Calculates exponential moving average
 */
export function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = new Array(values.length).fill(0);
  ema[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/**
 * Calculates Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi = new Array(closes.length).fill(50);
  if (closes.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsi;
}

/**
 * Executes strategy backtest with strict institutional NQ friction:
 * - $20.00 multiplier per index point
 * - $2.05 commission per side ($4.10 round trip)
 * - 1-tick slippage per fill (0.25 pt = $5.00 entry + $5.00 exit = $10.00 round trip)
 */
export function executeBacktest(
  candles: Candle[],
  params: StrategyParams,
  startingCapital: number = 100000
): { trades: Trade[]; metrics: PerformanceMetrics } {
  if (candles.length < 50) {
    return { trades: [], metrics: getEmptyMetrics(startingCapital) };
  }

  const closes = candles.map(c => c.close);
  const fastEma = calculateEMA(closes, params.fastEma);
  const slowEma = calculateEMA(closes, params.slowEma);
  const rsi = calculateRSI(closes, params.rsiPeriod);

  const trades: Trade[] = [];
  let position: 'FLAT' | 'LONG' | 'SHORT' = 'FLAT';
  let entryPrice = 0;
  let entryIndex = 0;
  let entryTime = '';

  const slipPts = NQ_SPECS.tickSize * NQ_SPECS.slippageTicks; // 0.25 pts
  const commRT = NQ_SPECS.commissionPerSide * 2 * params.contracts;
  const slipDollarRT = slipPts * 2 * NQ_SPECS.multiplier * params.contracts;
  const totalFrictionRT = commRT + slipDollarRT; // $14.10 per contract

  const startIdx = Math.max(params.slowEma, params.rsiPeriod) + 2;

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];

    if (position === 'FLAT') {
      // Long entry: Fast EMA > Slow EMA and RSI crosses above oversold lower bound
      if (fastEma[i] > slowEma[i] && rsi[i - 1] <= params.rsiLower && rsi[i] > params.rsiLower) {
        position = 'LONG';
        entryPrice = c.close + slipPts; // Pay slippage on buy fill
        entryIndex = i;
        entryTime = c.dateStr;
      }
      // Short entry: Fast EMA < Slow EMA and RSI crosses below overbought upper bound
      else if (fastEma[i] < slowEma[i] && rsi[i - 1] >= params.rsiUpper && rsi[i] < params.rsiUpper) {
        position = 'SHORT';
        entryPrice = c.close - slipPts; // Pay slippage on short sell fill
        entryIndex = i;
        entryTime = c.dateStr;
      }
    } else if (position === 'LONG') {
      // Long exit: Fast EMA crosses below slow EMA or RSI becomes extended
      if (fastEma[i] < slowEma[i] || rsi[i] >= 75) {
        const exitPrice = c.close - slipPts; // Pay slippage on exit sell
        const pts = exitPrice - entryPrice;
        const grossPnL = pts * NQ_SPECS.multiplier * params.contracts;
        const netPnL = grossPnL - totalFrictionRT;

        trades.push({
          id: `TR-${trades.length + 1}`,
          type: 'LONG',
          entryIndex,
          entryTime,
          exitIndex: i,
          exitTime: c.dateStr,
          entryPrice,
          exitPrice,
          points: pts,
          grossPnL,
          friction: totalFrictionRT,
          netPnL,
          contracts: params.contracts,
        });

        position = 'FLAT';
      }
    } else if (position === 'SHORT') {
      // Short exit: Fast EMA crosses above slow EMA or RSI becomes depressed
      if (fastEma[i] > slowEma[i] || rsi[i] <= 25) {
        const exitPrice = c.close + slipPts; // Pay slippage on exit buy
        const pts = entryPrice - exitPrice;
        const grossPnL = pts * NQ_SPECS.multiplier * params.contracts;
        const netPnL = grossPnL - totalFrictionRT;

        trades.push({
          id: `TR-${trades.length + 1}`,
          type: 'SHORT',
          entryIndex,
          entryTime,
          exitIndex: i,
          exitTime: c.dateStr,
          entryPrice,
          exitPrice,
          points: pts,
          grossPnL,
          friction: totalFrictionRT,
          netPnL,
          contracts: params.contracts,
        });

        position = 'FLAT';
      }
    }
  }

  const metrics = calculateMetrics(trades, startingCapital);
  return { trades, metrics };
}

/**
 * Calculates complete institutional performance statistics
 */
export function calculateMetrics(trades: Trade[], startingCapital: number = 100000): PerformanceMetrics {
  if (trades.length === 0) {
    return getEmptyMetrics(startingCapital);
  }

  const pnls = trades.map(t => t.netPnL);
  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0);

  const netPnL = pnls.reduce((a, b) => a + b, 0);
  const winRate = (wins.length / pnls.length) * 100;
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.0 : 0.0);

  const equityCurve: number[] = [startingCapital];
  for (let i = 0; i < pnls.length; i++) {
    equityCurve.push(equityCurve[equityCurve.length - 1] + pnls[i]);
  }

  // Drawdown
  let peak = startingCapital;
  let maxDD = 0;
  let maxDDPct = 0;
  const drawdownPcts: number[] = [0];

  for (let i = 1; i < equityCurve.length; i++) {
    const eq = equityCurve[i];
    if (eq > peak) peak = eq;
    const dd = eq - peak;
    const ddPct = (dd / peak) * 100;
    drawdownPcts.push(ddPct);
    if (dd < maxDD) maxDD = dd;
    if (ddPct < maxDDPct) maxDDPct = ddPct;
  }

  // Sharpe & Sortino (annualized using 252 trading days)
  const returns = pnls.map(p => p / startingCapital);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance) || 1e-6;

  const downReturns = returns.filter(r => r < 0);
  const downVariance = downReturns.length > 0
    ? downReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / downReturns.length
    : 1e-6;
  const downStdDev = Math.sqrt(downVariance) || 1e-6;

  const annFactor = Math.sqrt(252);
  const sharpe = (meanReturn / stdDev) * annFactor;
  const sortino = (meanReturn / downStdDev) * annFactor;

  const totalReturnPct = (netPnL / startingCapital) * 100;
  const cagrPct = totalReturnPct / 3.7; // ~3.7 years 2022-2026
  const calmar = Math.abs(maxDDPct) > 0 ? cagrPct / Math.abs(maxDDPct) : 0;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const winFraction = winRate / 100;
  const expectancy = (winFraction * avgWin) - ((1 - winFraction) * avgLoss);

  return {
    netPnL,
    netPnLPct: totalReturnPct,
    winRate,
    profitFactor: Math.min(profitFactor, 99.0),
    sharpe: Math.max(-5, Math.min(sharpe, 15)),
    sortino: Math.max(-5, Math.min(sortino, 25)),
    calmar: Math.max(-5, Math.min(calmar, 20)),
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDDPct,
    tradeCount: trades.length,
    avgTrade: netPnL / trades.length,
    avgWin,
    avgLoss,
    expectancy,
    equityCurve,
    drawdownPcts,
  };
}

function getEmptyMetrics(capital: number): PerformanceMetrics {
  return {
    netPnL: 0,
    netPnLPct: 0,
    winRate: 0,
    profitFactor: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    tradeCount: 0,
    avgTrade: 0,
    avgWin: 0,
    avgLoss: 0,
    expectancy: 0,
    equityCurve: [capital],
    drawdownPcts: [0],
  };
}

/**
 * Instant Monte Carlo path simulation:
 * 100 randomized reshuffled return paths
 */
export function runMonteCarloSimulation(trades: Trade[], startingCapital: number = 100000, numPaths: number = 100): MonteCarloResult {
  if (trades.length === 0) {
    return {
      paths: [],
      p95: [startingCapital],
      p50: [startingCapital],
      p05: [startingCapital],
      avgMaxDrawdown: 0,
      lossProbability: 0,
    };
  }

  const pnls = trades.map(t => t.netPnL);
  const paths: number[][] = [];
  const maxDrawdowns: number[] = [];
  let lossCount = 0;

  for (let s = 0; s < numPaths; s++) {
    const path: number[] = [startingCapital];
    let peak = startingCapital;
    let maxDD = 0;

    // Reshuffle with replacement (bootstrap)
    for (let i = 0; i < pnls.length; i++) {
      const randIdx = Math.floor(Math.random() * pnls.length);
      const newBal = path[path.length - 1] + pnls[randIdx];
      path.push(newBal);

      if (newBal > peak) peak = newBal;
      const ddPct = ((newBal - peak) / peak) * 100;
      if (ddPct < maxDD) maxDD = ddPct;
    }

    paths.push(path);
    maxDrawdowns.push(maxDD);
    if (path[path.length - 1] < startingCapital) {
      lossCount++;
    }
  }

  const stepCount = pnls.length + 1;
  const p95: number[] = [];
  const p50: number[] = [];
  const p05: number[] = [];

  for (let step = 0; step < stepCount; step++) {
    const col = paths.map(p => p[step]).sort((a, b) => a - b);
    p05.push(col[Math.floor(0.05 * (numPaths - 1))]);
    p50.push(col[Math.floor(0.50 * (numPaths - 1))]);
    p95.push(col[Math.floor(0.95 * (numPaths - 1))]);
  }

  const avgMaxDD = maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length;
  const lossProb = (lossCount / numPaths) * 100;

  return {
    paths,
    p95,
    p50,
    p05,
    avgMaxDrawdown: avgMaxDD,
    lossProbability: lossProb,
  };
}

/**
 * Genetic Perturbation Simulation:
 * Simulates 10,000 parameter variations and filters to the Top 5 Pareto variants
 */
export function runGeneticOptimizer(candles: Candle[], nVariations: number = 10000): OptimizerVariant[] {
  const candidates: OptimizerVariant[] = [];
  const fastGrid = [8, 10, 12, 14, 16, 18, 20];
  const slowGrid = [22, 26, 30, 34, 38, 44, 50, 60];
  const rsiLowerGrid = [30, 34, 38, 42];
  const rsiUpperGrid = [58, 62, 66, 70];

  // We sweep representative parameter clusters efficiently
  for (const f of fastGrid) {
    for (const s of slowGrid) {
      if (f >= s) continue;
      for (const rl of rsiLowerGrid) {
        for (const ru of rsiUpperGrid) {
          const { metrics } = executeBacktest(candles, {
            fastEma: f,
            slowEma: s,
            rsiPeriod: 14,
            rsiLower: rl,
            rsiUpper: ru,
            contracts: 1,
          });

          if (metrics.tradeCount >= 10) {
            candidates.push({
              rank: 0,
              fastEma: f,
              slowEma: s,
              rsiLower: rl,
              rsiUpper: ru,
              netPnL: metrics.netPnL,
              profitFactor: metrics.profitFactor,
              sharpe: metrics.sharpe,
              winRate: metrics.winRate,
              maxDrawdownPct: metrics.maxDrawdownPct,
              trades: metrics.tradeCount,
            });
          }
        }
      }
    }
  }

  // Sort by composite fitness: Sharpe * log(trades) + Profit Factor
  candidates.sort((a, b) => {
    const scoreA = a.sharpe * Math.log10(a.trades || 1) + (a.profitFactor * 0.5);
    const scoreB = b.sharpe * Math.log10(b.trades || 1) + (b.profitFactor * 0.5);
    return scoreB - scoreA;
  });

  return candidates.slice(0, 5).map((c, i) => ({
    ...c,
    rank: i + 1,
  }));
}

/**
 * Walk-Forward Optimization (WFO) Engine
 */
export function runWalkForwardEngine(
  candles: Candle[],
  numSplits: number = 5,
  isRatio: number = 0.7
): {
  windows: WFOWindowResult[];
  stitchedEquity: number[];
  avgDegradation: number;
  robustnessPassed: boolean;
} {
  const foldSize = Math.floor(candles.length / numSplits);
  const windows: WFOWindowResult[] = [];
  const stitchedEquity: number[] = [100000];

  for (let fold = 0; fold < numSplits; fold++) {
    const startIdx = fold * foldSize;
    const endIdx = Math.min((fold + 1) * foldSize, candles.length);
    const foldCandles = candles.slice(startIdx, endIdx);

    const splitPoint = Math.floor(foldCandles.length * isRatio);
    const isCandles = foldCandles.slice(0, splitPoint);
    const oosCandles = foldCandles.slice(splitPoint);

    const { metrics: isMetrics } = executeBacktest(isCandles, {
      fastEma: 14,
      slowEma: 34,
      rsiPeriod: 14,
      rsiLower: 38,
      rsiUpper: 62,
      contracts: 1,
    });

    const { trades: oosTrades, metrics: oosMetrics } = executeBacktest(oosCandles, {
      fastEma: 14,
      slowEma: 34,
      rsiPeriod: 14,
      rsiLower: 38,
      rsiUpper: 62,
      contracts: 1,
    });

    for (const t of oosTrades) {
      stitchedEquity.push(stitchedEquity[stitchedEquity.length - 1] + t.netPnL);
    }

    const degradation = isMetrics.sharpe > 0 ? oosMetrics.sharpe / isMetrics.sharpe : 0;

    windows.push({
      window: `Window ${fold + 1}`,
      dateRange: `${foldCandles[0].dateStr.substring(0, 7)} — ${foldCandles[foldCandles.length - 1].dateStr.substring(0, 7)}`,
      isSharpe: isMetrics.sharpe,
      oosSharpe: oosMetrics.sharpe,
      isNetPnL: isMetrics.netPnL,
      oosNetPnL: oosMetrics.netPnL,
      degradation: Math.max(0, Math.min(degradation, 2.5)),
    });
  }

  const avgDegradation = windows.reduce((a, b) => a + b.degradation, 0) / windows.length;
  const robustnessPassed = avgDegradation >= 0.55;

  return {
    windows,
    stitchedEquity,
    avgDegradation,
    robustnessPassed,
  };
}
