"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Database, Eye } from "lucide-react";

interface VisualizationStep {
  data: (number | string | null)[];
  highlights: number[];
  label: string;
  pointers?: Record<string, number>;
}

interface InputVisualizationData {
  type: string;
  title: string;
  data: (number | string | null)[];
  metadata?: Record<string, unknown>;
  description?: string;
}

interface VisualizationData {
  type: string;
  title: string;
  steps: VisualizationStep[];
}

// ── Pointer color palette ───────────────────────────────────────────────────
const POINTER_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function getPointerSetup(step: VisualizationStep) {
  const entries = Object.entries(step.pointers || {}) as [string, number][];
  const colors: Record<string, string> = {};
  entries.forEach(([key], i) => { colors[key] = POINTER_COLORS[i % POINTER_COLORS.length]; });
  return { entries, colors };
}

// ── Bar Visualization (Arrays, Sorting, etc.) ───────────────────────────────
function BarVis({ step }: { step: VisualizationStep }) {
  const { entries: pointerEntries, colors: pointerColors } = getPointerSetup(step);
  const maxVal = Math.max(...step.data.map((d) => (typeof d === "number" ? Math.abs(d) : String(d).length)), 1);

  return (
    <div className="p-6 min-h-[220px] flex flex-col items-center justify-end">
      {pointerEntries.length > 0 && (
        <div className="relative w-full mb-3" style={{ height: "28px" }}>
          {pointerEntries.map(([name, idx]) => {
            const barWidth = Math.max(100 / step.data.length, 5);
            const leftPercent = (idx / step.data.length) * 100 + barWidth / 2;
            return (
              <div key={name} className="absolute text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{ left: `${leftPercent}%`, transform: "translateX(-50%)", backgroundColor: pointerColors[name] + "25", color: pointerColors[name], border: `1.5px solid ${pointerColors[name]}60`, backdropFilter: "blur(4px)" }}>
                {name}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-end justify-center gap-[3px] w-full" style={{ height: "160px" }}>
        {step.data.map((value, idx) => {
          const numVal = typeof value === "number" ? Math.abs(value) : String(value).length;
          const heightPercent = Math.max((numVal / maxVal) * 100, 10);
          const isHighlighted = step.highlights.includes(idx);
          const pointersHere = pointerEntries.filter(([, pIdx]) => pIdx === idx);
          const barColor = isHighlighted
            ? "bg-gradient-to-t from-cyan-500 to-cyan-300"
            : pointersHere.length > 0
            ? ""
            : "bg-gradient-to-t from-zinc-700 to-zinc-500";
          return (
            <div key={idx} className="flex flex-col items-center group" style={{ flex: 1, maxWidth: "64px" }}>
              <div
                className={`w-full rounded-t-lg transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative ${barColor}`}
                style={{
                  height: `${heightPercent}%`, minHeight: "14px",
                  ...(pointersHere.length > 0 && !isHighlighted ? { background: `linear-gradient(to top, ${pointerColors[pointersHere[0][0]]}90, ${pointerColors[pointersHere[0][0]]}50)` } : {}),
                  ...(isHighlighted ? { boxShadow: "0 0 20px rgba(34, 211, 238, 0.5), 0 0 40px rgba(34, 211, 238, 0.2)" } : {}),
                }}
              />
              <div className={`w-full text-center py-1 border-x border-b rounded-b transition-all duration-500 ${isHighlighted ? "border-cyan-500/40 bg-cyan-500/10" : "border-zinc-700/30 bg-zinc-800/20"}`}>
                <span className={`text-[11px] font-mono font-bold transition-colors duration-500 ${isHighlighted ? "text-cyan-300" : "text-zinc-400"}`}>
                  {value === null ? "∅" : value}
                </span>
              </div>
              <span className="text-[9px] text-zinc-600 mt-0.5 font-mono">{idx}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Linked List / Queue Visualization ───────────────────────────────────────
function LinkedListVis({ step }: { step: VisualizationStep }) {
  const { entries: pointerEntries, colors: pointerColors } = getPointerSetup(step);

  return (
    <div className="p-6 min-h-[180px] flex flex-col items-center justify-center overflow-x-auto">
      <div className="flex items-center gap-0 pb-2">
        {step.data.map((value, idx) => {
          const isHighlighted = step.highlights.includes(idx);
          const pointersHere = pointerEntries.filter(([, pIdx]) => pIdx === idx);
          return (
            <div key={idx} className="flex items-center">
              <div className="flex flex-col items-center">
                {pointersHere.length > 0 && (
                  <div className="flex gap-1 mb-1.5 animate-bounce" style={{ animationDuration: "2s" }}>
                    {pointersHere.map(([name]) => (
                      <span key={name} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg"
                        style={{ backgroundColor: pointerColors[name] + "25", color: pointerColors[name], border: `1px solid ${pointerColors[name]}40` }}>
                        {name}↓
                      </span>
                    ))}
                  </div>
                )}
                <div className={`relative w-16 h-16 rounded-xl border-2 flex transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${
                  isHighlighted ? "border-cyan-400 shadow-lg shadow-cyan-500/30 scale-110" :
                  pointersHere.length > 0 ? "border-amber-400/60 shadow-md shadow-amber-500/10" : "border-zinc-600 bg-zinc-800/50"
                }`}>
                  <div className={`flex-1 flex items-center justify-center ${isHighlighted ? "bg-cyan-500/15" : pointersHere.length > 0 ? "bg-amber-500/5" : ""}`}>
                    <span className={`font-mono text-sm font-bold ${isHighlighted ? "text-cyan-300" : "text-zinc-300"}`}>
                      {value === null ? "∅" : value}
                    </span>
                  </div>
                  <div className={`w-5 border-l flex items-center justify-center ${isHighlighted ? "border-cyan-500/30 bg-cyan-500/5" : "border-zinc-700 bg-zinc-800/30"}`}>
                    <span className="text-zinc-500 text-[10px]">→</span>
                  </div>
                </div>
                <span className="text-[9px] text-zinc-600 mt-1 font-mono">idx:{idx}</span>
              </div>
              {idx < step.data.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className={`w-8 h-[2px] transition-all duration-500 ${isHighlighted && step.highlights.includes(idx + 1) ? "bg-gradient-to-r from-cyan-400 to-cyan-300" : "bg-zinc-600"}`} />
                  <div className={`w-0 h-0 border-y-[5px] border-y-transparent border-l-[7px] transition-colors duration-500 ${isHighlighted && step.highlights.includes(idx + 1) ? "border-l-cyan-300" : "border-l-zinc-600"}`} />
                </div>
              )}
            </div>
          );
        })}
        <div className="ml-2 flex items-center gap-1">
          <div className="w-6 h-[2px] bg-zinc-700" />
          <div className="text-zinc-600 text-xs font-mono bg-zinc-800/50 px-2 py-1 rounded border border-zinc-700/50">NULL</div>
        </div>
      </div>
    </div>
  );
}

// ── Stack Visualization ─────────────────────────────────────────────────────
function StackVis({ step }: { step: VisualizationStep }) {
  const { entries: pointerEntries, colors: pointerColors } = getPointerSetup(step);
  const reversed = [...step.data].reverse();

  return (
    <div className="p-6 min-h-[220px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-[2px]">
        <div className="text-[10px] text-cyan-400 font-bold mb-2 uppercase tracking-widest flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> TOP
        </div>
        {reversed.map((value, idx) => {
          const realIdx = step.data.length - 1 - idx;
          const isHighlighted = step.highlights.includes(realIdx);
          const pointersHere = pointerEntries.filter(([, pIdx]) => pIdx === realIdx);
          return (
            <div key={idx} className="flex items-center gap-3 transition-all duration-500" style={{ transform: isHighlighted ? "scale(1.05)" : "scale(1)" }}>
              <div className={`w-24 h-11 border-2 rounded-lg flex items-center justify-center transition-all duration-700 ${
                isHighlighted ? "border-cyan-400 bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 shadow-lg shadow-cyan-500/20" :
                pointersHere.length > 0 ? "border-amber-400/60 bg-amber-500/5" : "border-zinc-600 bg-zinc-800/30"
              }`}>
                <span className={`font-mono text-sm font-bold ${isHighlighted ? "text-cyan-300" : "text-zinc-300"}`}>{value === null ? "∅" : value}</span>
              </div>
              {pointersHere.length > 0 && (
                <span className="text-[9px] font-bold animate-pulse" style={{ color: pointerColors[pointersHere[0][0]] }}>
                  ← {pointersHere[0][0]}
                </span>
              )}
            </div>
          );
        })}
        <div className="w-28 h-[3px] bg-gradient-to-r from-transparent via-zinc-500 to-transparent rounded mt-2" />
        <div className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest">BOTTOM</div>
      </div>
    </div>
  );
}

// ── Matrix Visualization ────────────────────────────────────────────────────
function MatrixVis({ step }: { step: VisualizationStep }) {
  const n = Math.ceil(Math.sqrt(step.data.length));
  const rows: (number | string | null)[][] = [];
  for (let i = 0; i < step.data.length; i += n) {
    rows.push(step.data.slice(i, i + n));
  }

  return (
    <div className="p-6 min-h-[180px] flex items-center justify-center">
      <div className="inline-flex flex-col gap-[2px] p-2 rounded-xl border border-cyan-900/20 bg-cyan-500/[0.02]">
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="flex gap-[2px]">
            {row.map((val, cIdx) => {
              const flatIdx = rIdx * n + cIdx;
              const isHighlighted = step.highlights.includes(flatIdx);
              return (
                <div key={cIdx} className={`w-12 h-12 rounded-lg border flex items-center justify-center transition-all duration-700 ${
                  isHighlighted ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/20 scale-110" : "border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-700/30"
                }`}>
                  <span className={`font-mono text-xs font-bold ${isHighlighted ? "text-cyan-300" : "text-zinc-400"}`}>{val === null ? "∅" : val}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tree Visualization (binary tree from array) ─────────────────────────────
function TreeVis({ step }: { step: VisualizationStep }) {
  const data = step.data;
  if (data.length === 0) return null;

  const levels: { value: number | string | null; idx: number }[][] = [];
  let levelStart = 0;
  let levelSize = 1;
  while (levelStart < data.length) {
    const level = [];
    for (let i = levelStart; i < Math.min(levelStart + levelSize, data.length); i++) {
      level.push({ value: data[i], idx: i });
    }
    levels.push(level);
    levelStart += levelSize;
    levelSize *= 2;
  }

  return (
    <div className="p-6 min-h-[220px] flex flex-col items-center justify-center overflow-x-auto">
      {levels.map((level, lIdx) => (
        <div key={lIdx} className="flex items-center justify-center gap-2 mb-4" style={{ minWidth: `${Math.pow(2, levels.length - 1) * 52}px` }}>
          {level.map(({ value, idx }) => {
            const isHighlighted = step.highlights.includes(idx);
            const isNull = value === null || value === -1 || value === "null";
            return (
              <div key={idx} className="flex flex-col items-center" style={{ flex: 1 }}>
                {lIdx > 0 && (
                  <div className={`w-[1px] h-4 mb-1 ${isNull ? "bg-transparent" : isHighlighted ? "bg-cyan-400/50" : "bg-zinc-700"}`} />
                )}
                <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
                  isNull ? "border-zinc-800 bg-zinc-900/30 opacity-30" :
                  isHighlighted ? "border-cyan-400 bg-cyan-500/15 shadow-lg shadow-cyan-500/30 scale-110" : "border-zinc-600 bg-zinc-800/30"
                }`}>
                  <span className={`font-mono text-xs font-bold ${isNull ? "text-zinc-700" : isHighlighted ? "text-cyan-300" : "text-zinc-400"}`}>
                    {isNull ? "∅" : value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Input Visualization (shows raw test case data) ──────────────────────────
function InputVis({ input }: { input: InputVisualizationData }) {
  const visType = (input.type || "array").toLowerCase();
  const data = Array.isArray(input.data) ? input.data : [];
  const dummyStep: VisualizationStep = { data, highlights: [], label: "", pointers: {} };

  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.03] to-transparent overflow-hidden">
      <div className="px-4 py-3 border-b border-emerald-500/15 bg-emerald-500/[0.05] flex items-center gap-2">
        <Database className="w-4 h-4 text-emerald-400" />
        <span className="text-emerald-300 text-sm font-semibold">{input.title || "Input Data"}</span>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ml-auto">{visType}</span>
      </div>
      {input.description && (
        <div className="px-4 py-2 text-zinc-400 text-xs border-b border-emerald-900/15">{input.description}</div>
      )}
      {input.metadata && Object.keys(input.metadata).length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-emerald-900/15">
          {Object.entries(input.metadata).map(([key, val]) => (
            <span key={key} className="text-[11px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/20">
              {key}: <span className="font-bold font-mono">{String(val)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="max-h-[200px] overflow-auto">
        {(visType === "linkedlist" || visType === "queue") && <LinkedListVis step={dummyStep} />}
        {visType === "stack" && <StackVis step={dummyStep} />}
        {visType === "tree" && <TreeVis step={dummyStep} />}
        {visType === "matrix" && <MatrixVis step={dummyStep} />}
        {(visType === "array" || !["linkedlist", "queue", "stack", "tree", "matrix"].includes(visType)) && <BarVis step={dummyStep} />}
      </div>
    </div>
  );
}

// ── Main AlgoVisualizer Component ───────────────────────────────────────────
export default function AlgoVisualizer({ visualization, inputVisualization }: {
  visualization: VisualizationData;
  inputVisualization?: InputVisualizationData;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [showInput, setShowInput] = useState(true);

  const steps = visualization?.steps || [];
  const step = steps[currentStep] || { data: [], highlights: [], label: "", pointers: {} };

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) { setIsPlaying(false); return prev; }
      return prev + 1;
    });
  }, [steps.length]);

  const prevStep = () => { setCurrentStep((prev) => Math.max(0, prev - 1)); setIsPlaying(false); };
  const reset = () => { setCurrentStep(0); setIsPlaying(false); };
  const togglePlay = () => { if (currentStep >= steps.length - 1) setCurrentStep(0); setIsPlaying((p) => !p); };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(nextStep, speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, nextStep]);

  if (!visualization || !steps.length) return null;

  const visType = (visualization.type || "array").toLowerCase();
  const typeIcon = visType === "tree" ? "🌳" : visType === "linkedlist" ? "🔗" : visType === "stack" ? "📚"
    : visType === "queue" ? "🚶" : visType === "matrix" ? "⊞" : visType === "graph" ? "🕸️" : "📊";

  return (
    <section className="animate-[fadeSlideIn_0.7s_ease-out] space-y-4">
      {/* Input Visualization */}
      {inputVisualization && showInput && <InputVis input={inputVisualization} />}

      {/* Algorithm Visualization */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">{typeIcon}</span>
          <h3 className="font-semibold text-lg text-cyan-400">🎬 {visualization.title || "Algorithm Visualization"}</h3>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">{visType}</span>
          {inputVisualization && (
            <button onClick={() => setShowInput(!showInput)} className="ml-auto text-[10px] flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
              <Eye className="w-3 h-3" /> {showInput ? "Hide" : "Show"} Input
            </button>
          )}
        </div>

        <div className="bg-[#0d0d15] rounded-2xl border border-cyan-900/30 overflow-hidden shadow-2xl shadow-cyan-900/5">
          {/* Step label */}
          <div className="px-5 py-3 border-b border-cyan-900/20 bg-gradient-to-r from-cyan-500/[0.06] to-transparent">
            <p className="text-cyan-300 text-sm font-medium">{step.label}</p>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-zinc-500 text-xs">Step {currentStep + 1} of {steps.length}</p>
              {step.pointers && Object.keys(step.pointers).length > 0 && (
                <div className="flex gap-1.5">
                  {Object.entries(step.pointers).map(([name, val]) => {
                    const pColors = getPointerSetup(step).colors;
                    return (
                      <span key={name} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: pColors[name] + "15", color: pColors[name], border: `1px solid ${pColors[name]}30` }}>
                        {name}={val}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Visualization area */}
          {(visType === "linkedlist" || visType === "queue") && <LinkedListVis step={step} />}
          {visType === "stack" && <StackVis step={step} />}
          {visType === "tree" && <TreeVis step={step} />}
          {visType === "matrix" && <MatrixVis step={step} />}
          {(visType === "array" || visType === "pointers" || visType === "graph" || !["linkedlist", "queue", "stack", "tree", "matrix"].includes(visType)) && <BarVis step={step} />}

          {/* Controls */}
          <div className="px-4 py-3 border-t border-cyan-900/20 bg-cyan-500/[0.03] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={reset} className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-zinc-400 hover:text-cyan-300 transition-colors" title="Reset">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={prevStep} disabled={currentStep === 0} className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-zinc-400 hover:text-cyan-300 transition-colors disabled:opacity-30" title="Previous">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={togglePlay} className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500/25 to-cyan-400/15 text-cyan-300 hover:from-cyan-500/35 hover:to-cyan-400/25 transition-all border border-cyan-500/30 shadow-lg shadow-cyan-500/10" title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button onClick={nextStep} disabled={currentStep >= steps.length - 1} className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-zinc-400 hover:text-cyan-300 transition-colors disabled:opacity-30" title="Next">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Speed:</span>
              {[2000, 1000, 500, 250].map((s) => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                    speed === s ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  }`}>
                  {s === 2000 ? "0.5x" : s === 1000 ? "1x" : s === 500 ? "2x" : "4x"}
                </button>
              ))}
            </div>

            <div className="flex-1 max-w-[140px] h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-sm shadow-cyan-400/30"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
