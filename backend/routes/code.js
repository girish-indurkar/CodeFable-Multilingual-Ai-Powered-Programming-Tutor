const express = require('express');
const authMiddleware = require('../middleware/auth');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

// ── Local execution config ─────────────────────────────────────────────────
const SUPPORTED_LOCAL = {
  javascript: { cmd: 'node', ext: 'js' },
  python:     { cmd: 'python', ext: 'py' },
  typescript: { cmd: 'node', ext: 'js', preprocess: true },
};

const LANGUAGE_LABELS = {
  javascript: 'JavaScript', python: 'Python', typescript: 'TypeScript',
  java: 'Java', cpp: 'C++', c: 'C', go: 'Go', rust: 'Rust',
  ruby: 'Ruby', php: 'PHP', csharp: 'C#', kotlin: 'Kotlin',
};

// ── Wandbox API config ─────────────────────────────────────────────────────
const WANDBOX_URL = 'https://wandbox.org/api/compile.json';

// Map our language IDs to Wandbox compiler names
const WANDBOX_COMPILERS = {
  java:   'openjdk-jdk-22+36',
  cpp:    'gcc-13.2.0',
  c:      'gcc-13.2.0-c',
  go:     'go-1.23.2',
  rust:   'rust-1.82.0',
  ruby:   'ruby-3.4.9',
  php:    'php-8.3.12',
  csharp: 'dotnetcore-8.0.402',
};

// Cache for Wandbox compiler list (to find valid compilers)
let wandboxCompilers = null;
let compilersFetchedAt = 0;

async function getWandboxCompilers() {
  if (wandboxCompilers && Date.now() - compilersFetchedAt < 60 * 60 * 1000) {
    return wandboxCompilers;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://wandbox.org/api/list.json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      wandboxCompilers = await res.json();
      compilersFetchedAt = Date.now();
      console.log(`Fetched ${wandboxCompilers.length} Wandbox compilers`);
      return wandboxCompilers;
    }
  } catch (err) {
    console.error('Failed to fetch Wandbox compilers:', err.message);
  }
  return null;
}

function findCompiler(compilers, langId) {
  const preferredName = WANDBOX_COMPILERS[langId];
  if (!preferredName) return null;

  // Try preferred compiler first
  if (compilers) {
    const preferred = compilers.find(c => c.name === preferredName);
    if (preferred) return preferred.name;

    // Fallback: find any compiler for this language
    const langMap = {
      java: 'Java', cpp: 'C++', c: 'C', go: 'Go',
      rust: 'Rust', ruby: 'Ruby', php: 'PHP',
      csharp: 'C#', kotlin: 'Kotlin',
    };
    const wbLang = langMap[langId];
    if (wbLang) {
      const match = compilers.find(c => c.language === wbLang);
      if (match) return match.name;
    }
  }

  // Use hardcoded default
  return preferredName;
}

// ── Run via Wandbox API ────────────────────────────────────────────────────
async function runWithWandbox(code, language, stdin) {
  const compilers = await getWandboxCompilers();
  const compiler = findCompiler(compilers, language);

  if (!compiler) {
    return {
      success: false, output: '',
      stderr: `"${LANGUAGE_LABELS[language] || language}" ke liye compiler nahi mila.`,
      exitCode: 1,
    };
  }

  console.log(`Running ${language} with Wandbox compiler: ${compiler}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(WANDBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        compiler: compiler,
        stdin: stdin || '',
        'compiler-option-raw': '',
        'runtime-option-raw': '',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        success: false, output: '',
        stderr: `Wandbox error (${response.status}): ${errText || 'Server error'}`,
        exitCode: 1,
      };
    }

    const result = await response.json();

    const hasCompileError = result.compiler_error && result.compiler_error.trim().length > 0 && result.status !== '0';
    const hasRuntimeError = result.program_error && result.program_error.trim().length > 0;
    const exitCode = parseInt(result.status || '0', 10);
    const success = exitCode === 0 && !hasCompileError;

    return {
      success,
      output: result.program_output || '',
      stderr: result.compiler_error || result.program_error || '',
      exitCode: exitCode,
    };
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out (30s). Code zyada time le raha hai.' : err.message;
    return {
      success: false, output: '',
      stderr: `Wandbox API se connect nahi ho paa raha: ${msg}`,
      exitCode: 1,
    };
  }
}

// ── Run Locally (JS, Python, TS) ───────────────────────────────────────────
function runLocally(code, language, stdin) {
  return new Promise((resolve) => {
    const config = SUPPORTED_LOCAL[language];
    if (!config) {
      return resolve({ success: false, output: '', stderr: `Local execution not available for ${language}.`, exitCode: 1 });
    }

    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `codefable_${Date.now()}.${config.ext}`);

    let finalCode = code;
    if (config.preprocess) {
      finalCode = code
        .replace(/:\s*(string|number|boolean|any|void|object|never|unknown|null|undefined)(\[\])?\s*/g, ' ')
        .replace(/\<[^>]+\>/g, '')
        .replace(/as\s+\w+/g, '')
        .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
        .replace(/type\s+\w+\s*=[^;]+;/g, '');
    }

    try {
      fs.writeFileSync(tmpFile, finalCode, 'utf8');
    } catch (err) {
      return resolve({ success: false, output: '', stderr: 'Temp file write failed: ' + err.message, exitCode: 1 });
    }

    const child = exec(`${config.cmd} "${tmpFile}"`, {
      timeout: 10000,
      maxBuffer: 1024 * 512,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    }, (error, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (error && error.killed) {
        return resolve({ success: false, output: '', stderr: 'Timeout: Code 10s se zyada time le raha hai', exitCode: 1 });
      }
      const hasError = !!error || (stderr && stderr.trim().length > 0 && !stdout);
      resolve({
        success: !hasError,
        output: stdout || '',
        stderr: stderr || (error ? error.message : ''),
        exitCode: error ? error.code || 1 : 0,
      });
    });

    if (stdin) { child.stdin.write(stdin); child.stdin.end(); }
  });
}

// ── Run Code Endpoint ──────────────────────────────────────────────────────
router.post('/run', authMiddleware, async (req, res) => {
  try {
    const { code, language, stdin } = req.body;
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    const lang = language.toLowerCase();

    // Local execution (JS, Python, TS) — fast, no network
    if (SUPPORTED_LOCAL[lang]) {
      console.log(`Running ${lang} locally...`);
      const result = await runLocally(code, lang, stdin);
      return res.json({ ...result, language: lang });
    }

    // Remote execution via Wandbox (Java, C++, C, Go, Rust, etc.)
    if (WANDBOX_COMPILERS[lang]) {
      console.log(`Running ${lang} via Wandbox...`);
      const result = await runWithWandbox(code, lang, stdin);
      return res.json({ ...result, language: lang });
    }

    return res.json({
      success: false, output: '',
      stderr: `"${LANGUAGE_LABELS[lang] || lang}" supported nahi hai. Supported: JavaScript, Python, TypeScript, Java, C++, C, Go, Rust, Ruby, PHP, C#, Kotlin.`,
      exitCode: 1, language: lang,
    });

  } catch (error) {
    console.error('Code run error:', error);
    res.status(500).json({ error: 'Code execute nahi ho paya. Please try again.' });
  }
});

// ── AI Code Analysis ───────────────────────────────────────────────────────
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { code, language, error: codeError, output } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const prompt = buildAnalysisPrompt(code, language, codeError, output);
    let analysis;
    try {
      analysis = await analyzeWithGroq(prompt);
    } catch {
      try { analysis = await analyzeWithGemini(prompt); } catch { analysis = buildMockAnalysis(code, language, codeError); }
    }
    res.json({ analysis });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: 'Analysis failed.' });
  }
});

function buildMockAnalysis(code, language, codeError) {
  const hasError = !!codeError;
  return {
    hasErrors: hasError,
    errorExplanation: hasError ? `Error: "${codeError.substring(0, 200)}". Line check karo.` : '',
    fix: hasError ? 'Syntax check karo — brackets, semicolons, variable names.' : '',
    codeQuality: `${language || 'Code'} readable hai. Comments add karo.`,
    suggestions: ['Meaningful variable names use karo.', 'Edge cases handle karo.', 'Comments add karo.'],
    complexity: 'AI unavailable — thodi der mein try karo.',
  };
}

function buildAnalysisPrompt(code, language, codeError, output) {
  let context = '';
  if (codeError) context = `\nERROR:\n"""\n${codeError}\n"""\n`;
  else if (output) context = `\nOutput:\n"""\n${output}\n"""\n`;
  return `You are CodeFable's AI tutor. Analyze this ${language || ''} code.\n\nCODE:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n${context}\nRespond as JSON:\n{"hasErrors":true/false,"errorExplanation":"","fix":"","codeQuality":"","suggestions":["","",""],"complexity":""}\nStyle: Hinglish, encouraging. Valid JSON only.`;
}

async function analyzeWithGroq(prompt) {
  const Groq = require('groq-sdk');
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await client.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are CodeFable — a warm code mentor. Valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    model: 'llama-3.3-70b-versatile', temperature: 0.5, max_tokens: 1500,
    response_format: { type: 'json_object' },
  });
  return JSON.parse(completion.choices[0]?.message?.content);
}

async function analyzeWithGemini(prompt) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash', contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  return JSON.parse(response.text);
}

module.exports = router;
