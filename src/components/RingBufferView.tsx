import { useState } from 'react';
import { History, CheckCircle2, RotateCcw, AlertTriangle, Cpu, Layers } from 'lucide-react';
import { AlertItem, EngineStats, URGENCY_LABELS } from '../types';

interface RingBufferViewProps {
  dispatched: AlertItem[];
  stats: EngineStats;
}

export function RingBufferView({ dispatched, stats }: RingBufferViewProps) {
  const [filterService, setFilterService] = useState('all');

  const services = Array.from(new Set(dispatched.map((d) => d.service)));

  const filtered = dispatched.filter((item) => {
    if (filterService !== 'all' && item.service !== filterService) return false;
    return true;
  });

  const formatTime = (ts: number) => {
    if (!ts) return '—';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getResolutionDuration = (item: AlertItem) => {
    if (!item.dispatchedAt || !item.createdAt) return '—';
    const ms = item.dispatchedAt - item.createdAt;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    return `${min}m ${sec % 60}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Ring Buffer Theory */}
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
            <Cpu className="w-4 h-4" />
            <span>DATA STRUCTURE: BOUNDED CIRCULAR RING BUFFER (O(1) APPEND)</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">
            Dispatched Alert History & Memory-Bounded Ring Buffer
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit log stored in fixed-size array in C. When capacity (50) is reached, old records are overwritten automatically without garbage collection pause.
          </p>
        </div>

        {/* Ring Metrics Badges */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg">
            <div className="text-slate-500">Ring Capacity</div>
            <div className="text-slate-200 font-bold">{stats.dispatchedCount} / 50 slots</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg">
            <div className="text-slate-500">Total Dispatched</div>
            <div className="text-emerald-400 font-bold">{stats.totalDispatched}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg">
            <div className="text-slate-500">Overwritten Slots</div>
            <div className="text-amber-400 font-bold">{stats.totalOverwritten}</div>
          </div>
        </div>
      </div>

      {/* Visual Ring Representation */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Physical Ring Buffer Slot Occupancy [0..49]</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            rb.head = (rb.head + 1) % 50
          </span>
        </div>

        <div className="grid grid-cols-10 sm:grid-cols-25 gap-1.5 pt-1">
          {Array.from({ length: 50 }).map((_, i) => {
            const isOccupied = i < stats.dispatchedCount;
            return (
              <div
                key={i}
                className={`h-7 rounded border flex items-center justify-center font-mono text-[10px] transition-all ${
                  isOccupied
                    ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300 font-bold'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-700'
                }`}
                title={`Slot [${i}]: ${isOccupied ? 'Occupied' : 'Empty'}`}
              >
                {i}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dispatched History Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">Dispatched Audit Log (Most Recent First)</h3>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {filtered.length} entries
            </span>
          </div>

          {services.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Filter service:</span>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2 py-1"
              >
                <option value="all">All Services</option>
                {services.map((svc) => (
                  <option key={svc} value={svc}>{svc}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-xs font-mono text-slate-400">
                <th className="py-2.5 px-4 font-normal">DISPATCH TIME</th>
                <th className="py-2.5 px-4 font-normal">QUEUE DURATION</th>
                <th className="py-2.5 px-4 font-normal">FINAL PRIORITY</th>
                <th className="py-2.5 px-4 font-normal">URGENCY TIER</th>
                <th className="py-2.5 px-4 font-normal">TITLE & MESSAGE</th>
                <th className="py-2.5 px-4 font-normal">SERVICE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id + item.dispatchedAt} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {formatTime(item.dispatchedAt)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {getResolutionDuration(item)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-400 tabular-nums">
                      {item.computedPriority.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${URGENCY_LABELS[item.urgencyLevel].bg} ${URGENCY_LABELS[item.urgencyLevel].color} ${URGENCY_LABELS[item.urgencyLevel].border}`}>
                        {URGENCY_LABELS[item.urgencyLevel].tag}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-200 truncate">{item.title}</div>
                      <div className="text-slate-400 text-[11px] truncate">{item.message}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {item.service}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No alerts have been dispatched yet. Return to the Priority Queue tab and click "Dispatch Alert" to dequeue alerts from the heap.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
