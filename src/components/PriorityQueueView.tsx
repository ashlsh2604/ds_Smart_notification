import { useState } from 'react';
import {
  AlertTriangle,
  Flame,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Trash2,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Cpu,
} from 'lucide-react';
import { AlertItem, EngineStats, URGENCY_LABELS, UrgencyLevel } from '../types';

interface PriorityQueueViewProps {
  heap: AlertItem[];
  stats: EngineStats;
  onDispatch: () => Promise<void>;
  onBatchDispatch: (count: number) => Promise<void>;
  onEscalate: (id: string, currentUrgency: UrgencyLevel, currentSeverity: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAgeTick: () => Promise<void>;
  onSeed: () => Promise<void>;
  onOpenIngest: () => void;
  loading: boolean;
}

export function PriorityQueueView({
  heap,
  stats,
  onDispatch,
  onBatchDispatch,
  onEscalate,
  onDelete,
  onAgeTick,
  onSeed,
  onOpenIngest,
  loading,
}: PriorityQueueViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<number | 'all'>('all');

  const rootAlert = heap.length > 0 ? heap[0] : null;

  const filteredHeap = heap.filter((item) => {
    if (filterUrgency !== 'all' && item.urgencyLevel !== filterUrgency) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchService = item.service.toLowerCase().includes(q);
      const matchTags = item.tags.toLowerCase().includes(q);
      const matchMsg = item.message.toLowerCase().includes(q);
      return matchTitle || matchService || matchTags || matchMsg;
    }
    return true;
  });

  const formatElapsed = (createdMs: number) => {
    const sec = Math.max(0, Math.floor((Date.now() - createdMs) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ${sec % 60}s ago`;
    return `${Math.floor(min / 60)}h ${min % 60}m ago`;
  };

  const getSlaStatus = (item: AlertItem) => {
    const elapsedSec = (Date.now() - item.createdAt) / 1000;
    const remaining = Math.floor(item.slaSeconds - elapsedSec);
    if (remaining < 0) {
      return { text: `Breached by ${Math.abs(remaining)}s`, color: 'text-rose-400 font-semibold' };
    }
    if (remaining < 60) {
      return { text: `${remaining}s remaining`, color: 'text-amber-400 font-medium' };
    }
    const mins = Math.floor(remaining / 60);
    return { text: `${mins}m ${remaining % 60}s remaining`, color: 'text-slate-400' };
  };

  return (
    <div className="space-y-6">
      {/* Root Node / Priority Spotlight Banner */}
      {rootAlert ? (
        <div className="border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
            <Cpu className="w-36 h-36 text-indigo-400" />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-indigo-400 font-semibold bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded">
                  HEAP ROOT [Index 0]
                </span>
                <span className="text-slate-600">·</span>
                <span className={`px-2 py-0.5 rounded font-mono font-semibold text-xs ${URGENCY_LABELS[rootAlert.urgencyLevel].bg} ${URGENCY_LABELS[rootAlert.urgencyLevel].color} border ${URGENCY_LABELS[rootAlert.urgencyLevel].border}`}>
                  {URGENCY_LABELS[rootAlert.urgencyLevel].name}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 font-mono">Service: {rootAlert.service}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{formatElapsed(rootAlert.createdAt)}</span>
              </div>

              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>{rootAlert.title}</span>
              </h2>

              <p className="text-sm text-slate-300 max-w-3xl line-clamp-2">
                {rootAlert.message}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>Severity: <strong className="font-mono text-white">{rootAlert.severityScore}/100</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>SLA: <strong className={getSlaStatus(rootAlert).color}>{getSlaStatus(rootAlert).text}</strong></span>
                </div>
                {rootAlert.ageBoostCount > 0 && (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Starvation Boosted: +{rootAlert.ageBoostCount}x</span>
                  </div>
                )}
                <div className="text-slate-500 font-mono">
                  Tags: {rootAlert.tags}
                </div>
              </div>
            </div>

            {/* Score & Action */}
            <div className="flex items-center lg:flex-col lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
              <div className="text-left lg:text-right">
                <div className="text-xs text-slate-400">Effective Priority Score</div>
                <div className="text-3xl font-mono font-bold text-indigo-400 tabular-nums">
                  {rootAlert.computedPriority.toFixed(2)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEscalate(rootAlert.id, rootAlert.urgencyLevel, rootAlert.severityScore)}
                  disabled={loading}
                  className="px-3 py-2 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/50 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Escalate</span>
                </button>
                <button
                  onClick={onDispatch}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-98 rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-indigo-950"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dispatch Alert</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/50 mx-auto flex items-center justify-center text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Priority Queue Empty</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            All priority notifications have been dispatched. Ingest a new alert or seed sample data to run the C Max-Heap.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onSeed}
              className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Seed Sample Production Alerts
            </button>
            <button
              onClick={onOpenIngest}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Ingest New Alert
            </button>
          </div>
        </div>
      )}

      {/* Toolbar & Queue Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2">
        {/* Search & Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, service, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 p-0.5 rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
            <button
              onClick={() => setFilterUrgency('all')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filterUrgency === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            {[4, 3, 2, 1, 0].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterUrgency(lvl as UrgencyLevel)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  filterUrgency === lvl ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {URGENCY_LABELS[lvl as UrgencyLevel].tag}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={onAgeTick}
            disabled={loading || heap.length === 0}
            title="Recalculates priorities with time aging bonus to prevent starvation"
            className="px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-900/40 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Age Tick (+Starvation Prevention)</span>
          </button>

          <button
            onClick={() => onBatchDispatch(3)}
            disabled={loading || heap.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Dispatch Top 3</span>
          </button>

          <button
            onClick={onSeed}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 rounded-lg transition-colors"
            title="Reset queue with sample incident set"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main High-Density Priority Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">Queued Alerts (Sorted by C Binary Max-Heap)</h3>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {filteredHeap.length} of {heap.length} active
            </span>
          </div>
          <div className="text-xs font-mono text-slate-500">
            Comparisons: {stats.totalComparisons} · Swaps: {stats.totalSwaps}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-xs font-mono text-slate-400">
                <th className="py-2.5 px-4 font-normal">HEAP POS</th>
                <th className="py-2.5 px-4 font-normal text-right">PRIORITY SCORE</th>
                <th className="py-2.5 px-4 font-normal">URGENCY</th>
                <th className="py-2.5 px-4 font-normal">TITLE & SUMMARY</th>
                <th className="py-2.5 px-4 font-normal">SERVICE</th>
                <th className="py-2.5 px-4 font-normal">SLA REMAINING</th>
                <th className="py-2.5 px-4 font-normal">AGE</th>
                <th className="py-2.5 px-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {filteredHeap.length > 0 ? (
                filteredHeap.map((item, idx) => {
                  const isRoot = item.heapIndex === 0;
                  const sla = getSlaStatus(item);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isRoot ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Heap Index */}
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            isRoot
                              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          [{item.heapIndex}]
                        </span>
                      </td>

                      {/* Computed Priority */}
                      <td className="py-3 px-4 font-mono font-bold text-right text-indigo-300 tabular-nums">
                        {item.computedPriority.toFixed(2)}
                      </td>

                      {/* Urgency */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${URGENCY_LABELS[item.urgencyLevel].bg} ${URGENCY_LABELS[item.urgencyLevel].color} ${URGENCY_LABELS[item.urgencyLevel].border}`}
                        >
                          {URGENCY_LABELS[item.urgencyLevel].tag}
                        </span>
                      </td>

                      {/* Title & Message */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-semibold text-slate-100 truncate">{item.title}</div>
                        <div className="text-slate-400 text-[11px] truncate">{item.message}</div>
                        <div className="text-slate-500 font-mono text-[10px] mt-0.5">
                          ID: {item.id} · Tags: {item.tags}
                        </div>
                      </td>

                      {/* Service */}
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {item.service}
                      </td>

                      {/* SLA */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                        <span className={sla.color}>{sla.text}</span>
                      </td>

                      {/* Age & Starvation */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                        <div>{formatElapsed(item.createdAt)}</div>
                        {item.ageBoostCount > 0 && (
                          <div className="text-emerald-400 font-mono text-[10px]">
                            Aged +{item.ageBoostCount}x
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isRoot ? (
                            <button
                              onClick={onDispatch}
                              disabled={loading}
                              title="Dispatch top alert from heap"
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded text-xs transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Dispatch</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onEscalate(item.id, item.urgencyLevel, item.severityScore)}
                              disabled={loading}
                              title="Escalate urgency and sift up in heap"
                              className="p-1 text-amber-400 hover:text-amber-200 hover:bg-amber-950/40 rounded transition-colors"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(item.id)}
                            disabled={loading}
                            title="Dismiss alert (O(log n) delete via hash table)"
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No alerts match the active search or urgency filter.
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
