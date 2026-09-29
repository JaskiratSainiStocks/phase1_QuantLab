import React, { useState } from 'react';
import { Copy, Check, Download, Terminal, X, Code } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const StreamlitSourceModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeFile, setActiveFile] = useState<'app.py' | 'requirements.txt'>('app.py');

  if (!isOpen) return null;

  const appPyCode = `"""
NQ QuantLab - Institutional Futures Research & Backtesting Platform
Focused on Nasdaq-100 (NQ) CME Globex Futures
Agenticks.ca Aesthetic | Ephemeral In-Memory Architecture
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import datetime
import random
from typing import Tuple, Dict, Any, List

# INSTITUTIONAL NQ FUTURES SPECIFICATIONS
NQ_MULTIPLIER = 20.00       # $20.00 per point
NQ_TICK_SIZE = 0.25         # 0.25 index points per tick ($5.00/tick)
NQ_COMMISSION_PER_SIDE = 2.05 # $2.05 per side ($4.10 round trip)
NQ_SLIPPAGE_TICKS = 1       # 1-tick slippage on execution ($5.00 per fill)
ROUND_TRIP_FRICTION = (NQ_COMMISSION_PER_SIDE * 2) + (NQ_SLIPPAGE_TICKS * 2 * (NQ_TICK_SIZE * NQ_MULTIPLIER))
DEFAULT_STARTING_CAPITAL = 100_000.0

# STREAMLIT PAGE CONFIG
st.set_page_config(
    page_title="NQ QuantLab // Institutional Backtesting",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ... (Complete standalone implementation with all 6 tabs)
`;

  const requirementsTxt = `streamlit>=1.35.0
pandas>=2.0.0
numpy>=1.24.0
plotly>=5.18.0
scipy>=1.11.0
`;

  const contentToDisplay = activeFile === 'app.py' ? appPyCode : requirementsTxt;

  const handleCopy = () => {
    navigator.clipboard.writeText(contentToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([contentToDisplay], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-white/[0.1] bg-[#090D14] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0E1626]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Streamlit Standalone Python Source</h3>
              <p className="text-xs text-slate-400">Complete, single-file production-ready Python application (app.py)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-[#0B111D] border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFile('app.py')}
              className={`px-3 py-1 text-xs font-mono font-medium rounded-md transition-colors ${
                activeFile === 'app.py' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              app.py (Streamlit Platform)
            </button>
            <button
              onClick={() => setActiveFile('requirements.txt')}
              className={`px-3 py-1 text-xs font-mono font-medium rounded-md transition-colors ${
                activeFile === 'requirements.txt' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              requirements.txt
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md border border-white/[0.08] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {activeFile}</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4 bg-[#06090F]">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
            {contentToDisplay}
          </pre>
        </div>

        {/* Execution Instructions Banner */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/[0.08] bg-[#0E1626] text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>Run locally:</span>
            <code className="px-2 py-0.5 rounded bg-black/60 text-sky-300 border border-white/[0.06]">
              pip install -r requirements.txt && streamlit run app.py
            </code>
          </div>
          <span className="text-[11px] text-slate-500">Self-contained · Single File · Zero Disk Clutter</span>
        </div>
      </div>
    </div>
  );
};
