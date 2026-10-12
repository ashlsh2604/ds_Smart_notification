export type UrgencyLevel = 0 | 1 | 2 | 3 | 4;

export interface AlertItem {
  id: string;
  title: string;
  service: string;
  message: string;
  urgencyLevel: UrgencyLevel;
  severityScore: number;
  slaSeconds: number;
  createdAt: number;
  dispatchedAt: number;
  computedPriority: number;
  ageBoostCount: number;
  tags: string;
  heapIndex: number;
}

export interface EngineStats {
  heapSize: number;
  heapCapacity: number;
  heapDepth: number;
  invariantsValid: boolean;
  violatedIndex: number;
  totalInserts: number;
  totalExtracts: number;
  totalComparisons: number;
  totalSwaps: number;
  hashEntries: number;
  dispatchedCount: number;
  totalDispatched: number;
  totalOverwritten: number;
  memoryFootprintBytes: number;
}

export interface EngineConfig {
  weightUrgency: number;
  weightSeverity: number;
  weightSla: number;
  agingRatePerMin: number;
  baseScores: [number, number, number, number, number];
}

export interface EngineStateData {
  stats: EngineStats;
  config: EngineConfig;
  heap: AlertItem[];
  dispatched: AlertItem[];
}

export interface EngineStatus {
  status: string;
  compiler: string;
  binaryPath: string;
  sourcePath: string;
  ping: {
    status: string;
    pong: boolean;
  };
}

export interface CSourceInfo {
  filename: string;
  path: string;
  linesCount: number;
  sizeBytes: number;
  source: string;
}

export const URGENCY_LABELS: Record<UrgencyLevel, { name: string; tag: string; color: string; bg: string; border: string }> = {
  4: { name: 'Critical (P0)', tag: 'P0', color: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-800/50' },
  3: { name: 'High (P1)', tag: 'P1', color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-800/50' },
  2: { name: 'Medium (P2)', tag: 'P2', color: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-800/50' },
  1: { name: 'Low (P3)', tag: 'P3', color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50' },
  0: { name: 'Informational (P4)', tag: 'P4', color: 'text-slate-400', bg: 'bg-slate-900/60', border: 'border-slate-800/60' },
};
