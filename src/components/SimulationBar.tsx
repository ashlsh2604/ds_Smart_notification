import { useState, useEffect, useRef } from 'react';
import { Play, Square, Zap, Sparkles, RefreshCw } from 'lucide-react';
import { UrgencyLevel } from '../types';

interface SimulationBarProps {
  onInjectAlert: (alert: {
    title: string;
    service: string;
    message: string;
    urgencyLevel: UrgencyLevel;
    severityScore: number;
    slaSeconds: number;
    tags: string;
  }) => Promise<void>;
  onBatchDispatch: (count: number) => Promise<void>;
  onAgeTick: () => Promise<void>;
}

const STREAM_SAMPLES = [
  {
    title: 'Redis Replica Cluster Failover',
    service: 'redis-cache-cluster',
    urgency: 4 as UrgencyLevel,
    severity: 94,
    sla: 120,
    tags: 'cache,failover,p0',
    message: 'Master sentinel elected new leader after 3 missed heartbeat probes on node-01.',
  },
  {
    title: 'HTTP 429 Rate Limit Breach on Payment API',
    service: 'payment-router',
    urgency: 3 as UrgencyLevel,
    severity: 85,
    sla: 240,
    tags: 'rate-limit,payments,p1',
    message: 'Third-party banking gateway returning HTTP 429 Too Many Requests on checkout flows.',
  },
  {
    title: 'Worker Pod OOMKilled in Production Cluster',
    service: 'pdf-renderer-pod',
    urgency: 2 as UrgencyLevel,
    severity: 60,
    sla: 600,
    tags: 'kubernetes,memory,p2',
    message: 'Container cgroup exceeded 2048Mi limit during batch report generation.',
  },
  {
    title: 'Database Disk Usage Crossed 80% Threshold',
    service: 'pg-storage',
    urgency: 2 as UrgencyLevel,
    severity: 52,
    sla: 900,
    tags: 'disk,storage,p2',
    message: 'WAL log directory volume utilization reached 82.4% on persistent storage volume.',
  },
  {
    title: 'DNS Resolution Latency Spiked in EU-West',
    service: 'core-dns',
    urgency: 1 as UrgencyLevel,
    severity: 35,
    sla: 1800,
    tags: 'network,dns,p3',
    message: 'Authoritative nameserver response latency elevated to 142ms from usual 18ms baseline.',
  },
  {
    title: 'Automated Nightly Backup Checksum Verified',
    service: 's3-backup-agent',
    urgency: 0 as UrgencyLevel,
    severity: 10,
    sla: 7200,
    tags: 'backup,routine,p4',
    message: 'SHA-256 integrity checksum for database dump db-snapshot-20261011 matches manifest.',
  },
];

export function SimulationBar({ onInjectAlert, onBatchDispatch, onAgeTick }: SimulationBarProps) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(3000); // 3 seconds
  const [injectedCount, setInjectedCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isSimulating) {
      timerRef.current = setInterval(() => {
        const sample = STREAM_SAMPLES[Math.floor(Math.random() * STREAM_SAMPLES.length)];
        const randomIdSuffix = Math.floor(Math.random() * 900 + 100);
        onInjectAlert({
          title: `${sample.title} (#${randomIdSuffix})`,
          service: sample.service,
          message: sample.message,
          urgencyLevel: sample.urgency,
          severityScore: sample.severity,
          slaSeconds: sample.sla,
          tags: sample.tags,
        });
        setInjectedCount((c) => c + 1);
      }, simSpeed);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSimulating, simSpeed, onInjectAlert]);

  const handleInjectBurst = async () => {
    for (let i = 0; i < 4; i++) {
      const sample = STREAM_SAMPLES[Math.floor(Math.random() * STREAM_SAMPLES.length)];
      const randomIdSuffix = Math.floor(Math.random() * 900 + 100);
      await onInjectAlert({
        title: `${sample.title} (Burst #${randomIdSuffix})`,
        service: sample.service,
        message: sample.message,
        urgencyLevel: sample.urgency,
        severityScore: sample.severity,
        slaSeconds: sample.sla,
        tags: sample.tags,
      });
    }
    setInjectedCount((c) => c + 4);
  };

  return (
    <div className="bg-slate-950/70 border-b border-slate-800/80 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-slate-200">Alert Traffic Generator:</span>
          <span className="text-slate-400 hidden sm:inline">
            Feed incoming telemetry to observe live C Heap rebalancing and sift operations
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-3 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors ${
              isSimulating
                ? 'bg-rose-950/50 text-rose-300 border border-rose-800'
                : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/40'
            }`}
          >
            {isSimulating ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>Stop Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Start Stream</span>
              </>
            )}
          </button>

          {isSimulating && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px] font-mono text-slate-300">
              <span>Rate:</span>
              <button
                onClick={() => setSimSpeed(1500)}
                className={`px-1.5 py-0.2 rounded ${simSpeed === 1500 ? 'bg-slate-800 text-white font-bold' : 'text-slate-500'}`}
              >
                1.5s
              </button>
              <button
                onClick={() => setSimSpeed(3000)}
                className={`px-1.5 py-0.2 rounded ${simSpeed === 3000 ? 'bg-slate-800 text-white font-bold' : 'text-slate-500'}`}
              >
                3s
              </button>
            </div>
          )}

          <button
            onClick={handleInjectBurst}
            className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Burst 4 Alerts</span>
          </button>

          {injectedCount > 0 && (
            <span className="font-mono text-[11px] text-slate-500">
              ({injectedCount} simulated)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
