const Groq = require('groq-sdk');

// ── Provider Setup ──────────────────────────────────────────────────────────

let groqClient;
const groqKey = process.env.GROQ_API_KEY;

if (groqKey && groqKey !== 'your_groq_api_key_here' && groqKey.length > 10) {
  groqClient = new Groq({ apiKey: groqKey });
  console.log('✅ Groq AI provider initialized');
} else {
  console.warn('⚠️  GROQ_API_KEY is missing or invalid. AI features will use mock responses.');
  console.warn('   Get a free key at: https://console.groq.com');
}

// Optionally try Gemini as a fallback (only if Groq fails)
let geminiAI;
try {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const { GoogleGenAI } = require('@google/genai');
    geminiAI = new GoogleGenAI({ apiKey: geminiKey });
    console.log('✅ Gemini AI provider initialized (fallback)');
  }
} catch (e) {
  // Gemini SDK not installed or broken – that's fine, Groq is primary
}

// ── In-memory response cache (avoids duplicate API calls) ──────────────────
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(inputText, language) {
  return `${language}::${inputText.trim().toLowerCase()}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

// ── Story Theme Rotation ────────────────────────────────────────────────────
// Pick a RANDOM theme each time to avoid repetitive stories

const STORY_THEMES = [
  {
    name: "Detective Mystery",
    instruction: `Use a DETECTIVE/MYSTERY theme. The main character is a brilliant detective (like Sherlock or Byomkesh Bakshi) solving a case. Each algorithmic step is a clue. Data structures are evidence boards, suspect lists, or crime maps. Example: "Detective Arya pinned photographs on her evidence board — each photo was an element in the array. She needed to find the two suspects whose combined bounty equaled the target..."`,
  },
  {
    name: "Raja-Rani Kingdom",
    instruction: `Use a RAJA-RANI / KINGDOM theme. A wise king/queen rules a kingdom. Elements are subjects, soldiers, or treasures. Sorting = organizing the royal army. Searching = finding a lost jewel in the palace. Trees = family lineage. Example: "Rani Padmavati had a kingdom of N villages. Each village had a secret number. She needed to find two villages whose combined strength would defend against the target invasion force..."`,
  },
  {
    name: "Cricket Match",
    instruction: `Use a CRICKET/SPORTS theme. Think IPL auction, batting order, or match strategy. Elements are player scores or team rankings. Example: "Captain Virat was setting the batting lineup. He had N batsmen with different strike rates [2, 7, 11, 15]. The team needed exactly 'target' runs from a partnership of any two batsmen..."`,
  },
  {
    name: "Space Mission",
    instruction: `Use a SPACE EXPLORATION theme. An astronaut or space agency is on a mission. Arrays are star coordinates, trees are galaxy maps, linked lists are space station chains. Example: "Commander Priya's spacecraft had fuel pods stored in sequence. She needed to find the two pods whose combined fuel exactly matched the mission requirement..."`,
  },
  {
    name: "School Classroom",
    instruction: `Use a SCHOOL/COLLEGE theme. A teacher organizing students, a student solving exam problems, or a principal managing a school. Very relatable! Example: "Mrs. Sharma had a class of N students. Each had scored different marks. She needed to find two students whose combined marks equaled the scholarship threshold..."`,
  },
  {
    name: "Restaurant & Food",
    instruction: `Use a RESTAURANT/FOOD theme (but NOT always a chef named Rohan!). Maybe a food delivery app, a buffet organizer, a street food vendor, or a MasterChef competition. Example: "Zomato had N restaurants rated differently. A customer wanted exactly 'target' satisfaction — could any two restaurants together deliver that?"`,
  },
  {
    name: "Bollywood Film",
    instruction: `Use a BOLLYWOOD/MOVIE theme. A director casting actors, an editor arranging scenes, or a music composer arranging notes. Example: "Director Mehra had N scenes to arrange for maximum impact. Each scene had an intensity score. He needed to find the perfect pair of scenes whose combined drama equaled the blockbuster formula..."`,
  },
  {
    name: "Startup & Business",
    instruction: `Use a STARTUP/TECH COMPANY theme. A CEO building a team, a product manager prioritizing features, or a delivery logistics problem. Example: "Startup founder Aarav had N engineers. Each had a productivity score. He needed to form a pair whose combined output matched the project deadline target..."`,
  },
  {
    name: "Treasure Hunt",
    instruction: `Use a TREASURE HUNT / ADVENTURE theme. An explorer searching for hidden treasure, navigating maps, solving puzzles. Example: "Explorer Maya found an ancient map with N marked locations. Each location had a stone with a number carved on it. Legend said: find two stones whose numbers add to the sacred sum, and the treasure reveals itself..."`,
  },
  {
    name: "Hospital & Doctor",
    instruction: `Use a HOSPITAL/MEDICAL theme. A doctor diagnosing patients, organizing medical records, or managing an emergency room queue. Example: "Dr. Akhil had N patients in the waiting room, each with a priority score. He needed to find the optimal pair to operate on first..."`,
  },
];

function getRandomTheme() {
  return STORY_THEMES[Math.floor(Math.random() * STORY_THEMES.length)];
}

// ── Story-driven prompt builder ─────────────────────────────────────────────

function buildPrompt(inputText, language) {
  const theme = getRandomTheme();
  
  return `
You are "CodeFable" — an AI storyteller who teaches DSA & programming through immersive, creative, DIVERSE stories.

LANGUAGE INSTRUCTION — THIS IS MANDATORY:
${language === 'Hinglish' ? `You MUST write in HINGLISH — a casual mix of Hindi and English written in ROMAN SCRIPT (Latin letters, NOT Devanagari).
Hinglish means: Hindi sentence structure with English technical words mixed in, all written in Roman/Latin letters.
Example Hinglish sentences:
- "Socho ek detective hai jiska naam Arya hai. Uske paas ek evidence board hai jisme N clues hain."
- "Ab hum array ke har element ko ek ek karke check karenge. Pehle index 0 pe jaayenge, phir index 1 pe."
- "Yahan pe trick yeh hai ki hum ek HashMap use karenge — jaise ek notebook jisme hum likhe ki kya kya dekh chuke hain."
- "Time complexity O(n) hogi kyunki hum sirf ek baar array traverse kar rahe hain."
- "Toh basically, brute force mein hum har pair check karte — O(n²), but HashMap se O(n) mein ho jaata hai!"
IMPORTANT: Do NOT use Devanagari script (अ, ब, क). Write EVERYTHING in Roman letters. Mix Hindi and English naturally like Indians talk in daily life. Technical terms (array, HashMap, pointer, index, O(n), tree, node) should stay in English.` 
: language === 'Hindi' ? `You MUST write in HINDI using DEVANAGARI script (हिंदी में लिखें).
Example: "सोचो एक जासूस है जिसका नाम आर्या है। उसके पास एक सबूत बोर्ड है जिसमें N सुराग हैं।"
Technical terms like array, HashMap, O(n), tree, node can stay in English but all explanation text must be in Devanagari Hindi.`
: language === 'Marathi' ? `You MUST write in MARATHI using DEVANAGARI script (मराठी मध्ये लिहा).
Example: "विचार करा की एक गुप्तहेर आहे ज्याचं नाव आर्या आहे. तिच्याकडे एक पुरावा बोर्ड आहे ज्यामध्ये N सुगावे आहेत."
Technical terms like array, HashMap, O(n) can stay in English but all explanation must be in Marathi Devanagari.`
: `You MUST write in English. Use clear, engaging English.`}

The ENTIRE response — story, steps, approach, hints, complexity — ALL must follow the language instruction above.

🎭 TODAY'S STORY THEME: "${theme.name}"
${theme.instruction}

ABSOLUTELY CRITICAL RULES FOR STORY QUALITY:
1. DO NOT use "Chef Rohan" or any kitchen/cooking metaphor unless the theme specifically says so.
2. The story MUST be UNIQUE, VIVID, and EMOTIONALLY ENGAGING — like a mini Pixar/Bollywood movie.
3. Give your characters NAMES, PERSONALITY, and MOTIVATION. They should feel REAL.
4. The story should have TENSION, a CHALLENGE, and a RESOLUTION that maps to the algorithm.
5. Each "chapter/step" should continue the SAME story — not restart or become generic.
6. Make analogies that are SPECIFIC to the data structure and algorithm, not vague hand-waving.
7. The student should FEEL the algorithm through the story — why each step matters.

Student's Input:
"${inputText}"

CRITICAL — DATA STRUCTURE DETECTION:
Analyze the student's input and DETECT which data structure the problem uses:
- Array/Sorting/Searching/Two Sum/Subarray → type: "array"
- Binary Tree / BST / Tree Traversal / Level Order → type: "tree" (data = level-order array, use null for missing nodes)
- Linked List / Reverse List / Merge Lists → type: "linkedlist" (data = node values as array)
- Stack / Valid Parentheses / Next Greater → type: "stack"
- Queue / BFS / Sliding Window Queue → type: "queue"
- Matrix / 2D Grid / Island Count → type: "matrix" (data = flat array, rows*cols)
- Graph / DFS / BFS on adjacency list → type: "graph"
- Two Pointer / Sliding Window → type: "array" with pointers like {i, j} or {left, right} or {slow, fast}
- HashMap / Frequency Count / Anagram → type: "array" (show the array being processed)

CRITICAL — USE ACTUAL TEST CASE DATA:
★ If the input contains test cases (like nums = [2,7,11,15], target = 9), you MUST use EXACTLY that data.
★ If the input contains code with hardcoded values (like int arr[] = {5, 3, 8, 1}), use EXACTLY those values.
★ If the input mentions "root = [1,2,3,null,5]", use EXACTLY [1,2,3,null,5] in your tree visualization.
★ If the input mentions "head = [1,2,3,4,5]", use EXACTLY [1,2,3,4,5] in your linkedlist visualization.
★ ONLY create example data if NO test case is given or found in the code. If creating, keep it small (5-8 elements).
★ NEVER use random data when the student has provided specific values.

Core Rules:
1. You MUST NOT generate any code — not even pseudocode or partial code.
2. Every section must feel like a continuation of the story.
3. Steps should read like chapters of the story.
4. Hints should be clues wrapped in the story metaphor.
5. You MUST include both "visualization" AND "inputVisualization" fields.

Format your response EXACTLY as this JSON object:
{
  "storyTheme": "${theme.name}",
  "storyEmoji": "🔍 or 👑 or 🏏 or 🚀 etc — pick one that matches the theme",
  
  "story": "A rich, creative, SPECIFIC story (250-400 words) that explains the core logic through the ${theme.name} theme. Must have named characters, a setting, tension, and resolution. The story MUST directly relate to the actual problem being solved, not be a generic template.",
  
  "steps": [
    "Chapter 1: [Specific story-driven breakdown of step 1]",
    "Chapter 2: [Continues the SAME story, next algorithmic step]",
    "Chapter 3: [Building tension — the algorithm is working]",
    "Chapter 4: [Resolution — algorithm finds the answer]"
  ],
  
  "approach": "Algorithmic approach explained through the lens of the story characters and their journey.",
  
  "hints": [
    "A story-metaphor hint that makes the student THINK (not gives away the answer)",
    "Another creative hint wrapped in the theme",
    "A final hint that almost reveals the approach through the story"
  ],
  
  "complexity": "Time and space complexity with a story analogy (e.g., 'Dr. Akhil checking each patient once = O(n)')",

  "inputVisualization": {
    "type": "array or tree or linkedlist or stack or queue or matrix or graph",
    "title": "Input Data — [meaningful description]",
    "data": "<<EXACT test case data from the problem>>",
    "metadata": { "target": 9, "k": 3 },
    "description": "One line explaining what this input represents in the story"
  },

  "visualization": {
    "type": "array or tree or linkedlist or stack or queue or matrix or graph",
    "title": "Short title like 'Finding Two Sum' or 'Reversing the Linked List'",
    "steps": [
      { "data": [2, 7, 11, 15], "highlights": [], "label": "Initial state — the starting point", "pointers": {} },
      { "data": [2, 7, 11, 15], "highlights": [0], "label": "Step description with story context", "pointers": {"i": 0} },
      { "data": [2, 7, 11, 15], "highlights": [0, 1], "label": "Found it! Story-driven conclusion", "pointers": {"i": 0, "j": 1} }
    ]
  }
}

VISUALIZATION RULES:
- inputVisualization shows the RAW INPUT before any processing — student sees their test case drawn as the correct data structure
- visualization shows the ALGORITHM RUNNING step by step (5-10 key steps, not every micro-step)
- "type" MUST match the data structure the problem uses — if it's a linked list problem, type MUST be "linkedlist"
- "data" must be a flat array of numbers/strings that the frontend can render
  • For tree: level-order [1, 2, 3, null, null, 4, 5]
  • For linkedlist: node values [1, 2, 3, 4, 5]
  • For stack: elements [1, 2, 3] (top is last element)
  • For matrix: flat array [1,2,3,4,5,6,7,8,9]
  • For array: plain number array
- "highlights" = indices currently being processed (shown highlighted)
- "pointers" = named pointer positions like {i: 0, j: 3, left: 0, right: 4, slow: 1, fast: 3}
- Both inputVisualization and visualization MUST use the SAME type
- Use the EXACT data from the problem/test case — do NOT invent random values

IMPORTANT: The story MUST be specific to "${inputText}". Do NOT give a generic template.
Ensure the response is VALID JSON with no markdown fences.
`;
}

// ── Provider-specific generators ────────────────────────────────────────────

async function generateWithGroq(prompt, language) {
  const langRule = language === 'Hinglish'
    ? 'You MUST write ALL text (story, steps, hints, approach, complexity) in HINGLISH — Hindi+English mix in ROMAN SCRIPT (Latin letters). Example: "Socho ek detective hai jiska naam Arya hai. Array ke har element ko check karo." NEVER use Devanagari script.'
    : language === 'Hindi'
    ? 'You MUST write ALL text in HINDI using DEVANAGARI script. Technical terms can be in English.'
    : language === 'Marathi'
    ? 'You MUST write ALL text in MARATHI using DEVANAGARI script. Technical terms can be in English.'
    : 'Write all text in clear, engaging English.';

  const chatCompletion = await groqClient.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are CodeFable — a MASTER storyteller who teaches programming through immersive, creative, DIVERSE narratives. 

LANGUAGE (HIGHEST PRIORITY): ${langRule}

CRITICAL RULES:
- NEVER use "Chef Rohan" or kitchen metaphors unless the theme specifically asks for it.
- Each story must feel like a MINI MOVIE — with named characters, emotions, and a real journey.
- Use the theme provided in the user prompt — Detective, Raja-Rani, Cricket, Space, School, etc.
- The story must DIRECTLY map to the algorithm — not be a vague analogy.
- Always use the EXACT test case data from the student's input — NEVER invent random data when specific values are given.
- Always respond with valid JSON only, no markdown fences, no extra text.`,
      },
      { role: 'user', content: prompt },
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.85,
    max_tokens: 3500,
    response_format: { type: 'json_object' },
  });

  const text = chatCompletion.choices[0]?.message?.content;
  return JSON.parse(text);
}

async function generateWithGemini(prompt) {
  const response = await geminiAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });
  return JSON.parse(response.text);
}

// ── Helper: sleep ───────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Mock story response (when all AI providers fail) ────────────────────────
function buildMockStory(inputText, language) {
  const topic = inputText.substring(0, 80);
  
  // Rotate mock stories too!
  const mockStories = [
    {
      emoji: "🔍",
      theme: "Detective Mystery",
      story: `Detective Arya stood before her evidence board in the Mumbai Crime Branch. The case was unusual — "${topic}". She pinned each piece of evidence (each element) on the board, studying the connections between them. "Every problem has a pattern," she muttered, tapping her pen against the first clue. She began systematically examining each piece of evidence, comparing it with every other. But brute force wouldn't work — there were too many suspects. Then it hit her: "What if I create a LOOKUP TABLE?" She pulled out her notebook (a HashMap) and started recording what she'd already seen. For each new clue, she checked her notebook first. If the complementary evidence was already recorded — CASE SOLVED! The brilliance wasn't in checking everything, but in REMEMBERING what you've already seen.`,
      steps: [
        "Chapter 1: Detective Arya receives the case — she reads the problem statement carefully, identifies the input (the evidence), and understands what output (the culprit) she needs to find.",
        "Chapter 2: She first considers the brute force approach — comparing every pair of evidence. But with N items, that's O(n²) comparisons. Too slow for a detective of her caliber.",
        "Chapter 3: The breakthrough — she creates a lookup system (HashMap/Set). As she examines each piece of evidence, she records it. For each new item, she checks: 'Have I already seen its complement?'",
        "Chapter 4: Case closed! By remembering past evidence, she finds the answer in a single pass through the evidence board — O(n) time!",
      ],
    },
    {
      emoji: "👑",
      theme: "Raja-Rani Kingdom",
      story: `In the kingdom of Algorithmia, Rani Padmavati faced a grave challenge — "${topic}". Her kingdom had N villages, each with a unique strength number. An enemy demanded a specific total from any two villages, or war would begin. The Rani's advisor suggested checking every pair — but with hundreds of villages, it would take weeks! Then the wise minister Birbal spoke: "Your Majesty, let us create a REGISTER. As we visit each village, we record its strength. Before visiting a new village, we check the register — does its complement already exist?" The Rani followed this strategy. Village by village, the register grew. And suddenly — for one village, its complement was already in the register! The kingdom was saved, not by brute force, but by the wisdom of REMEMBERING.`,
      steps: [
        "Chapter 1: Rani Padmavati understands the threat — she identifies the input (village strengths) and the target (the enemy's demand).",
        "Chapter 2: The naive approach — the general suggests checking every pair of villages. But with N villages, that's N×(N-1)/2 checks. The Rani needs something faster.",
        "Chapter 3: Minister Birbal's insight — create a register (HashMap). Visit each village once, and for each, check if its complement (target - current) has been visited before.",
        "Chapter 4: Victory! The register reveals the answer in a single tour of the kingdom — O(n) time, O(n) space for the register.",
      ],
    },
    {
      emoji: "🏏",
      theme: "Cricket Match",
      story: `It was the IPL finals, and Captain Rohit had a challenge — "${topic}". The team had N players, each with a unique impact score. The winning formula required EXACTLY a target combined impact from any two players. Coach Dravid said, "Don't try every pair randomly. As you evaluate each player, write down their score on the strategy board. Before evaluating the next player, check: does the board already have someone whose score COMPLEMENTS this player's?" Rohit followed the plan. Player by player, the strategy board filled up. And then — Player #4's complement was ALREADY on the board! Rohit had found his winning pair, not through exhaustive trials, but through SYSTEMATIC MEMORY.`,
      steps: [
        "Chapter 1: Captain Rohit reads the match situation — understand the input (player scores) and the target (winning formula).",
        "Chapter 2: The naive strategy — try every pair of players. Works, but too slow when you have many players (O(n²)).",
        "Chapter 3: Coach Dravid's insight — use a strategy board (HashMap). For each player, check if (target - score) is already on the board. If yes, you've found your pair!",
        "Chapter 4: Match won! The strategy board approach finds the answer in a single pass — O(n) time!",
      ],
    },
  ];
  
  const mock = mockStories[Math.floor(Math.random() * mockStories.length)];
  
  return {
    storyTheme: mock.theme,
    storyEmoji: mock.emoji,
    story: mock.story,
    steps: mock.steps,
    approach: `Like ${mock.theme.toLowerCase()} — the key insight is to avoid brute force by using a smart lookup structure. Process elements one by one, and for each element, check if its complement has been seen before.`,
    hints: [
      `Think about it: if ${mock.theme === "Detective Mystery" ? "Detective Arya" : mock.theme === "Raja-Rani Kingdom" ? "Rani Padmavati" : "Captain Rohit"} could remember every clue she's already seen, how would that speed things up?`,
      'What data structure lets you check "have I seen this before?" in O(1) time?',
      'For each element, you need (target - element). Can you store what you\'ve seen in a HashMap and check in one step?',
    ],
    complexity: `${mock.theme === "Detective Mystery" ? "Detective Arya checks each piece of evidence once" : mock.theme === "Raja-Rani Kingdom" ? "The Rani visits each village once" : "Coach evaluates each player once"} → O(n) time. The notebook/register/board takes O(n) space.`,
    inputVisualization: {
      type: 'array',
      title: 'Input Data',
      data: [3, 7, 1, 9, 4, 6, 2, 8, 5],
      metadata: {},
      description: 'The initial data before any processing',
    },
    visualization: {
      type: 'array',
      title: 'Algorithm Walkthrough',
      steps: [
        { data: [3, 7, 1, 9, 4, 6, 2, 8, 5], highlights: [], label: 'Initial state — all elements unprocessed', pointers: {} },
        { data: [3, 7, 1, 9, 4, 6, 2, 8, 5], highlights: [0], label: 'Processing first element: 3', pointers: { i: 0 } },
        { data: [3, 7, 1, 9, 4, 6, 2, 8, 5], highlights: [0, 1], label: 'Processing element 7 — checking complement', pointers: { i: 1 } },
        { data: [3, 7, 1, 9, 4, 6, 2, 8, 5], highlights: [2, 3], label: 'Scanning through elements...', pointers: { i: 3 } },
        { data: [3, 7, 1, 9, 4, 6, 2, 8, 5], highlights: [4, 5], label: '✅ Found the answer!', pointers: { i: 5 } },
      ],
    },
  };
}

// ── Main export ─────────────────────────────────────────────────────────────

const generateExplanation = async (inputText, language) => {
  // 1. Check cache first
  const cacheKey = getCacheKey(inputText, language);
  const cached = getCached(cacheKey);
  if (cached) {
    console.log('AI cache hit – returning cached response');
    return cached;
  }

  const prompt = buildPrompt(inputText, language);

  // No providers configured → return mock
  if (!groqClient && !geminiAI) {
    console.warn('No AI provider available – returning mock story response');
    return buildMockStory(inputText, language);
  }

  // 2. Try Groq FIRST (primary provider – generous free tier)
  if (groqClient) {
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await generateWithGroq(prompt, language);
        setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.error(`Groq attempt ${attempt + 1} failed:`, error.status || error.message);

        if (error.status === 429 && attempt < MAX_RETRIES) {
          const delay = 3000 * (attempt + 1);
          console.log(`Groq rate-limited – retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // For non-retryable errors, break and try Gemini fallback
        if (attempt === MAX_RETRIES || error.status !== 429) break;
      }
    }
  }

  // 3. Fallback to Gemini (if available)
  if (geminiAI) {
    try {
      console.log('Groq failed – falling back to Gemini...');
      const result = await generateWithGemini(prompt);
      setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Gemini fallback error:', error.status || error.message);
    }
  }

  // 4. All providers failed — return mock instead of crashing
  console.warn('All AI providers failed – returning mock story');
  const mockResult = buildMockStory(inputText, language);
  setCache(cacheKey, mockResult);
  return mockResult;
};

module.exports = { generateExplanation };
