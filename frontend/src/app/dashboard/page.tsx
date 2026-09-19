"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Send, BookOpen, ListTree, Code, Lightbulb, Clock, Play, Terminal, Bot, X, Loader2, ChevronDown, BrainCircuit, CodeXml } from "lucide-react";
import Editor from "@monaco-editor/react";
import AlgoVisualizer from "@/components/AlgoVisualizer";
import CodeTracer from "@/components/CodeTracer";

interface VisualizationStep {
  data: (number | string)[];
  highlights: number[];
  label: string;
  pointers?: Record<string, number>;
}

interface VisualizationData {
  type: string;
  title: string;
  steps: VisualizationStep[];
}

interface InputVisualizationData {
  type: string;
  title: string;
  data: (number | string | null)[];
  metadata?: Record<string, unknown>;
  description?: string;
}

interface AIResponse {
  story: string;
  steps: string[];
  approach: string;
  hints: string[];
  complexity: string;
  visualization?: VisualizationData;
  inputVisualization?: InputVisualizationData;
  storyTheme?: string;
  storyEmoji?: string;
}

interface CodeAnalysis {
  hasErrors: boolean;
  errorExplanation: string;
  fix: string;
  codeQuality: string;
  suggestions: string[];
  complexity: string;
}

interface ConsoleEntry {
  type: "output" | "error" | "info" | "system";
  text: string;
  timestamp: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const LANGUAGES = [
  { id: "javascript", label: "JavaScript", icon: "JS" },
  { id: "python", label: "Python", icon: "PY" },
  { id: "java", label: "Java", icon: "JV" },
  { id: "cpp", label: "C++", icon: "C+" },
  { id: "c", label: "C", icon: "C" },
  { id: "typescript", label: "TypeScript", icon: "TS" },
  { id: "go", label: "Go", icon: "GO" },
  { id: "rust", label: "Rust", icon: "RS" },
  { id: "ruby", label: "Ruby", icon: "RB" },
  { id: "php", label: "PHP", icon: "PH" },
  { id: "csharp", label: "C#", icon: "C#" },
];

const STARTER_CODE: Record<string, string> = {
  javascript: '// JavaScript\nconsole.log("Hello, CodeFable!");\n',
  python: '# Python\nprint("Hello, CodeFable!")\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodeFable!");\n    }\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, CodeFable!" << endl;\n    return 0;\n}\n',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, CodeFable!\\n");\n    return 0;\n}\n',
  typescript: '// TypeScript\nconst msg: string = "Hello, CodeFable!";\nconsole.log(msg);\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, CodeFable!")\n}\n',
  rust: 'fn main() {\n    println!("Hello, CodeFable!");\n}\n',
  ruby: '# Ruby\nputs "Hello, CodeFable!"\n',
  php: '<?php\necho "Hello, CodeFable!\\n";\n',
  csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, CodeFable!");\n    }\n}\n',
};

function getTimestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Dashboard() {
  const [inputText, setInputText] = useState("");
  const [explainLang, setExplainLang] = useState("English");
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [codeLang, setCodeLang] = useState("javascript");
  const [userCode, setUserCode] = useState(STARTER_CODE.javascript);
  const [user, setUser] = useState<User | null>(null);
  const [running, setRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [codeAnalysis, setCodeAnalysis] = useState<CodeAnalysis | null>(null);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [revealedHints, setRevealedHints] = useState<number>(0);
  // Mobile tab state: "explain" or "code"
  const [mobileTab, setMobileTab] = useState<"explain" | "code">("explain");
  const consoleRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (!token) {
      router.push("/");
    } else if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch { router.push("/"); }
    }
  }, [router]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [consoleEntries]);

  const addConsole = (type: ConsoleEntry["type"], text: string) => {
    setConsoleEntries((prev) => [...prev, { type, text, timestamp: getTimestamp() }]);
  };

  const handleLanguageChange = (langId: string) => {
    setCodeLang(langId);
    setUserCode(STARTER_CODE[langId] || `// ${langId}\n`);
    setShowLangMenu(false);
    setConsoleEntries([]);
    setCodeAnalysis(null);
  };

  const handleRun = async () => {
    if (!userCode.trim() || running) return;
    setRunning(true);
    setCodeAnalysis(null);
    setShowAssistant(false);
    addConsole("system", `▶ Running ${LANGUAGES.find((l) => l.id === codeLang)?.label || codeLang}...`);

    try {
      const token = localStorage.getItem("token");
      if (!token) { addConsole("error", "Session expired. Please login again."); setRunning(false); return; }
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      let res;
      try {
        res = await fetch(`${baseUrl}/api/code/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code: userCode, language: codeLang }),
        });
      } catch {
        addConsole("error", "⚠ Backend server se connect nahi ho paa raha. Make sure backend is running on port 5000.");
        addConsole("info", "Run: cd backend && npm run dev");
        setRunning(false);
        return;
      }

      let data;
      try { data = await res.json(); } catch { data = { error: "Invalid response from server" }; }
      if (!res.ok) throw new Error(data.error || data.suggestion || "Execution failed");

      if (data.note) addConsole("info", data.note);
      if (data.success) {
        if (data.output) addConsole("output", data.output);
        else addConsole("info", "Program finished with no output.");
        addConsole("system", `✓ Exit code: ${data.exitCode ?? 0}`);
      } else {
        if (data.stderr) addConsole("error", data.stderr);
        if (data.output) addConsole("error", data.output);
        addConsole("system", `✗ Exit code: ${data.exitCode ?? 1}`);
      }
    } catch (err) {
      addConsole("error", err instanceof Error ? err.message : "Execution failed");
    } finally {
      setRunning(false);
    }
  };

  const handleAnalyze = async () => {
    if (!userCode.trim() || analyzing) return;
    setAnalyzing(true);
    setShowAssistant(true);

    const lastError = consoleEntries.filter((e) => e.type === "error").map((e) => e.text).join("\n");
    const lastOutput = consoleEntries.filter((e) => e.type === "output").map((e) => e.text).join("\n");

    try {
      const token = localStorage.getItem("token");
      if (!token) { addConsole("error", "Session expired. Please login again."); setAnalyzing(false); return; }
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      let res;
      try {
        res = await fetch(`${baseUrl}/api/code/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code: userCode, language: codeLang, error: lastError, output: lastOutput }),
        });
      } catch {
        addConsole("error", "⚠ Backend server se connect nahi ho paa raha.");
        setAnalyzing(false);
        return;
      }

      let data;
      try { data = await res.json(); } catch { data = { error: "Invalid response" }; }
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setCodeAnalysis(data.analysis);
    } catch (err) {
      addConsole("error", err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExplain = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setAiError(null);
    setRevealedHints(0);
    try {
      const token = localStorage.getItem("token");
      if (!token) { setAiError("Session expired. Please login again."); setLoading(false); return; }
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      let res;
      try {
        res = await fetch(`${baseUrl}/api/explain`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ inputText, language: explainLang }),
        });
      } catch {
        setAiError("Backend server se connect nahi ho paa raha. Make sure backend is running (cd backend && npm run dev).");
        setLoading(false);
        return;
      }

      let data;
      try { data = await res.json(); } catch { data = { error: "Invalid response from server" }; }
      if (!res.ok) throw new Error(data.error || "Failed to get explanation");
      setAiResponse(data.aiResponse);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Failed to get explanation.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const currentLang = LANGUAGES.find((l) => l.id === codeLang);

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-white">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
    </div>
  );

  /* ── Left Panel (Explain) ───────────────────────────────────────── */
  const leftPanel = (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d12]">
      {/* Input Area */}
      <div className="p-3 sm:p-4 border-b border-border bg-card shrink-0">
        <div className="flex flex-col sm:flex-row gap-3">
          <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Paste a DSA problem or code here..." className="flex-1 bg-[#0d0d12] border border-[#27272a] rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 resize-none text-sm sm:text-base" rows={3} />
          <div className="flex flex-row sm:flex-col gap-2 sm:gap-3 sm:w-48">
            <select value={explainLang} onChange={(e) => setExplainLang(e.target.value)} className="flex-1 sm:flex-none bg-[#0d0d12] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Hinglish">Hinglish</option>
              <option value="Marathi">Marathi</option>
            </select>
            <button onClick={handleExplain} disabled={loading || !inputText.trim()} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base">
              {loading ? <span className="animate-pulse">Thinking...</span> : <><Send className="w-4 h-4" /> Explain</>}
            </button>
          </div>
        </div>
      </div>

      {/* AI Response */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-zinc-700 min-h-0">
        {!aiResponse && !loading && !aiError && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <BookOpen className="w-12 h-12 sm:w-16 sm:h-16" /><p className="text-sm sm:text-base text-center">Submit a problem to start the story.</p>
          </div>
        )}
        {aiError && !loading && (
          <div className="h-full flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-red-400 text-3xl sm:text-4xl mb-3">⚠️</div>
              <h3 className="text-red-300 font-semibold text-base sm:text-lg mb-2">Connection Error</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">{aiError}</p>
              <button onClick={handleExplain} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg px-6 py-2 text-sm transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500 text-sm animate-pulse">Crafting your story...</p>
          </div>
        )}
        {aiResponse && !loading && (
          <div className="space-y-6 sm:space-y-8 pb-10 max-w-3xl mx-auto">
            <section className="bg-card rounded-2xl p-4 sm:p-6 border border-border shadow-lg animate-[fadeSlideIn_0.5s_ease-out]">
              <div className="flex items-center gap-3 mb-3 sm:mb-4 text-primary">
                <span className="text-xl sm:text-2xl">{aiResponse.storyEmoji || "📖"}</span>
                <h3 className="font-semibold text-base sm:text-lg">The Story</h3>
                {aiResponse.storyTheme && (
                  <span className="text-[10px] bg-primary/15 text-primary px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ml-auto">{aiResponse.storyTheme}</span>
                )}
              </div>
              <p className="text-zinc-300 leading-relaxed text-sm sm:text-base whitespace-pre-line">{aiResponse.story}</p>
            </section>
            <section className="animate-[fadeSlideIn_0.6s_ease-out]">
              <div className="flex items-center gap-3 mb-3 sm:mb-4 text-emerald-400"><Code className="w-5 h-5" /><h3 className="font-semibold text-base sm:text-lg">🧭 Approach</h3></div>
              <div className="bg-[#14141b]/50 rounded-xl p-3 sm:p-4 border border-emerald-900/30 text-zinc-300 leading-relaxed text-sm sm:text-base">{aiResponse.approach}</div>
            </section>
            {aiResponse.visualization && aiResponse.visualization.steps && aiResponse.visualization.steps.length > 0 && (
              <AlgoVisualizer visualization={aiResponse.visualization} inputVisualization={aiResponse.inputVisualization} />
            )}
            <section className="animate-[fadeSlideIn_0.7s_ease-out]">
              <div className="flex items-center gap-3 mb-3 sm:mb-4 text-blue-400"><ListTree className="w-5 h-5" /><h3 className="font-semibold text-base sm:text-lg">📚 Chapters</h3></div>
              <div className="space-y-2 sm:space-y-3">
                {aiResponse.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3 sm:gap-4 items-start bg-[#14141b]/50 rounded-xl p-3 sm:p-4 border border-blue-900/30" style={{animationDelay: `${idx * 0.15}s`}}>
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 text-xs sm:text-sm font-bold border border-blue-500/30">{idx + 1}</div>
                    <p className="text-zinc-300 text-xs sm:text-sm mt-0.5 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="animate-[fadeSlideIn_0.8s_ease-out]">
              <div className="flex items-center gap-3 mb-3 sm:mb-4 text-amber-400"><Lightbulb className="w-5 h-5" /><h3 className="font-semibold text-base sm:text-lg">🔮 Progressive Hints</h3></div>
              <div className="grid gap-2 sm:gap-3">
                {aiResponse.hints.map((hint, idx) => (
                  <div key={idx}>
                    {idx < revealedHints ? (
                      <div className="bg-gradient-to-r from-amber-500/10 to-transparent rounded-xl p-3 sm:p-4 border-l-2 border-amber-500/50 text-zinc-300 animate-[fadeSlideIn_0.3s_ease-out] text-sm">
                        <span className="font-bold text-amber-500/70 mr-2">Hint {idx + 1}:</span>{hint}
                      </div>
                    ) : idx === revealedHints ? (
                      <button onClick={() => setRevealedHints(revealedHints + 1)} className="w-full text-left bg-amber-500/5 hover:bg-amber-500/10 rounded-xl p-3 sm:p-4 border border-dashed border-amber-500/30 text-amber-400/70 transition-colors cursor-pointer text-sm">
                        🔒 Click to reveal Hint {idx + 1}...
                      </button>
                    ) : (
                      <div className="rounded-xl p-3 sm:p-4 border border-dashed border-zinc-700/30 text-zinc-600 text-sm">
                        🔒 Hint {idx + 1} (reveal previous hints first)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <section className="animate-[fadeSlideIn_0.9s_ease-out]">
              <div className="flex items-center gap-3 mb-3 sm:mb-4 text-purple-400"><Clock className="w-5 h-5" /><h3 className="font-semibold text-base sm:text-lg">⚡ Complexity</h3></div>
              <div className="inline-flex bg-purple-500/10 rounded-xl p-3 sm:p-4 border border-purple-500/20 text-zinc-200 text-xs sm:text-sm leading-relaxed">{aiResponse.complexity}</div>
            </section>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Right Panel (Code Editor) ──────────────────────────────────── */
  const rightPanel = (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
      {/* Editor Toolbar */}
      <div className="px-2 sm:px-3 py-2 border-b border-[#333] flex items-center justify-between bg-[#252526] gap-2 shrink-0">
        {/* Language Selector */}
        <div className="relative">
          <button onClick={() => setShowLangMenu(!showLangMenu)} className="flex items-center gap-1.5 sm:gap-2 bg-[#1e1e1e] border border-[#444] rounded-md px-2 sm:px-3 py-1.5 text-sm text-white hover:border-primary/60 transition-colors">
            <span className="text-[10px] font-bold bg-primary/20 text-primary rounded px-1.5 py-0.5">{currentLang?.icon}</span>
            <span className="hidden xs:inline">{currentLang?.label}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>
          {showLangMenu && (
            <>
              {/* Backdrop to close menu on tap */}
              <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
              <div className="absolute top-full left-0 mt-1 bg-[#1e1e1e] border border-[#444] rounded-lg shadow-2xl z-50 w-48 max-h-64 overflow-y-auto">
                {LANGUAGES.map((lang) => (
                  <button key={lang.id} onClick={() => handleLanguageChange(lang.id)} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#2a2a2a] transition-colors ${codeLang === lang.id ? "text-primary bg-primary/10" : "text-zinc-300"}`}>
                    <span className="text-[10px] font-bold bg-primary/20 text-primary rounded px-1.5 py-0.5 w-7 text-center">{lang.icon}</span>
                    {lang.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* AI Assistant Button */}
          <button onClick={handleAnalyze} disabled={analyzing || !userCode.trim()} className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm transition-colors disabled:opacity-40">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">AI Assist</span>
          </button>
          {/* Run Button */}
          <button onClick={handleRun} disabled={running || !userCode.trim()} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            Run
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor height="100%" language={codeLang} theme="vs-dark" value={userCode} onChange={(val) => setUserCode(val ?? "")} options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 12 }, scrollBeyondLastLine: false, wordWrap: "on" }} />
      </div>

      {/* Code Tracer - Data Structure Visualization (ALL languages) */}
      {userCode.trim() && (
        <div className="border-t border-[#333] bg-[#0d0d15] px-3 py-2 shrink-0">
          <CodeTracer code={userCode} language={codeLang} consoleOutput={consoleEntries.filter((e) => e.type === "output").map((e) => e.text).join("\n")} />
        </div>
      )}

      {/* Console Output */}
      <div className="h-[150px] sm:h-[200px] min-h-[120px] border-t border-[#333] flex flex-col bg-[#1a1a1a] shrink-0">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#333] shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Console</span>
            {consoleEntries.length > 0 && <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">{consoleEntries.length}</span>}
          </div>
          <button onClick={() => setConsoleEntries([])} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Clear</button>
        </div>
        <div ref={consoleRef} className="flex-1 overflow-y-scroll p-3 font-mono text-xs space-y-1">
          {consoleEntries.length === 0 && <p className="text-zinc-600 italic">Run your code to see output here...</p>}
          {consoleEntries.map((entry, i) => (
            <div key={i} className={`flex gap-2 ${entry.type === "error" ? "text-red-400" : entry.type === "system" ? "text-zinc-500" : entry.type === "info" ? "text-blue-400" : "text-emerald-300"}`}>
              <span className="text-zinc-600 shrink-0">[{entry.timestamp}]</span>
              <pre className="whitespace-pre-wrap break-all">{entry.text}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Navbar */}
      <header className="h-12 sm:h-14 border-b border-border bg-card flex items-center justify-between px-3 sm:px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-base sm:text-lg">C</div>
          <span className="text-lg sm:text-xl font-bold text-primary tracking-wide">CodeFable</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Welcome, {user.name}</span>
          <button onClick={handleLogout} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher — only visible below lg */}
      <div className="lg:hidden flex border-b border-border bg-card shrink-0">
        <button
          onClick={() => setMobileTab("explain")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === "explain"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          Explain
        </button>
        <button
          onClick={() => setMobileTab("code")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === "code"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <CodeXml className="w-4 h-4" />
          Code Editor
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">
        {/* Desktop: show both panels side by side */}
        {/* Mobile: show only the active tab */}

        {/* Left Panel */}
        <div className={`w-full lg:w-1/2 flex flex-col border-r border-border ${
          mobileTab === "explain" ? "flex" : "hidden"
        } lg:flex min-h-0`} style={{ minHeight: 0 }}>
          {leftPanel}
        </div>

        {/* Right Panel */}
        <div className={`w-full lg:w-1/2 flex flex-col ${
          mobileTab === "code" ? "flex" : "hidden"
        } lg:flex min-h-0`} style={{ minHeight: 0 }}>
          {rightPanel}
        </div>

        {/* AI Assistant Slide-up Panel */}
        {showAssistant && codeAnalysis && (
          <div className="absolute bottom-0 left-0 right-0 lg:left-1/2 max-h-[60vh] bg-[#14141b] border-t border-purple-500/30 lg:border-l lg:rounded-tl-2xl shadow-2xl z-50 flex flex-col animate-[fadeSlideIn_0.3s_ease-out]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-purple-900/20 lg:rounded-tl-2xl shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <span className="font-semibold text-purple-300 text-sm sm:text-base">AI Code Assistant</span>
                {codeAnalysis.hasErrors && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">Errors Found</span>}
                {!codeAnalysis.hasErrors && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">Looks Good!</span>}
              </div>
              <button onClick={() => setShowAssistant(false)} className="text-zinc-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {codeAnalysis.hasErrors && codeAnalysis.errorExplanation && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 sm:p-4">
                  <h4 className="text-red-400 font-semibold mb-2">❌ Error Explanation</h4>
                  <p className="text-zinc-300 text-xs sm:text-sm">{codeAnalysis.errorExplanation}</p>
                </div>
              )}
              {codeAnalysis.hasErrors && codeAnalysis.fix && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 sm:p-4">
                  <h4 className="text-amber-400 font-semibold mb-2">🔧 How to Fix</h4>
                  <p className="text-zinc-300 text-xs sm:text-sm">{codeAnalysis.fix}</p>
                </div>
              )}
              {codeAnalysis.codeQuality && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 sm:p-4">
                  <h4 className="text-blue-400 font-semibold mb-2">📊 Code Quality</h4>
                  <p className="text-zinc-300 text-xs sm:text-sm">{codeAnalysis.codeQuality}</p>
                </div>
              )}
              {codeAnalysis.suggestions?.length > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 sm:p-4">
                  <h4 className="text-purple-400 font-semibold mb-2">💡 Suggestions</h4>
                  <ul className="space-y-1.5">
                    {codeAnalysis.suggestions.map((s, i) => <li key={i} className="text-zinc-300 flex gap-2 text-xs sm:text-sm"><span className="text-purple-400">•</span>{s}</li>)}
                  </ul>
                </div>
              )}
              {codeAnalysis.complexity && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 sm:p-4">
                  <h4 className="text-emerald-400 font-semibold mb-2">⚡ Complexity</h4>
                  <p className="text-zinc-300 font-mono text-xs">{codeAnalysis.complexity}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}