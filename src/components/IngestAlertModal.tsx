import { useState } from 'react';
import { X, Plus, Sparkles, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';
import { UrgencyLevel, URGENCY_LABELS } from '../types';

interface IngestAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (alert: {
    title: string;
    service: string;
    message: string;
    urgencyLevel: UrgencyLevel;
    severityScore: number;
    slaSeconds: number;
    tags: string;
  }) => Promise<void>;
  loading: boolean;
}

const PRESET_TEMPLATES = [
  {
    title: 'PostgreSQL Replication Lag Exceeded 45s',
    service: 'db-replica-02',
    urgency: 4 as UrgencyLevel,
    severity: 96,
    sla: 120,
    tags: 'database,replication,p0',
    message: 'Write transactions stalling; replica wal receiver disconnected from primary instance.',
  },
  {
    title: 'Kubernetes Ingress 502 Bad Gateway Spike',
    service: 'ingress-nginx',
    urgency: 3 as UrgencyLevel,
    severity: 82,
    sla: 300,
    tags: 'ingress,network,p1',
    message: 'Upstream backend timeouts jumped to 14.8% of aggregate incoming HTTP requests.',
  },
  {
    title: 'Worker Threadpool Near Starvation',
    service: 'event-consumer',
    urgency: 2 as UrgencyLevel,
    severity: 58,
    sla: 600,
    tags: 'concurrency,threads,p2',
    message: 'Active worker queue length reached 8,200 jobs with 92% CPU saturation on node-04.',
  },
  {
    title: 'Daily Analytical Ledger Checkpoint Complete',
    service: 'data-pipeline',
    urgency: 0 as UrgencyLevel,
    severity: 12,
    sla: 3600,
    tags: 'scheduled,routine,p4',
    message: 'All daily ledger transactions successfully reconciled against clearing house records.',
  },
];

export function IngestAlertModal({ isOpen, onClose, onIngest, loading }: IngestAlertModalProps) {
  const [title, setTitle] = useState('');
  const [service, setService] = useState('auth-service');
  const [message, setMessage] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>(3);
  const [severityScore, setSeverityScore] = useState(75);
  const [slaSeconds, setSlaSeconds] = useState(300);
  const [tags, setTags] = useState('prod,infrastructure');

  if (!isOpen) return null;

  const handleApplyPreset = (tmpl: typeof PRESET_TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setService(tmpl.service);
    setMessage(tmpl.message);
    setUrgencyLevel(tmpl.urgency);
    setSeverityScore(tmpl.severity);
    setSlaSeconds(tmpl.sla);
    setTags(tmpl.tags);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onIngest({
      title: title.trim(),
      service: service.trim() || 'system',
      message: message.trim(),
      urgencyLevel,
      severityScore,
      slaSeconds,
      tags: tags.trim() || 'alert',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ingest New Alert</h3>
              <p className="text-[11px] text-slate-400">Inserts node into C Binary Max-Heap (O(log n) sift-up)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Preset Buttons */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1.5 uppercase">
              Quick Incident Templates
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => handleApplyPreset(tmpl)}
                  className="text-left p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                    <span className={URGENCY_LABELS[tmpl.urgency].color}>{URGENCY_LABELS[tmpl.urgency].tag}</span>
                    <span className="text-slate-500">{tmpl.service}</span>
                  </div>
                  <div className="text-xs text-slate-200 font-medium truncate">{tmpl.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Alert Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Credential Stuffing Attack"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Service & Tags Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Origin Service</label>
              <input
                type="text"
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="e.g. auth-gateway"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. security,p0,prod"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Urgency Level Selector */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-medium text-slate-300">Urgency Level</label>
              <span className={`font-mono font-semibold ${URGENCY_LABELS[urgencyLevel].color}`}>
                {URGENCY_LABELS[urgencyLevel].name}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[4, 3, 2, 1, 0].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setUrgencyLevel(lvl as UrgencyLevel)}
                  className={`py-2 rounded-lg text-xs font-mono font-semibold border transition-all ${
                    urgencyLevel === lvl
                      ? `${URGENCY_LABELS[lvl as UrgencyLevel].bg} ${URGENCY_LABELS[lvl as UrgencyLevel].color} ${URGENCY_LABELS[lvl as UrgencyLevel].border} ring-1 ring-white/20`
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {URGENCY_LABELS[lvl as UrgencyLevel].tag}
                </button>
              ))}
            </div>
          </div>

          {/* Severity & SLA Sliders */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Severity</span>
                <span className="font-mono text-white font-bold">{severityScore}/100</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={severityScore}
                onChange={(e) => setSeverityScore(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500"
              />
            </div>

            <div className="space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">SLA Allowance</span>
                <span className="font-mono text-indigo-400 font-bold">{slaSeconds}s ({Math.floor(slaSeconds / 60)}m)</span>
              </div>
              <input
                type="range"
                min="30"
                max="3600"
                step="30"
                value={slaSeconds}
                onChange={(e) => setSlaSeconds(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          {/* Message Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Incident Details & Payload</label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain the incident symptoms, telemetry triggers, or affected customers..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enqueue Alert into C Heap</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
