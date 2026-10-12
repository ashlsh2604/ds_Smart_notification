import { Bell, Volume2, VolumeX, Plus } from 'lucide-react';

export type NavTab = 'queue' | 'heap' | 'config' | 'ring' | 'source';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenIngest: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  queuedCount: number;
  invariantsOk: boolean;
}

export function Header({
  currentTab,
  onSelectTab,
  onOpenIngest,
  soundEnabled,
  onToggleSound,
  queuedCount,
  invariantsOk,
}: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Bell className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            VigilPriority
          </span>
          <span className="hidden sm:inline-block text-xs font-mono text-slate-500 border border-slate-800 px-2 py-0.5 rounded">
            C99 Max-Heap
          </span>
        </div>

        {/* Zone 2: 4-5 single-line navigation tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium text-slate-400 overflow-x-auto">
          <button
            onClick={() => onSelectTab('queue')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentTab === 'queue'
                ? 'bg-slate-800 text-white font-semibold'
                : 'hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>Priority Queue</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-300">
              {queuedCount}
            </span>
          </button>

          <button
            onClick={() => onSelectTab('heap')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentTab === 'heap'
                ? 'bg-slate-800 text-white font-semibold'
                : 'hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>Heap Visualizer</span>
            {invariantsOk && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Heap invariants verified" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('config')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'config'
                ? 'bg-slate-800 text-white font-semibold'
                : 'hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Urgency Formula
          </button>

          <button
            onClick={() => onSelectTab('ring')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'ring'
                ? 'bg-slate-800 text-white font-semibold'
                : 'hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Dispatched Ring
          </button>

          <button
            onClick={() => onSelectTab('source')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'source'
                ? 'bg-slate-800 text-white font-semibold'
                : 'hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            C Source & Diagnostics
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action + audio toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Disable audio alerts' : 'Enable audio alerts'}
            className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenIngest}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ingest Alert</span>
          </button>
        </div>
      </div>
    </header>
  );
}
