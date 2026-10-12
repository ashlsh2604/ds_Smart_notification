import { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  Cpu,
  Layers,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { AlertItem, EngineStats, URGENCY_LABELS } from '../types';

interface HeapVisualizerProps {
  heap: AlertItem[];
  stats: EngineStats;
  onEscalate: (id: string, currentUrgency: any, currentSeverity: number) => Promise<void>;
  onDispatch: () => Promise<void>;
}

export function HeapVisualizer({ heap, stats, onEscalate, onDispatch }: HeapVisualizerProps) {
  const [selectedNode, setSelectedNode] = useState<AlertItem | null>(null);

  // Calculate coordinates for binary tree nodes up to 4 levels (15 nodes max in visual tree)
  const visualNodes = heap.slice(0, 15);

  const getNodeCoords = (idx: number, totalWidth = 900, totalHeight = 360) => {
    const level = Math.floor(Math.log2(idx + 1));
    const itemsInLevel = Math.pow(2, level);
    const indexInLevel = idx - (itemsInLevel - 1);

    const levelHeight = totalHeight / 4.2;
    const y = 45 + level * levelHeight;

    const slotWidth = totalWidth / itemsInLevel;
    const x = slotWidth * indexInLevel + slotWidth / 2;

    return { x, y, level };
  };

  return (
    <div className="space-y-6">
      {/* Visualizer Overview & CS Theory Header */}
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
            <Cpu className="w-4 h-4" />
            <span>DATA STRUCTURE: BINARY MAX-HEAP (C99 POINTER ARRAY)</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">
            Complete Binary Tree & In-Memory Representation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Zero pointers overhead: parent-child links are calculated via arithmetic{' '}
            <code className="text-slate-200 font-mono bg-slate-800 px-1 py-0.5 rounded">2i + 1</code>,{' '}
            <code className="text-slate-200 font-mono bg-slate-800 px-1 py-0.5 rounded">2i + 2</code>, and{' '}
            <code className="text-slate-200 font-mono bg-slate-800 px-1 py-0.5 rounded">(i - 1) / 2</code>.
          </p>
        </div>

        {/* Invariant Health Card */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-3.5 py-2.5 rounded-lg shrink-0">
          {stats.invariantsValid ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div>
                <div>Heap Invariant Verified</div>
                <div className="text-[11px] font-mono text-slate-400 font-normal">
                  P(parent) &ge; P(child) across all nodes
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>
                <div>Heap Violation Detected</div>
                <div className="text-[11px] font-mono text-slate-400 font-normal">
                  Violated at node index: {stats.violatedIndex}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Binary Tree SVG Canvas */}
      <div className="border border-slate-800 bg-slate-950/90 rounded-xl p-4 overflow-x-auto relative shadow-inner">
        <div className="min-w-[850px] relative">
          <svg className="w-full h-[380px]" viewBox="0 0 900 380">
            {/* Draw Edges between parent and child */}
            {visualNodes.map((_, i) => {
              if (i === 0) return null;
              const parentIdx = Math.floor((i - 1) / 2);
              const parentPos = getNodeCoords(parentIdx);
              const childPos = getNodeCoords(i);

              return (
                <line
                  key={`edge-${i}`}
                  x1={parentPos.x}
                  y1={parentPos.y + 18}
                  x2={childPos.x}
                  y2={childPos.y - 18}
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray={i > 6 ? '4 4' : undefined}
                />
              );
            })}

            {/* Draw Nodes */}
            {visualNodes.map((item, idx) => {
              const { x, y } = getNodeCoords(idx);
              const isSelected = selectedNode?.id === item.id;
              const isRoot = idx === 0;

              return (
                <g
                  key={item.id}
                  transform={`translate(${x}, ${y})`}
                  onClick={() => setSelectedNode(item)}
                  className="cursor-pointer group"
                >
                  {/* Outer circle badge */}
                  <circle
                    r={isRoot ? 24 : 20}
                    className={`transition-all ${
                      isSelected
                        ? 'fill-indigo-600 stroke-white stroke-2'
                        : isRoot
                        ? 'fill-slate-900 stroke-indigo-400 stroke-2'
                        : 'fill-slate-900 stroke-slate-700 hover:stroke-slate-400 stroke-1'
                    }`}
                  />

                  {/* Priority Number */}
                  <text
                    textAnchor="middle"
                    dy="-2"
                    className="font-mono font-bold text-[11px] fill-white pointer-events-none select-none"
                  >
                    {Math.round(item.computedPriority)}
                  </text>

                  {/* Index tag */}
                  <text
                    textAnchor="middle"
                    dy="11"
                    className="font-mono text-[9px] fill-slate-400 pointer-events-none select-none"
                  >
                    [{idx}]
                  </text>

                  {/* Title Preview label below */}
                  <text
                    textAnchor="middle"
                    dy={isRoot ? '36' : '32'}
                    className="font-sans text-[10px] font-medium fill-slate-300 pointer-events-none select-none max-w-[100px]"
                  >
                    {item.title.length > 14 ? item.title.substring(0, 12) + '...' : item.title}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tree Legend */}
          <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1">
            <div className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Tree Legend</div>
            <div className="flex items-center gap-2 text-slate-300 text-[11px]">
              <span className="w-3 h-3 rounded-full bg-indigo-500 border border-white" />
              <span>Root (Top Priority Dispatch Target)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-600" />
              <span>Internal / Leaf Nodes</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono pt-1">
              Click any node to view C struct and escalate
            </div>
          </div>
        </div>
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNode && (
        <div className="border border-indigo-500/30 bg-slate-900/90 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-bold">
                C STRUCT INSPECTOR: Node [{selectedNode.heapIndex}]
              </span>
              <span className="text-slate-400 text-xs">ID: {selectedNode.id}</span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500">title:</span>{' '}
              <span className="text-slate-200">"{selectedNode.title}"</span>
            </div>
            <div>
              <span className="text-slate-500">urgency_level:</span>{' '}
              <span className={URGENCY_LABELS[selectedNode.urgencyLevel].color}>
                {selectedNode.urgencyLevel} ({URGENCY_LABELS[selectedNode.urgencyLevel].name})
              </span>
            </div>
            <div>
              <span className="text-slate-500">computed_priority:</span>{' '}
              <span className="text-indigo-400 font-bold tabular-nums">
                {selectedNode.computedPriority.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">severity_score:</span>{' '}
              <span className="text-slate-200">{selectedNode.severityScore}/100</span>
            </div>
            <div>
              <span className="text-slate-500">sla_seconds:</span>{' '}
              <span className="text-slate-200">{selectedNode.slaSeconds}s</span>
            </div>
            <div>
              <span className="text-slate-500">parent_index:</span>{' '}
              <span className="text-slate-200">
                {selectedNode.heapIndex === 0 ? 'NULL (root)' : Math.floor((selectedNode.heapIndex - 1) / 2)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={() => onEscalate(selectedNode.id, selectedNode.urgencyLevel, selectedNode.severityScore)}
              className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-800 hover:bg-amber-900/50 rounded-lg flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Escalate Urgency (Sift-Up)</span>
            </button>
            {selectedNode.heapIndex === 0 && (
              <button
                onClick={onDispatch}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dispatch Root Alert</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contiguous Array Memory View (Direct C Heap Layout) */}
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Contiguous Array in C Heap Memory</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            AlertNode* data = malloc(sizeof(AlertNode) * {stats.heapCapacity});
          </span>
        </div>

        <p className="text-xs text-slate-400">
          This strip reflects the contiguous physical memory buffer allocated by <code className="text-slate-200 font-mono">malloc()</code> in the C engine. Elements are organized sequentially without tree node pointers.
        </p>

        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-1 min-w-max">
            {heap.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => setSelectedNode(item)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between w-28 shrink-0 ${
                  idx === 0
                    ? 'bg-indigo-950/50 border-indigo-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className={idx === 0 ? 'text-indigo-400 font-bold' : 'text-slate-500'}>
                    [{idx}]
                  </span>
                  <span className={`px-1 rounded font-semibold ${URGENCY_LABELS[item.urgencyLevel].color}`}>
                    {URGENCY_LABELS[item.urgencyLevel].tag}
                  </span>
                </div>
                <div className="text-xs font-bold text-white font-mono my-1 tabular-nums">
                  P:{item.computedPriority.toFixed(0)}
                </div>
                <div className="text-[10px] text-slate-400 truncate" title={item.title}>
                  {item.title}
                </div>
              </div>
            ))}

            {/* Empty slots representation */}
            {Array.from({ length: Math.min(4, Math.max(0, stats.heapCapacity - heap.length)) }).map((_, i) => {
              const emptyIdx = heap.length + i;
              return (
                <div
                  key={`empty-${emptyIdx}`}
                  className="p-2.5 rounded-lg border border-dashed border-slate-800/80 bg-slate-950/20 text-slate-600 flex flex-col justify-between w-28 shrink-0"
                >
                  <span className="text-[10px] font-mono">[{emptyIdx}]</span>
                  <span className="text-xs font-mono text-center my-1 text-slate-700">EMPTY</span>
                  <span className="text-[10px] font-mono text-slate-700 text-center">Unused</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
