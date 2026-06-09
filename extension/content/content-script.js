/**
 * Content script — the DOM interceptor.
 *
 * Flow on every send attempt (Enter or send-button click):
 *   1. O(1) adapter lookup for this host (else do nothing).
 *   2. Read the prompt text from the adapter's input element.
 *   3. SENTINEL.scan(text)  — runs SYNCHRONOUSLY in-page (engine is bundled in).
 *   4. SAFE  -> let the send proceed untouched; log metadata-only, fire & forget.
 *      THREAT-> preventDefault immediately, then show the modal and await the
 *               user's decision (redact / send-anyway / cancel) before resending.
 *   5. Forward metadata-only to the background worker for IndexedDB persistence.
 *
 * Detection is synchronous so preventDefault is effective; only storage is async.
 */
(function () {
  const TAG = '[SENTINEL]';
  const { getAdapter } = globalThis.SENTINEL_ADAPTERS || {};
  const adapter = getAdapter ? getAdapter(location.hostname) : null;
  if (!adapter) return; // unsupported site — zero overhead

  console.info(`${TAG} active on ${adapter.name}`);

  let bypassNext = false; // lets a programmatic resend through our own listener

  // ── element helpers ──────────────────────────────────────────────────────
  function firstVisible(selectors) {
    for (const sel of selectors) {
      for (const node of document.querySelectorAll(sel)) {
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return node;
      }
    }
    return null;
  }
  const getInput = () => firstVisible(adapter.inputSelectors);
  const getSubmit = () => firstVisible(adapter.submitSelectors);

  function getText(input) {
    if (!input) return '';
    if ('value' in input && typeof input.value === 'string') return input.value;
    return input.innerText || input.textContent || '';
  }

  function setText(input, text) {
    if (!input) return;
    if ('value' in input && typeof input.value === 'string') {
      input.value = text;
    } else {
      input.textContent = text; // best-effort for contenteditable editors
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  function triggerSend(input) {
    bypassNext = true;
    const submit = getSubmit();
    if (submit) {
      submit.click();
    } else if (input) {
      const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
      input.dispatchEvent(new KeyboardEvent('keydown', opts));
      input.dispatchEvent(new KeyboardEvent('keyup', opts));
    }
    // safety: clear the flag shortly after in case nothing fired
    setTimeout(() => { bypassNext = false; }, 50);
  }

  // ── persistence (metadata only) ──────────────────────────────────────────
  function logEvent(result, decision) {
    try {
      chrome.runtime.sendMessage({
        type: 'SENTINEL_EVENT',
        payload: {
          llm: adapter.name,
          riskLevel: result.level,
          riskScore: result.score,
          threatCategories: result.threatCategories,
          threatCount: result.threatCount,
          userDecision: decision,
          processingTimeMs: result.processingTimeMs,
          patternMatchCount: result.patternMatchCount,
        },
      });
    } catch (e) {
      /* extension context may be invalidated on reload; ignore */
    }
  }

  // ── interception core ──────────────────────────────────────────────────--
  // Returns true if the event was intercepted (caller should stop it).
  function handleSendAttempt(input, originalEvent) {
    const text = getText(input).trim();
    if (!text) return false;

    const result = globalThis.SENTINEL.scan(text);

    if (result.threatCount === 0) {
      logEvent(result, 'ALLOWED'); // fire & forget, send proceeds
      return false;
    }

    // Threat: block the original send synchronously, then resolve via modal.
    if (originalEvent) {
      originalEvent.preventDefault();
      originalEvent.stopPropagation();
      originalEvent.stopImmediatePropagation();
    }

    globalThis.SENTINEL_MODAL.show({ result, llmName: adapter.name }).then((decision) => {
      logEvent(result, decision);
      if (decision === 'REDACTED') {
        setText(input, result.redactedText);
        setTimeout(() => triggerSend(input), 0);
      } else if (decision === 'SENT_ANYWAY') {
        triggerSend(input);
      }
      // CANCELLED -> leave the prompt in the box for the user to edit
    });
    return true;
  }

  // Enter to send (without Shift), captured before the site sees it.
  document.addEventListener(
    'keydown',
    (e) => {
      if (bypassNext) { bypassNext = false; return; }
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      const input = getInput();
      if (!input) return;
      if (e.target !== input && !input.contains(e.target)) return;
      handleSendAttempt(input, e);
    },
    true,
  );

  // Send-button click.
  document.addEventListener(
    'click',
    (e) => {
      if (bypassNext) { bypassNext = false; return; }
      const submit = getSubmit();
      if (!submit) return;
      if (e.target !== submit && !submit.contains(e.target)) return;
      const input = getInput();
      if (!input) return;
      handleSendAttempt(input, e);
    },
    true,
  );
})();
