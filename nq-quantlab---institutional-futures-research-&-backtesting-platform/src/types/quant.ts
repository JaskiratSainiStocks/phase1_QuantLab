export type Timeframe = '5m' | '15m' | '30m' | '45m' | '1h' | '2h' | '4h' | '1d';

export interface Candle {
  timestamp: number;
  dateStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategyParams {
  fastEma: number;
  slowEma: number;
  rsiPeriod: number;
  rsiLower: number;
  rsiUpper: number;
  contracts: number;
}

export interface Trade {
  id: string;
  type: 'LONG' | 'SHORT';
  entryIndex: number;
  entryTime: string;
  exitIndex: number;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  points: number;
  grossPnL: number;
  friction: number;
  netPnL: number;
  contracts: number;
}

export interface PerformanceMetrics {
  netPnL: number;
  netPnLPct: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  tradeCount: number;
  avgTrade: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  equityCurve: number[];
  drawdownPcts: number[];
}

export interface MonteCarloResult {
  paths: number[][];
  p95: number[];
  p50: number[];
  p05: number[];
  avgMaxDrawdown: number;
  lossProbability: number;
}

export interface OptimizerVariant {
  rank: number;
  fastEma: number;
  slowEma: number;
  rsiLower: number;
  rsiUpper: number;
  netPnL: number;
  profitFactor: number;
  sharpe: number;
  winRate: number;
  maxDrawdownPct: number;
  trades: number;
}

export interface WFOWindowResult {
  window: string;
  dateRange: string;
  isSharpe: number;
  oosSharpe: number;
  isNetPnL: number;
  oosNetPnL: number;
  degradation: number;
}

export interface PaperTrade {
  id: string;
  type: 'BUY_LONG' | 'SELL_SHORT' | 'COVER_SHORT' | 'SELL_LONG' | 'CLOSE_MARKET' | 'FINAL_CLOSE';
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  contracts: number;
  grossPnL: number;
  friction: number;
  netPnL: number;
}
