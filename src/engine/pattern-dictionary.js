/**
 * SENTINEL threat pattern dictionary.
 *
 * Two-stage detection model (the same idea grep/Elasticsearch use):
 *   1. CANDIDATE FINDING  — cheap literal anchors fed into Aho-Corasick. Finding
 *      "akia" or "ghp_" or "ignore previous" in the text flags a pattern as
 *      *worth validating*. One linear pass covers all anchored patterns at once.
 *   2. VALIDATION         — a strict regex confirms the full structure and yields
 *      precise match spans (used for scoring + redaction). An optional `validate`
 *      callback adds checks a regex can't express cleanly (e.g. the Luhn checksum
 *      on a credit-card number) to cut false positives.
 *
 * A few structural PII patterns (email, phone, card numbers) have no meaningful
 * literal anchor, so they are marked `alwaysScan: true` and their regex runs every
 * time. There are only a handful of these and they are cheap.
 *
 * Prompt-injection, high-entropy and encoded-secret categories live in their own
 * detectors but are declared here so scoring/UI share one source of truth.
 */

/** Category-level metadata: severity color + human label. */
export const CATEGORIES = {
  PROMPT_INJECTION: { label: 'Prompt Injection', color: '#c84fff' },
  CLOUD_API_KEY: { label: 'Cloud / API Key', color: '#f74f4f' },
  PRIVATE_KEY: { label: 'Private Key', color: '#f74f4f' },
  DB_CREDENTIALS: { label: 'Database Credentials', color: '#f74f4f' },
  SERVICE_TOKEN: { label: 'Service Token', color: '#f5a623' },
  HIGH_ENTROPY_SECRET: { label: 'High-Entropy Secret', color: '#f74f4f' },
  ENCODED_SECRET: { label: 'Encoded Secret', color: '#f74f4f' },
  CREDIT_CARD: { label: 'Credit Card', color: '#f5a623' },
  GOV_ID: { label: 'Government ID', color: '#f5a623' },
  PERSONAL_CONTACT: { label: 'Personal Contact', color: '#4f8ef7' },
};

/**
 * Luhn checksum — validates credit-card-shaped numbers so random 16-digit strings
 * (order numbers, IDs) don't get flagged as cards.
 */
export function luhnValid(raw) {
  const digits = raw.replace(/[^\d]/g, '');
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

/**
 * @typedef {Object} Pattern
 * @property {string}   id          unique pattern id
 * @property {string}   category    key into CATEGORIES
 * @property {string}   label       human label shown in the modal
 * @property {number}   score       base severity weight (0-100)
 * @property {string}   placeholder redaction replacement, e.g. "[AWS_ACCESS_KEY]"
 * @property {string[]} candidates  lowercase literal anchors for Aho-Corasick
 * @property {RegExp}   regex       global validator producing precise spans
 * @property {(m:string)=>boolean} [validate] optional extra check on the matched text
 * @property {boolean}  [alwaysScan] run regex even without a candidate hit (anchorless PII)
 */

/** @type {Pattern[]} */
export const PATTERNS = [
  // ── Cloud / API keys ─────────────────────────────────────────────────────
  {
    id: 'AWS_ACCESS_KEY',
    category: 'CLOUD_API_KEY',
    label: 'AWS Access Key',
    score: 90,
    placeholder: '[AWS_ACCESS_KEY]',
    candidates: ['akia', 'asia', 'agpa', 'aroa'],
    regex: /\b(?:AKIA|ASIA|AGPA|AROA)[0-9A-Z]{16}\b/g,
  },
  {
    id: 'GOOGLE_API_KEY',
    category: 'CLOUD_API_KEY',
    label: 'Google API Key',
    score: 85,
    placeholder: '[GOOGLE_API_KEY]',
    candidates: ['aiza'],
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
  },

  // ── Private keys ─────────────────────────────────────────────────────────
  {
    id: 'PRIVATE_KEY_BLOCK',
    category: 'PRIVATE_KEY',
    label: 'Private Key / Certificate',
    score: 90,
    placeholder: '[PRIVATE_KEY]',
    candidates: ['-----begin', 'private key'],
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },

  // ── Database credentials ─────────────────────────────────────────────────
  {
    id: 'DB_CONNECTION_STRING',
    category: 'DB_CREDENTIALS',
    label: 'Database Connection String',
    score: 85,
    placeholder: '[DB_CONNECTION_STRING]',
    candidates: ['mongodb://', 'mongodb+srv://', 'postgres://', 'postgresql://', 'mysql://', 'redis://'],
    regex: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s'"<>]+/gi,
  },
  {
    id: 'PASSWORD_ASSIGNMENT',
    category: 'DB_CREDENTIALS',
    label: 'Password Assignment',
    score: 60,
    placeholder: '[PASSWORD]',
    candidates: ['password', 'passwd', 'pwd'],
    // key = value / key: value, capturing a non-trivial secret value
    regex: /\b(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}/gi,
  },
  {
    id: 'GENERIC_SECRET_ASSIGNMENT',
    category: 'DB_CREDENTIALS',
    label: 'Secret / API Key Assignment',
    score: 60,
    placeholder: '[SECRET]',
    candidates: ['api_key', 'apikey', 'api-key', 'secret', 'access_token', 'auth_token', 'client_secret'],
    regex: /\b(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9\-_./+]{8,}/gi,
  },

  // ── Service tokens ───────────────────────────────────────────────────────
  {
    id: 'OPENAI_KEY',
    category: 'SERVICE_TOKEN',
    label: 'OpenAI API Key',
    score: 85,
    placeholder: '[OPENAI_API_KEY]',
    candidates: ['sk-'],
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: 'GITHUB_PAT',
    category: 'SERVICE_TOKEN',
    label: 'GitHub Token',
    score: 80,
    placeholder: '[GITHUB_TOKEN]',
    candidates: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'],
    regex: /\b(?:gh[posur]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/g,
  },
  {
    id: 'SLACK_TOKEN',
    category: 'SERVICE_TOKEN',
    label: 'Slack Token',
    score: 80,
    placeholder: '[SLACK_TOKEN]',
    candidates: ['xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: 'STRIPE_KEY',
    category: 'SERVICE_TOKEN',
    label: 'Stripe Key',
    score: 85,
    placeholder: '[STRIPE_KEY]',
    candidates: ['sk_live_', 'sk_test_', 'pk_live_', 'rk_live_'],
    regex: /\b[sprk]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    id: 'NPM_TOKEN',
    category: 'SERVICE_TOKEN',
    label: 'npm Token',
    score: 80,
    placeholder: '[NPM_TOKEN]',
    candidates: ['npm_'],
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
  },
  {
    id: 'JWT',
    category: 'SERVICE_TOKEN',
    label: 'JSON Web Token',
    score: 80,
    placeholder: '[JWT]',
    candidates: ['eyj'],
    regex: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*\b/g,
  },
  {
    id: 'BEARER_TOKEN',
    category: 'SERVICE_TOKEN',
    label: 'Bearer Token',
    score: 70,
    placeholder: '[BEARER_TOKEN]',
    candidates: ['bearer '],
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]{12,}=*/g,
  },

  // ── Credit cards (anchorless: validated by Luhn) ─────────────────────────
  {
    id: 'CREDIT_CARD',
    category: 'CREDIT_CARD',
    label: 'Credit Card Number',
    score: 75,
    placeholder: '[CREDIT_CARD]',
    candidates: [],
    alwaysScan: true,
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    validate: luhnValid,
  },

  // ── Government IDs (anchorless) ──────────────────────────────────────────
  {
    id: 'AADHAAR',
    category: 'GOV_ID',
    label: 'Aadhaar Number (India)',
    score: 70,
    placeholder: '[AADHAAR]',
    candidates: [],
    alwaysScan: true,
    // 12 digits, first not 0/1, optionally space-grouped. The lookbehind/ahead
    // exclude word chars AND hyphens so we don't fire on a UUID segment
    // (e.g. ...-446655440000) or a longer alphanumeric token.
    regex: /(?<![\w-])[2-9]\d{3}\s?\d{4}\s?\d{4}(?![\w-])/g,
  },
  {
    id: 'US_SSN',
    category: 'GOV_ID',
    label: 'US Social Security Number',
    score: 70,
    placeholder: '[SSN]',
    candidates: [],
    alwaysScan: true,
    regex: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
  },

  // ── Personal contact (anchorless) ────────────────────────────────────────
  {
    id: 'EMAIL',
    category: 'PERSONAL_CONTACT',
    label: 'Email Address',
    score: 25,
    placeholder: '[EMAIL]',
    candidates: [],
    alwaysScan: true,
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    id: 'PHONE_INDIA',
    category: 'PERSONAL_CONTACT',
    label: 'Phone Number (India)',
    score: 20,
    placeholder: '[PHONE]',
    candidates: [],
    alwaysScan: true,
    regex: /\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g,
  },
  {
    id: 'PHONE_US',
    category: 'PERSONAL_CONTACT',
    label: 'Phone Number (US)',
    score: 20,
    placeholder: '[PHONE]',
    candidates: [],
    alwaysScan: true,
    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
  },
];

export const PATTERN_COUNT = PATTERNS.length;
