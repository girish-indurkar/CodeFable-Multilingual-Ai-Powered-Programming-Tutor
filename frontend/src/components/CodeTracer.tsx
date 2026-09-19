"use client";

import { useState, useCallback } from "react";
import { Eye, Zap, SkipForward, SkipBack, RotateCcw, X } from "lucide-react";

interface Snapshot {
  label: string;
  args: SnapshotArg[];
}

interface SnapshotArg {
  value: unknown;
  type: "array" | "object" | "number" | "string" | "boolean" | "other";
}

interface CodeTracerProps {
  code: string;
  language: string;
  consoleOutput: string;
}

function classifyArg(val: unknown): SnapshotArg {
  if (Array.isArray(val)) return { value: val, type: "array" };
  if (val !== null && typeof val === "object") return { value: val, type: "object" };
  if (typeof val === "number") return { value: val, type: "number" };
  if (typeof val === "string") return { value: val, type: "string" };
  if (typeof val === "boolean") return { value: val, type: "boolean" };
  return { value: val, type: "other" };
}

/* ── JS browser execution ─────────────────────────────────────────── */
function executeJS(code: string): { snapshots: Snapshot[]; error: string | null } {
  const snapshots: Snapshot[] = [];
  const fakeConsole = {
    log: (...args: unknown[]) => {
      snapshots.push({ label: `console.log #${snapshots.length + 1}`, args: args.map(classifyArg) });
    },
    warn: (...args: unknown[]) => {
      snapshots.push({ label: `console.warn`, args: args.map(classifyArg) });
    },
    error: (...args: unknown[]) => {
      snapshots.push({ label: `console.error`, args: args.map(classifyArg) });
    },
  };
  try {
    const fn = new Function("console", code);
    fn(fakeConsole);
    return { snapshots, error: null };
  } catch (err) {
    return { snapshots, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ── Parse text output for data structures (ALL languages) ────────── */
function parseOutputForDataStructures(output: string): Snapshot[] {
  if (!output.trim()) return [];
  const snapshots: Snapshot[] = [];
  const lines = output.split("\n").filter((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const args: SnapshotArg[] = [];

    // Try to find array patterns in the line
    // Matches: [1, 2, 3] or [1,2,3] or {1, 2, 3} or (1, 2, 3)
    const arrayRegex = /[\[({][\s]*(-?\d+(?:\.\d+)?[\s]*(?:,[\s]*-?\d+(?:\.\d+)?[\s]*)*)[\])}]/g;
    let match;
    let foundStructure = false;

    while ((match = arrayRegex.exec(line)) !== null) {
      const nums = match[1].split(",").map((s) => {
        const n = parseFloat(s.trim());
        return isNaN(n) ? s.trim() : n;
      });
      if (nums.length > 0) {
        args.push({ value: nums, type: "array" });
        foundStructure = true;
      }
    }

    // Try space-separated arrays: "1 2 3 4 5" (common in competitive programming output)
    if (!foundStructure) {
      const spaceSep = line.split(/\s+/);
      if (spaceSep.length >= 3 && spaceSep.every((s) => /^-?\d+(\.\d+)?$/.test(s))) {
        const nums = spaceSep.map(Number);
        args.push({ value: nums, type: "array" });
        foundStructure = true;
      }
    }

    // Try JSON parse for objects/arrays
    if (!foundStructure) {
      try {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null)) {
          args.push(classifyArg(parsed));
          foundStructure = true;
        }
      } catch {
        // Not JSON
      }
    }

    // Try 2D array / matrix: "1 2 3\n4 5 6\n7 8 9"
    // Check if next lines also look like number rows
    if (!foundStructure) {
      const rowNums = line.split(/[\s,]+/).filter(Boolean);
      if (rowNums.length >= 2 && rowNums.every((s) => /^-?\d+(\.\d+)?$/.test(s))) {
        // Check if subsequent lines are also number rows of same length
        const matrixRows: number[][] = [rowNums.map(Number)];
        let j = i + 1;
        while (j < lines.length) {
          const nextRow = lines[j].trim().split(/[\s,]+/).filter(Boolean);
          if (nextRow.length === rowNums.length && nextRow.every((s) => /^-?\d+(\.\d+)?$/.test(s))) {
            matrixRows.push(nextRow.map(Number));
            j++;
          } else {
            break;
          }
        }
        if (matrixRows.length > 1) {
          // It's a matrix!
          args.push({ value: matrixRows, type: "array" });
          foundStructure = true;
          i = j - 1; // Skip the rows we consumed
        } else {
          // Single row of numbers
          args.push({ value: matrixRows[0], type: "array" });
          foundStructure = true;
        }
      }
    }

    // Key-value pattern: "key: value" or "key = value"
    if (!foundStructure) {
      const kvMatch = line.match(/^(\w+)\s*[:=]\s*(.+)$/);
      if (kvMatch) {
        const val = kvMatch[2].trim();
        const numVal = parseFloat(val);
        args.push({
          value: { [kvMatch[1]]: isNaN(numVal) ? val : numVal },
          type: "object",
        });
        foundStructure = true;
      }
    }

    // If nothing special detected, show as plain text
    if (!foundStructure) {
      args.push({ value: line, type: "string" });
    }

    snapshots.push({ label: `Output line ${i + 1}`, args });
  }

  return snapshots;
}

/* ── Visual renderers ─────────────────────────────────────────────── */

function ArrayVis({ arr }: { arr: unknown[] }) {
  // Check if it's a 2D array (matrix)
  if (arr.length > 0 && Array.isArray(arr[0])) {
    return (
      <div className="my-2">
        <div className="text-[10px] text-violet-400/80 font-semibold mb-1.5 uppercase tracking-wider">Matrix</div>
        <div className="flex flex-col gap-[2px]">
          {arr.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-[2px]">
              {(row as unknown[]).map((cell, cIdx) => (
                <div key={cIdx} className="w-10 h-10 border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center rounded-sm">
                  <span className="text-xs font-mono text-cyan-200 font-semibold">{String(cell)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isAllNumbers = arr.every((v) => typeof v === "number");
  const maxVal = isAllNumbers ? Math.max(...(arr as number[]), 1) : 0;

  return (
    <div className="my-2">
      <div className="flex items-end gap-[2px] flex-wrap">
        {arr.map((val, idx) => {
          const barH = isAllNumbers ? Math.max(((val as number) / maxVal) * 60, 14) : 0;
          return (
            <div key={idx} className="flex flex-col items-center">
              {isAllNumbers && (
                <div
                  className="w-10 rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-500 flex items-end justify-center pb-0.5"
                  style={{ height: `${barH}px` }}
                >
                  <span className="text-[10px] font-bold text-white drop-shadow">{String(val)}</span>
                </div>
              )}
              <div className="w-10 h-10 border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center rounded-sm">
                <span className="text-xs font-mono text-cyan-200 font-semibold truncate px-0.5">
                  {typeof val === "string" ? `"${val}"` : String(val)}
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

function ObjectVis({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj);
  return (
    <div className="my-2 inline-flex flex-col bg-violet-500/5 border border-violet-500/20 rounded-lg overflow-hidden">
      {entries.map(([key, val]) => (
        <div key={key} className="flex border-b border-violet-500/10 last:border-b-0">
          <span className="px-2.5 py-1.5 text-xs font-mono text-violet-300 font-semibold bg-violet-500/10 border-r border-violet-500/10 min-w-[60px]">
            {key}
          </span>
          <span className="px-2.5 py-1.5 text-xs font-mono text-amber-300">
            {typeof val === "string" ? `"${val}"` : JSON.stringify(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SnapshotView({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="space-y-2">
      {snapshot.args.map((arg, i) => {
        if (arg.type === "array") return <ArrayVis key={i} arr={arg.value as unknown[]} />;
        if (arg.type === "object" && arg.value) return <ObjectVis key={i} obj={arg.value as Record<string, unknown>} />;
        return (
          <span key={i} className={`inline-block text-sm font-mono px-2 py-0.5 rounded mr-1 ${
            arg.type === "number" ? "text-amber-300 bg-amber-500/10" :
            arg.type === "string" ? "text-emerald-300 bg-emerald-500/10" :
            arg.type === "boolean" ? "text-blue-300 bg-blue-500/10" :
            "text-zinc-300 bg-zinc-500/10"
          }`}>
            {typeof arg.value === "string" ? arg.value : String(arg.value)}
          </span>
        );
      })}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default function CodeTracer({ code, language, consoleOutput }: CodeTracerProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [execError, setExecError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const isJS = language === "javascript" || language === "typescript";

  const runTrace = useCallback(() => {
    if (isJS) {
      // Execute JS in browser for rich visualization
      const { snapshots: snaps, error } = executeJS(code);
      if (snaps.length > 0) {
        setSnapshots(snaps);
        setExecError(error);
      } else {
        // Fallback to parsing console output
        const parsed = parseOutputForDataStructures(consoleOutput);
        setSnapshots(parsed);
        setExecError(error || (parsed.length === 0 ? "No data structures found. Use console.log() to visualize arrays/objects." : null));
      }
    } else {
      // For all other languages: parse the console output
      if (!consoleOutput.trim()) {
        setSnapshots([]);
        setExecError("Pehle code Run karo, phir Visualize karo. Output mein arrays/numbers hone chahiye.");
        setIsOpen(true);
        setCurrentStep(0);
        return;
      }
      const parsed = parseOutputForDataStructures(consoleOutput);
      setSnapshots(parsed);
      setExecError(parsed.length === 0 ? "Output mein koi data structure detect nahi hua. Arrays ya numbers print karo visualize karne ke liye." : null);
    }
    setCurrentStep(0);
    setIsOpen(true);
  }, [code, isJS, consoleOutput]);

  // Button only (collapsed state)
  if (!isOpen) {
    return (
      <button onClick={runTrace}
        className="flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-violet-500/30 text-violet-300 hover:from-violet-600/30 hover:to-cyan-600/30 rounded-lg px-4 py-2 text-sm transition-all duration-300 hover:scale-[1.02]">
        <Eye className="w-4 h-4" />
        <span>Visualize Data Structures</span>
        <Zap className="w-3 h-3 text-cyan-400" />
      </button>
    );
  }

  const snapshot = snapshots[currentStep];
  const hasSteps = snapshots.length > 1;

  return (
    <div className="bg-[#0a0a14] rounded-xl border border-violet-500/20 overflow-hidden shadow-2xl shadow-violet-900/10">
      {/* Header */}
      <div className="px-3 py-2 bg-gradient-to-r from-violet-900/30 to-cyan-900/30 border-b border-violet-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">Data Structure View</span>
          {snapshots.length > 0 && (
            <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">
              {currentStep + 1}/{snapshots.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={runTrace} className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/20 transition-colors">Refresh</button>
          <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white p-1"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[260px] overflow-y-auto">
        {snapshots.length === 0 && !execError && (
          <p className="text-zinc-500 text-sm italic text-center py-4">No data structures found in output.</p>
        )}

        {execError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
            <p className="text-red-400 text-xs">{execError}</p>
          </div>
        )}

        {snapshot && (
          <div>
            <div className="text-[11px] text-zinc-500 mb-2 font-mono">{snapshot.label}</div>
            <SnapshotView snapshot={snapshot} />
          </div>
        )}
      </div>

      {/* Controls */}
      {hasSteps && (
        <div className="px-3 py-2 border-t border-violet-900/20 bg-[#0c0c18] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentStep(0)} className="p-1 rounded hover:bg-violet-500/10 text-zinc-400 hover:text-violet-300 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setCurrentStep((p) => Math.max(0, p - 1))} disabled={currentStep === 0} className="p-1 rounded hover:bg-violet-500/10 text-zinc-400 hover:text-violet-300 disabled:opacity-30">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setCurrentStep((p) => Math.min(snapshots.length - 1, p + 1))} disabled={currentStep >= snapshots.length - 1} className="p-1 rounded hover:bg-violet-500/10 text-zinc-400 hover:text-violet-300 disabled:opacity-30">
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 max-w-[120px] h-1.5 bg-zinc-800 rounded-full overflow-hidden ml-3">
            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / snapshots.length) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
