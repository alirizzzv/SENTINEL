/* SENTINEL detection engine — generated from src/engine. Do not edit. */
var SENTINEL = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/engine/index.js
  var index_exports = {};
  __export(index_exports, {
    CATEGORIES: () => CATEGORIES,
    DetectionEngine: () => DetectionEngine,
    RISK: () => RISK,
    engine: () => engine,
    riskLevel: () => riskLevel,
    scan: () => scan
  });

  // src/engine/aho-corasick.js
  var ACNode = class {
    constructor(depth = 0) {
      this.children = /* @__PURE__ */ new Map();
      this.fail = null;
      this.depth = depth;
      this.outputs = [];
      this.ownOutputs = [];
    }
  };
  var AhoCorasick = class {
    /**
     * @param {Array<string | {pattern: string, [key: string]: any}>} patterns
     */
    constructor(patterns = []) {
      this.root = new ACNode(0);
      this.patterns = [];
      this._built = false;
      for (const p of patterns) this.add(p);
      this.build();
    }
    /** Register a pattern. Accepts a raw string or an object carrying metadata. */
    add(p) {
      const pattern = typeof p === "string" ? p : p.pattern;
      if (typeof pattern !== "string" || pattern.length === 0) {
        throw new Error("AhoCorasick pattern must be a non-empty string");
      }
      const meta = typeof p === "string" ? null : p;
      const id = this.patterns.length;
      this.patterns.push({ pattern, length: pattern.length, meta });
      let node = this.root;
      for (const ch of pattern) {
        let next = node.children.get(ch);
        if (!next) {
          next = new ACNode(node.depth + 1);
          node.children.set(ch, next);
        }
        node = next;
      }
      node.ownOutputs.push(id);
      this._built = false;
      return this;
    }
    /**
     * Build failure and output links via BFS. Idempotent — safe to call again
     * after adding more patterns.
     */
    build() {
      const queue = [];
      for (const child of this.root.children.values()) {
        child.fail = this.root;
        queue.push(child);
      }
      let head = 0;
      while (head < queue.length) {
        const node = queue[head++];
        for (const [ch, child] of node.children) {
          let f = node.fail;
          while (f !== null && !f.children.has(ch)) {
            f = f.fail;
          }
          child.fail = f === null ? this.root : f.children.get(ch) || this.root;
          if (child.fail === child) child.fail = this.root;
          queue.push(child);
        }
        node.outputs = node.fail.outputs.length ? node.ownOutputs.concat(node.fail.outputs) : node.ownOutputs;
      }
      this.root.outputs = this.root.ownOutputs;
      this._built = true;
      return this;
    }
    /**
     * Scan `text`, returning every match (including overlapping ones).
     * @param {string} text
     * @returns {{start: number, end: number, pattern: string, length: number, meta: any, patternId: number}[]}
     *          `end` is exclusive. Matches are emitted in scan (end-position) order.
     */
    search(text) {
      if (!this._built) this.build();
      const results = [];
      let node = this.root;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        while (node !== this.root && !node.children.has(ch)) {
          node = node.fail;
        }
        node = node.children.get(ch) || this.root;
        if (node.outputs.length) {
          for (const id of node.outputs) {
            const { pattern, length, meta } = this.patterns[id];
            results.push({
              start: i - length + 1,
              end: i + 1,
              pattern,
              length,
              meta,
              patternId: id
            });
          }
        }
      }
      return results;
    }
    /** Convenience: does the text contain at least one pattern? Short-circuits. */
    test(text) {
      if (!this._built) this.build();
      let node = this.root;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        while (node !== this.root && !node.children.has(ch)) node = node.fail;
        node = node.children.get(ch) || this.root;
        if (node.outputs.length) return true;
      }
      return false;
    }
  };

  // src/engine/pattern-dictionary.js
  var CATEGORIES = {
    PROMPT_INJECTION: { label: "Prompt Injection", color: "#c84fff" },
    CLOUD_API_KEY: { label: "Cloud / API Key", color: "#f74f4f" },
    PRIVATE_KEY: { label: "Private Key", color: "#f74f4f" },
    DB_CREDENTIALS: { label: "Database Credentials", color: "#f74f4f" },
    SERVICE_TOKEN: { label: "Service Token", color: "#f5a623" },
    CREDIT_CARD: { label: "Credit Card", color: "#f5a623" },
    GOV_ID: { label: "Government ID", color: "#f5a623" },
    PERSONAL_CONTACT: { label: "Personal Contact", color: "#4f8ef7" }
  };
  function luhnValid(raw) {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (dbl) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }
  var PATTERNS = [
    // ── Cloud / API keys ─────────────────────────────────────────────────────
    {
      id: "AWS_ACCESS_KEY",
      category: "CLOUD_API_KEY",
      label: "AWS Access Key",
      score: 90,
      placeholder: "[AWS_ACCESS_KEY]",
      candidates: ["akia", "asia", "agpa", "aroa"],
      regex: /\b(?:AKIA|ASIA|AGPA|AROA)[0-9A-Z]{16}\b/g
    },
    {
      id: "GOOGLE_API_KEY",
      category: "CLOUD_API_KEY",
      label: "Google API Key",
      score: 85,
      placeholder: "[GOOGLE_API_KEY]",
      candidates: ["aiza"],
      regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g
    },
    // ── Private keys ─────────────────────────────────────────────────────────
    {
      id: "PRIVATE_KEY_BLOCK",
      category: "PRIVATE_KEY",
      label: "Private Key / Certificate",
      score: 90,
      placeholder: "[PRIVATE_KEY]",
      candidates: ["-----begin", "private key"],
      regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g
    },
    // ── Database credentials ─────────────────────────────────────────────────
    {
      id: "DB_CONNECTION_STRING",
      category: "DB_CREDENTIALS",
      label: "Database Connection String",
      score: 85,
      placeholder: "[DB_CONNECTION_STRING]",
      candidates: ["mongodb://", "mongodb+srv://", "postgres://", "postgresql://", "mysql://", "redis://"],
      regex: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s'"<>]+/gi
    },
    {
      id: "PASSWORD_ASSIGNMENT",
      category: "DB_CREDENTIALS",
      label: "Password Assignment",
      score: 60,
      placeholder: "[PASSWORD]",
      candidates: ["password", "passwd", "pwd"],
      // key = value / key: value, capturing a non-trivial secret value
      regex: /\b(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}/gi
    },
    {
      id: "GENERIC_SECRET_ASSIGNMENT",
      category: "DB_CREDENTIALS",
      label: "Secret / API Key Assignment",
      score: 60,
      placeholder: "[SECRET]",
      candidates: ["api_key", "apikey", "api-key", "secret", "access_token", "auth_token", "client_secret"],
      regex: /\b(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9\-_./+]{8,}/gi
    },
    // ── Service tokens ───────────────────────────────────────────────────────
    {
      id: "OPENAI_KEY",
      category: "SERVICE_TOKEN",
      label: "OpenAI API Key",
      score: 85,
      placeholder: "[OPENAI_API_KEY]",
      candidates: ["sk-"],
      regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g
    },
    {
      id: "GITHUB_PAT",
      category: "SERVICE_TOKEN",
      label: "GitHub Token",
      score: 80,
      placeholder: "[GITHUB_TOKEN]",
      candidates: ["ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_"],
      regex: /\b(?:gh[posur]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/g
    },
    {
      id: "SLACK_TOKEN",
      category: "SERVICE_TOKEN",
      label: "Slack Token",
      score: 80,
      placeholder: "[SLACK_TOKEN]",
      candidates: ["xoxb-", "xoxp-", "xoxa-", "xoxr-", "xoxs-"],
      regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g
    },
    {
      id: "STRIPE_KEY",
      category: "SERVICE_TOKEN",
      label: "Stripe Key",
      score: 85,
      placeholder: "[STRIPE_KEY]",
      candidates: ["sk_live_", "sk_test_", "pk_live_", "rk_live_"],
      regex: /\b[sprk]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g
    },
    {
      id: "NPM_TOKEN",
      category: "SERVICE_TOKEN",
      label: "npm Token",
      score: 80,
      placeholder: "[NPM_TOKEN]",
      candidates: ["npm_"],
      regex: /\bnpm_[A-Za-z0-9]{36}\b/g
    },
    {
      id: "JWT",
      category: "SERVICE_TOKEN",
      label: "JSON Web Token",
      score: 80,
      placeholder: "[JWT]",
      candidates: ["eyj"],
      regex: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*\b/g
    },
    {
      id: "BEARER_TOKEN",
      category: "SERVICE_TOKEN",
      label: "Bearer Token",
      score: 70,
      placeholder: "[BEARER_TOKEN]",
      candidates: ["bearer "],
      regex: /\bBearer\s+[A-Za-z0-9\-._~+/]{12,}=*/g
    },
    // ── Credit cards (anchorless: validated by Luhn) ─────────────────────────
    {
      id: "CREDIT_CARD",
      category: "CREDIT_CARD",
      label: "Credit Card Number",
      score: 75,
      placeholder: "[CREDIT_CARD]",
      candidates: [],
      alwaysScan: true,
      regex: /\b(?:\d[ -]?){13,19}\b/g,
      validate: luhnValid
    },
    // ── Government IDs (anchorless) ──────────────────────────────────────────
    {
      id: "AADHAAR",
      category: "GOV_ID",
      label: "Aadhaar Number (India)",
      score: 70,
      placeholder: "[AADHAAR]",
      candidates: [],
      alwaysScan: true,
      // 12 digits, first not 0/1, optionally space-grouped. The lookbehind/ahead
      // exclude word chars AND hyphens so we don't fire on a UUID segment
      // (e.g. ...-446655440000) or a longer alphanumeric token.
      regex: /(?<![\w-])[2-9]\d{3}\s?\d{4}\s?\d{4}(?![\w-])/g
    },
    {
      id: "US_SSN",
      category: "GOV_ID",
      label: "US Social Security Number",
      score: 70,
      placeholder: "[SSN]",
      candidates: [],
      alwaysScan: true,
      regex: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g
    },
    // ── Personal contact (anchorless) ────────────────────────────────────────
    {
      id: "EMAIL",
      category: "PERSONAL_CONTACT",
      label: "Email Address",
      score: 25,
      placeholder: "[EMAIL]",
      candidates: [],
      alwaysScan: true,
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
    },
    {
      id: "PHONE_INDIA",
      category: "PERSONAL_CONTACT",
      label: "Phone Number (India)",
      score: 20,
      placeholder: "[PHONE]",
      candidates: [],
      alwaysScan: true,
      regex: /\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g
    },
    {
      id: "PHONE_US",
      category: "PERSONAL_CONTACT",
      label: "Phone Number (US)",
      score: 20,
      placeholder: "[PHONE]",
      candidates: [],
      alwaysScan: true,
      regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g
    }
  ];
  var PATTERN_COUNT = PATTERNS.length;

  // src/engine/risk-scorer.js
  var MaxHeap = class {
    constructor() {
      this.items = [];
    }
    get size() {
      return this.items.length;
    }
    peek() {
      return this.items[0];
    }
    push(item) {
      const a = this.items;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const parent = i - 1 >> 1;
        if (a[parent].score >= a[i].score) break;
        [a[parent], a[i]] = [a[i], a[parent]];
        i = parent;
      }
      return this;
    }
    pop() {
      const a = this.items;
      if (a.length === 0) return void 0;
      const top = a[0];
      const last = a.pop();
      if (a.length > 0) {
        a[0] = last;
        this._siftDown(0);
      }
      return top;
    }
    _siftDown(i) {
      const a = this.items;
      const n = a.length;
      for (; ; ) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let largest = i;
        if (l < n && a[l].score > a[largest].score) largest = l;
        if (r < n && a[r].score > a[largest].score) largest = r;
        if (largest === i) break;
        [a[largest], a[i]] = [a[i], a[largest]];
        i = largest;
      }
    }
    /** Pop every item, returning them in descending-score order. Drains the heap. */
    drain() {
      const out = [];
      while (this.size) out.push(this.pop());
      return out;
    }
  };
  var RISK = {
    SAFE: "SAFE",
    CAUTION: "CAUTION",
    HIGH: "HIGH"
  };
  function riskLevel(score) {
    if (score <= 30) return RISK.SAFE;
    if (score <= 60) return RISK.CAUTION;
    return RISK.HIGH;
  }
  function scoreThreats(threats) {
    if (!threats || threats.length === 0) {
      return { score: 0, level: RISK.SAFE, threats: [], threatCount: 0 };
    }
    const heap = new MaxHeap();
    for (const t of threats) heap.push(t);
    const ordered = heap.drain();
    const base = ordered[0].score;
    const bonus = 5 * (ordered.length - 1);
    const score = Math.min(100, base + bonus);
    return {
      score,
      level: riskLevel(score),
      threats: ordered,
      threatCount: ordered.length
    };
  }

  // src/engine/injection-detector.js
  var INJECTION_PHRASES = [
    "ignore previous instructions",
    "ignore all previous",
    "ignore the above",
    "ignore your instructions",
    "disregard your",
    "disregard the above",
    "disregard all previous",
    "forget everything",
    "forget all previous",
    "forget your instructions",
    "you are now dan",
    "act as dan",
    "act as an unrestricted",
    "act as a jailbroken",
    "pretend you have no restrictions",
    "your new instructions",
    "new instructions:",
    "reveal your system prompt",
    "show me your system prompt",
    "what are your instructions",
    "repeat the words above",
    "repeat everything above",
    "do anything now",
    "dan mode",
    "jailbreak",
    "developer mode",
    "bypass your",
    "override your",
    "without any restrictions",
    "you have no restrictions",
    "ignore safety"
  ];
  var PHRASE_AUTOMATON = new AhoCorasick(
    INJECTION_PHRASES.map((pattern) => ({ pattern }))
  );
  var THRESHOLD = { LOW: 0.8, MEDIUM: 0.6, HIGH: 0.4 };
  var INJECTION_SCORE = 95;
  function detectInjection(text, opts = {}) {
    const sensitivity = opts.sensitivity || "MEDIUM";
    const threshold = THRESHOLD[sensitivity] ?? THRESHOLD.MEDIUM;
    const lower = text.toLowerCase();
    const signals = [];
    let confidence = 0;
    const matches = PHRASE_AUTOMATON.search(lower);
    const matchedPhrases = [...new Set(matches.map((m) => m.pattern))];
    if (matchedPhrases.length > 0) {
      confidence += 0.6 + 0.15 * (matchedPhrases.length - 1);
      signals.push(`matched ${matchedPhrases.length} known injection phrase(s)`);
    }
    if (/\b(system prompt|your instructions|previous instructions|prior instructions|your guidelines|your rules|your programming)\b/.test(lower)) {
      confidence += 0.35;
      signals.push("references the model's own instructions");
    }
    if (/\b(ignore|disregard|forget|override|bypass|reset)\b[\s\S]{0,40}\b(previous|above|prior|instruction|instructions|rules|guidelines|directives|context)\b/.test(lower)) {
      confidence += 0.3;
      signals.push("override verb adjacent to an instruction noun");
    }
    if (/\byou are (?:now |going to be |to act as )?(?:a |an |dan|jailbroken|unrestricted|in developer)\b/.test(lower)) {
      confidence += 0.25;
      signals.push("assigns the model a new role/persona");
    }
    if (/(i|1|l)\s*g\s*n\s*[o0]\s*r\s*e|[i1]nstruct[i1]?[o0]ns?/i.test(text) && !/\binstructions?\b/i.test(lower)) {
      confidence += 0.2;
      signals.push("possible obfuscated trigger word");
    }
    if (text.length > 400) {
      const tail = lower.slice(-120);
      if (/\b(ignore|disregard|now|instead|actually)\b/.test(tail) && /\b(instruction|rules|tell me|reveal|print|output)\b/.test(tail)) {
        confidence += 0.2;
        signals.push("role-change instruction near end of long prompt");
      }
    }
    confidence = Math.min(1, confidence);
    return {
      detected: confidence >= threshold,
      confidence: Math.round(confidence * 100) / 100,
      signals,
      matchedPhrases,
      threshold
    };
  }

  // src/engine/redactor.js
  function mergeSpans(spans) {
    if (spans.length <= 1) return spans.slice();
    const sorted = spans.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    let cur = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i];
      if (s.start < cur.end) {
        if ((s.score ?? 0) > (cur.score ?? 0)) {
          cur.placeholder = s.placeholder;
          cur.score = s.score;
        }
        cur.end = Math.max(cur.end, s.end);
      } else {
        merged.push(cur);
        cur = { ...s };
      }
    }
    merged.push(cur);
    return merged;
  }
  function redact(text, spans) {
    if (!spans || spans.length === 0) return text;
    const merged = mergeSpans(spans);
    let out = "";
    let cursor = 0;
    for (const span of merged) {
      if (span.start > cursor) out += text.slice(cursor, span.start);
      out += span.placeholder;
      cursor = span.end;
    }
    out += text.slice(cursor);
    return out;
  }

  // src/engine/index.js
  var now = () => typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  var DetectionEngine = class {
    /** @param {import('./pattern-dictionary.js').Pattern[]} patterns */
    constructor(patterns = PATTERNS) {
      this.patterns = patterns;
      this.anchorToPatterns = /* @__PURE__ */ new Map();
      const anchors = [];
      patterns.forEach((p, idx) => {
        for (const c of p.candidates || []) {
          const key = c.toLowerCase();
          if (!this.anchorToPatterns.has(key)) {
            this.anchorToPatterns.set(key, /* @__PURE__ */ new Set());
            anchors.push({ pattern: key });
          }
          this.anchorToPatterns.get(key).add(idx);
        }
      });
      this.automaton = new AhoCorasick(anchors);
      this.alwaysScan = patterns.map((p, idx) => p.alwaysScan ? idx : -1).filter((idx) => idx >= 0);
    }
    /**
     * @param {string} text
     * @param {{sensitivity?: 'LOW'|'MEDIUM'|'HIGH'}} [opts]
     */
    scan(text, opts = {}) {
      const t0 = now();
      if (typeof text !== "string" || text.length === 0) {
        return {
          score: 0,
          level: RISK.SAFE,
          threats: [],
          threatCategories: [],
          threatCount: 0,
          redactedText: text || "",
          patternMatchCount: 0,
          processingTimeMs: 0
        };
      }
      const lower = text.toLowerCase();
      const toValidate = new Set(this.alwaysScan);
      for (const m of this.automaton.search(lower)) {
        const ids = this.anchorToPatterns.get(m.pattern);
        if (ids) for (const id of ids) toValidate.add(id);
      }
      const rawMatches = [];
      for (const id of toValidate) {
        const p = this.patterns[id];
        p.regex.lastIndex = 0;
        let match;
        while ((match = p.regex.exec(text)) !== null) {
          const value = match[0];
          if (value.length === 0) {
            p.regex.lastIndex += 1;
            continue;
          }
          if (p.validate && !p.validate(value)) continue;
          rawMatches.push({
            id,
            start: match.index,
            end: match.index + value.length,
            length: value.length,
            score: p.score
          });
        }
      }
      const kept = rawMatches.filter((m) => {
        return !rawMatches.some(
          (o) => o !== m && o.id !== m.id && o.start <= m.start && o.end >= m.end && o.length > m.length && o.score >= m.score
        );
      });
      const spans = [];
      const threatsById = /* @__PURE__ */ new Map();
      let patternMatchCount = 0;
      for (const m of kept) {
        const p = this.patterns[m.id];
        patternMatchCount += 1;
        spans.push({ start: m.start, end: m.end, placeholder: p.placeholder, score: p.score });
        if (!threatsById.has(m.id)) {
          threatsById.set(m.id, {
            id: p.id,
            category: p.category,
            label: p.label,
            score: p.score,
            count: 0
          });
        }
        threatsById.get(m.id).count += 1;
      }
      const threats = [...threatsById.values()];
      const injection = detectInjection(text, opts);
      if (injection.detected) {
        threats.push({
          id: "PROMPT_INJECTION",
          category: "PROMPT_INJECTION",
          label: CATEGORIES.PROMPT_INJECTION.label,
          score: INJECTION_SCORE,
          count: 1,
          confidence: injection.confidence,
          signals: injection.signals
        });
      }
      const scored = scoreThreats(threats);
      const redactedText = redact(text, spans);
      const threatCategories = [...new Set(scored.threats.map((t) => t.category))];
      return {
        score: scored.score,
        level: scored.level,
        threats: scored.threats,
        threatCategories,
        threatCount: scored.threatCount,
        redactedText,
        patternMatchCount,
        injection,
        processingTimeMs: Math.round((now() - t0) * 1e3) / 1e3
      };
    }
  };
  var engine = new DetectionEngine();
  function scan(text, opts) {
    return engine.scan(text, opts);
  }
  return __toCommonJS(index_exports);
})();
