/**
 * Adapter registry — the LLM-agnostic layer.
 *
 * A hash map keyed by hostname. On page load the content script does an O(1)
 * lookup; if the host isn't here, SENTINEL does nothing (zero overhead on
 * unsupported sites). Adding a new LLM is a config entry, not a code change —
 * this is the open/closed principle in practice.
 *
 * Each adapter only knows HOW to find the input box and the send action on its
 * site. It knows nothing about detection. Selectors are arrays (tried in order)
 * so a single class-name change upstream doesn't break interception.
 *
 * Exposed as a global (classic content script, shares the isolated-world scope).
 */
(function () {
  /** @type {Record<string, object>} */
  const ADAPTERS = {
    'chatgpt.com': {
      name: 'ChatGPT',
      inputSelectors: ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'],
      submitSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send" i]',
      ],
      // ChatGPT submits on Enter inside a contenteditable / textarea.
      intercept: 'keydown',
    },
    'chat.openai.com': {
      name: 'ChatGPT',
      inputSelectors: ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'],
      submitSelectors: ['button[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
      intercept: 'keydown',
    },
    'claude.ai': {
      name: 'Claude',
      inputSelectors: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
      submitSelectors: ['button[aria-label*="Send" i]', 'button[aria-label*="message" i]'],
      intercept: 'keydown',
    },
    'gemini.google.com': {
      name: 'Gemini',
      inputSelectors: ['.ql-editor[contenteditable="true"]', 'div[contenteditable="true"]', 'textarea'],
      submitSelectors: ['button[aria-label*="Send" i]', 'button.send-button'],
      intercept: 'keydown',
    },
  };

  /** O(1) lookup; tolerates a leading "www." */
  function getAdapter(hostname) {
    return ADAPTERS[hostname] || ADAPTERS[hostname.replace(/^www\./, '')] || null;
  }

  globalThis.SENTINEL_ADAPTERS = { ADAPTERS, getAdapter };
})();
