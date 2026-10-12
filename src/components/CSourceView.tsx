import { useState, useEffect } from 'react';
import {
  Code,
  Cpu,
  HardDrive,
  Copy,
  Check,
  ExternalLink,
  Zap,
  Activity,
  Layers,
  Search,
} from 'lucide-react';
import { CSourceInfo, EngineStats, EngineStatus } from '../types';

interface CSourceViewProps {
  stats: EngineStats;
  status: EngineStatus | null;
}

export function CSourceView({ stats, status }: CSourceViewProps) {
  const [sourceData, setSourceData] = useState<CSourceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [highlightKeyword, setHighlightKeyword] = useState('sift_up');

  useEffect(() => {
    fetch('/api/c-source')
      .then((res) => res.json())
      .then((data) => {
        setSourceData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleCopy = () => {
    if (!sourceData) return;
    navigator.clipboard.writeText(sourceData.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jumpToSymbol = (symbol: string) => {
    setHighlightKeyword(symbol);
    const pre = document.getElementById('c-code-container');
    if (!pre || !sourceData) return;
    const lines = sourceData.source.split('\n');
    const idx = lines.findIndex((l) => l.includes(symbol));
    if (idx >= 0) {
      const approxLineHeight = 20;
      pre.scrollTop = Math.max(0, idx * approxLineHeight - 100);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
            <Cpu className="w-4 h-4" />
            <span>NATIVE BACKEND ARCHITECTURE · COMPILED C99 BINARY</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">
            Native C Source Inspector & Invariant Diagnostics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Compiled with <code className="text-slate-200 font-mono bg-slate-800 px-1 py-0.5 rounded">gcc -O3 -Wall -Wextra -Werror</code> and communicating with Node.js via high-speed zero-latency stdio IPC.
          </p>
        </div>

        {/* Compiler & Binary Info */}
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs font-mono space-y-1">
          <div className="text-slate-400">
            Compiler: <span className="text-emerald-400 font-semibold">{status?.compiler || 'gcc 12.3.0'}</span>
          </div>
          <div className="text-slate-500 text-[11px] truncate max-w-xs" title={status?.binaryPath}>
            Bin: {status?.binaryPath || './backend/bin/priority_engine'}
          </div>
        </div>
      </div>

      {/* Low-Level Data Structures Complexity Table */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Algorithmic Complexity & Hardware Performance Bounds</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Insert Alert</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">O(log n)</div>
            <div className="text-[11px] text-slate-400 mt-1">Sift-up bubble</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Peek Highest Priority</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">O(1)</div>
            <div className="text-[11px] text-slate-400 mt-1">Inspect root heap[0]</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Dispatch (Extract-Max)</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">O(log n)</div>
            <div className="text-[11px] text-slate-400 mt-1">Sift-down rebalance</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Hash ID Lookup</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">O(1) avg</div>
            <div className="text-[11px] text-slate-400 mt-1">djb2 chained table</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Escalate / Delete</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">O(log n)</div>
            <div className="text-[11px] text-slate-400 mt-1">Hash find + heap sift</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Starvation Aging Pass</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">O(n)</div>
            <div className="text-[11px] text-slate-400 mt-1">Floyd linear heapify</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Dispatched Ring Log</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">O(1)</div>
            <div className="text-[11px] text-slate-400 mt-1">Circular pointer mod</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <div className="text-slate-500 font-mono text-[11px]">Memory Overhead</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">{(stats.memoryFootprintBytes / 1024).toFixed(1)} KB</div>
            <div className="text-[11px] text-slate-400 mt-1">Predictable static buffer</div>
          </div>
        </div>
      </div>

      {/* Code Inspector with Jump Links */}
      <div className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden shadow-lg">
        {/* Navigation & Jump Toolbar */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-indigo-400" />
            <span className="font-mono text-xs font-bold text-white">backend/priority_engine.c</span>
            {sourceData && (
              <span className="text-slate-500 text-xs font-mono">
                ({sourceData.linesCount} lines · {(sourceData.sizeBytes / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 mr-1">Jump to algorithm:</span>
            {[
              { label: 'sift_up()', symbol: 'sift_up' },
              { label: 'sift_down()', symbol: 'sift_down' },
              { label: 'heap_extract_max()', symbol: 'heap_extract_max' },
              { label: 'hash_djb2()', symbol: 'hash_djb2' },
              { label: 'compute_priority()', symbol: 'compute_alert_priority' },
              { label: 'heap_verify()', symbol: 'heap_verify_invariants' },
            ].map((btn) => (
              <button
                key={btn.symbol}
                onClick={() => jumpToSymbol(btn.symbol)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  highlightKeyword === btn.symbol
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {btn.label}
              </button>
            ))}

            <button
              onClick={handleCopy}
              className="p-1.5 ml-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              title="Copy C source code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Code Content Box */}
        <div
          id="c-code-container"
          className="p-4 overflow-y-auto max-h-[500px] text-xs font-mono leading-relaxed text-slate-300 selection:bg-indigo-700 selection:text-white"
        >
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading compiled C backend source...</div>
          ) : sourceData ? (
            <pre className="whitespace-pre">
              {sourceData.source.split('\n').map((line, idx) => {
                const isHighlighted = highlightKeyword && line.includes(highlightKeyword);
                return (
                  <div
                    key={idx}
                    className={`flex hover:bg-slate-900/60 px-2 rounded ${
                      isHighlighted ? 'bg-indigo-950/60 text-indigo-200 font-semibold' : ''
                    }`}
                  >
                    <span className="w-10 shrink-0 text-slate-600 select-none text-right pr-4">
                      {idx + 1}
                    </span>
                    <span className="overflow-x-auto">{line}</span>
                  </div>
                );
              })}
            </pre>
          ) : (
            <div className="py-12 text-center text-rose-400">Failed to load C source code.</div>
          )}
        </div>
      </div>
    </div>
  );
}
