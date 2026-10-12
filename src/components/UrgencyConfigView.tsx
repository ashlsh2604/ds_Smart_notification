import { useState, useEffect } from 'react';
import { Sliders, Save, RotateCcw, Sparkles, Check, Calculator, ShieldAlert } from 'lucide-react';
import { EngineConfig, URGENCY_LABELS, UrgencyLevel } from '../types';

interface UrgencyConfigViewProps {
  config: EngineConfig;
  onSaveConfig: (updated: EngineConfig) => Promise<void>;
  loading: boolean;
}

export function UrgencyConfigView({ config, onSaveConfig, loading }: UrgencyConfigViewProps) {
  const [localConfig, setLocalConfig] = useState<EngineConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Playground simulation values
  const [simUrgency, setSimUrgency] = useState<number>(3); // High
  const [simSeverity, setSimSeverity] = useState<number>(80);
  const [simMinutes, setSimMinutes] = useState<number>(10);
  const [simSlaRatio, setSimSlaRatio] = useState<number>(0.8);

  useEffect(() => {
    setLocalConfig({ ...config });
  }, [config]);

  // Compute playground score based on current local formula
  const computeSampleScore = () => {
    const base = localConfig.baseScores[simUrgency] || 50;
    const urgencyPart = base * localConfig.weightUrgency;
    const severityPart = simSeverity * localConfig.weightSeverity;
    const agingBonus = simMinutes * localConfig.agingRatePerMin;
    let slaPressure = 0;
    if (simSlaRatio >= 1.0) {
      slaPressure = (500 + (simSlaRatio - 1.0) * 200) * localConfig.weightSla;
    } else if (simSlaRatio > 0.7) {
      slaPressure = (((simSlaRatio - 0.7) / 0.3) * 250) * localConfig.weightSla;
    }
    return {
      urgencyPart,
      severityPart,
      agingBonus,
      slaPressure,
      total: urgencyPart + severityPart + agingBonus + slaPressure,
    };
  };

  const sample = computeSampleScore();

  const handleApplyPreset = (type: 'balanced' | 'critical' | 'sla' | 'antistarvation') => {
    if (type === 'balanced') {
      setLocalConfig({
        weightUrgency: 10.0,
        weightSeverity: 1.5,
        weightSla: 2.0,
        agingRatePerMin: 5.0,
        baseScores: [5, 15, 40, 75, 100],
      });
    } else if (type === 'critical') {
      setLocalConfig({
        weightUrgency: 20.0,
        weightSeverity: 2.5,
        weightSla: 1.5,
        agingRatePerMin: 2.0,
        baseScores: [2, 10, 30, 80, 150],
      });
    } else if (type === 'sla') {
      setLocalConfig({
        weightUrgency: 8.0,
        weightSeverity: 1.0,
        weightSla: 5.0,
        agingRatePerMin: 6.0,
        baseScores: [5, 15, 35, 65, 90],
      });
    } else if (type === 'antistarvation') {
      setLocalConfig({
        weightUrgency: 6.0,
        weightSeverity: 1.0,
        weightSla: 1.5,
        agingRatePerMin: 15.0,
        baseScores: [10, 25, 45, 70, 95],
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveConfig(localConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
            <Sliders className="w-4 h-4" />
            <span>ALGORITHM CONFIGURATION · C99 SCORING ENGINE</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">
            User-Defined Urgency Levels & Priority Formula
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how base urgency tiers, severity metrics, SLA penalties, and starvation prevention weights are computed in the C backend.
          </p>
        </div>

        {/* Preset Profiles */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleApplyPreset('balanced')}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
          >
            Balanced
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('critical')}
            className="px-2.5 py-1 text-xs font-medium bg-rose-950/40 border border-rose-800/40 hover:bg-rose-900/50 text-rose-300 rounded-md transition-colors"
          >
            P0 Strict Triage
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('sla')}
            className="px-2.5 py-1 text-xs font-medium bg-amber-950/40 border border-amber-800/40 hover:bg-amber-900/50 text-amber-300 rounded-md transition-colors"
          >
            SLA Heavy
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('antistarvation')}
            className="px-2.5 py-1 text-xs font-medium bg-emerald-950/40 border border-emerald-800/40 hover:bg-emerald-900/50 text-emerald-300 rounded-md transition-colors"
          >
            Anti-Starvation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Sliders for Weights and Tiers */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6 border border-slate-800 bg-slate-900/60 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Priority Multipliers & Weights</span>
          </h3>

          <div className="space-y-4">
            {/* Weight Urgency */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Urgency Tier Weight (W_urgency)</span>
                <span className="font-mono text-indigo-400 font-bold tabular-nums">
                  {localConfig.weightUrgency.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={localConfig.weightUrgency}
                onChange={(e) => setLocalConfig({ ...localConfig, weightUrgency: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Multiplies the tier base score (Critical, High, Medium, Low, Info).
              </p>
            </div>

            {/* Weight Severity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Severity Score Weight (W_severity)</span>
                <span className="font-mono text-indigo-400 font-bold tabular-nums">
                  {localConfig.weightSeverity.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={localConfig.weightSeverity}
                onChange={(e) => setLocalConfig({ ...localConfig, weightSeverity: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Weight applied to raw incident severity scale (1-100).
              </p>
            </div>

            {/* Weight SLA */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">SLA Pressure Multiplier (W_sla)</span>
                <span className="font-mono text-indigo-400 font-bold tabular-nums">
                  {localConfig.weightSla.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={localConfig.weightSla}
                onChange={(e) => setLocalConfig({ ...localConfig, weightSla: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Escalates priority exponentially as alerts approach or exceed their SLA resolution deadline.
              </p>
            </div>

            {/* Aging Rate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Starvation Aging Rate (&alpha; pts/min)</span>
                <span className="font-mono text-emerald-400 font-bold tabular-nums">
                  +{localConfig.agingRatePerMin.toFixed(1)} pts/min
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={localConfig.agingRatePerMin}
                onChange={(e) => setLocalConfig({ ...localConfig, agingRatePerMin: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Gradual score increment added for every minute an alert stays in the queue to guarantee lower-priority alerts eventually get serviced.
              </p>
            </div>
          </div>

          {/* Tier Base Scores */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Tier Base Scores (Base[0..4])
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {([4, 3, 2, 1, 0] as UrgencyLevel[]).map((lvl) => (
                <div key={lvl} className="space-y-1">
                  <div className={`text-[10px] font-mono font-semibold text-center ${URGENCY_LABELS[lvl].color}`}>
                    {URGENCY_LABELS[lvl].tag}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={localConfig.baseScores[lvl]}
                    onChange={(e) => {
                      const updated = [...localConfig.baseScores] as [number, number, number, number, number];
                      updated[lvl] = Math.max(1, parseInt(e.target.value || '0', 10));
                      setLocalConfig({ ...localConfig, baseScores: updated });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-center text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Applied & Heap Rebuilt!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Apply Formula to C Engine</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right Panel: Live Interactive Simulator & Mathematical Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Real-time Playground */}
          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-400" />
                <span>Live Formula Simulator</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">Interactive Preview</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Urgency Level</span>
                  <span className={`font-mono font-semibold ${URGENCY_LABELS[simUrgency as UrgencyLevel].color}`}>
                    {URGENCY_LABELS[simUrgency as UrgencyLevel].name}
                  </span>
                </div>
                <div className="flex gap-1">
                  {([4, 3, 2, 1, 0] as UrgencyLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSimUrgency(lvl)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                        simUrgency === lvl ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {URGENCY_LABELS[lvl].tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Severity Score</span>
                  <span className="font-mono text-white font-bold">{simSeverity} / 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={simSeverity}
                  onChange={(e) => setSimSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Time Waiting in Queue</span>
                  <span className="font-mono text-emerald-400 font-bold">{simMinutes} minutes</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={simMinutes}
                  onChange={(e) => setSimMinutes(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>SLA Elapsed Ratio</span>
                  <span className="font-mono text-amber-400 font-bold">{(simSlaRatio * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={simSlaRatio}
                  onChange={(e) => setSimSlaRatio(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            {/* Computed Output Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Resulting Heap Priority</span>
                <span className="text-2xl font-mono font-bold text-indigo-400 tabular-nums">
                  {sample.total.toFixed(2)}
                </span>
              </div>

              <div className="space-y-1 text-[11px] font-mono text-slate-400 border-t border-slate-900 pt-2">
                <div className="flex justify-between">
                  <span>Urgency Component:</span>
                  <span className="text-slate-200">+{sample.urgencyPart.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Severity Component:</span>
                  <span className="text-slate-200">+{sample.severityPart.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Aging Bonus (&alpha; &times; {simMinutes}m):</span>
                  <span className="text-emerald-400">+{sample.agingBonus.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SLA Pressure Component:</span>
                  <span className="text-amber-400">+{sample.slaPressure.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Specification Note */}
          <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-4 text-xs space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>Starvation Prevention Guarantee</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              Traditional priority queues suffer from low-priority alert starvation during persistent high-severity streams. VigilPriority's C aging algorithm dynamically recalculates priority every tick using Floyd's linear-time heapify algorithm (<code className="text-slate-200 font-mono">O(n)</code>), continuously advancing aged alerts toward the root.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
