/**
 * Interceptor modal — injected into the LLM page when a threat is detected.
 *
 * SENTINEL_MODAL.show({ result, llmName }) returns a Promise that resolves to
 * one of: 'REDACTED' | 'SENT_ANYWAY' | 'CANCELLED'. The content script awaits
 * this before deciding whether/what to send.
 *
 * Security note: prompt text and redacted preview are inserted with textContent,
 * never innerHTML — SENTINEL must never become an injection vector itself.
 */
(function () {
  const DECISION = { REDACTED: 'REDACTED', SENT_ANYWAY: 'SENT_ANYWAY', CANCELLED: 'CANCELLED' };

  const LEVEL_LABEL = { SAFE: 'SAFE', CAUTION: 'CAUTION', HIGH: 'HIGH RISK' };

  function categoryColor(category) {
    const cats = (globalThis.SENTINEL && globalThis.SENTINEL.CATEGORIES) || {};
    return (cats[category] && cats[category].color) || '#8899aa';
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  let activeRoot = null;

  function destroy() {
    if (activeRoot) {
      activeRoot.classList.add('sentinel-leaving');
      const node = activeRoot;
      setTimeout(() => node.remove(), 250);
      activeRoot = null;
    }
  }

  /**
   * @param {{result: object, llmName: string}} args
   * @returns {Promise<string>}
   */
  function show({ result, llmName }) {
    destroy(); // never stack modals

    return new Promise((resolve) => {
      const root = el('div', 'sentinel-root sentinel-level-' + result.level);
      activeRoot = root;

      const card = el('div', 'sentinel-card');

      // Header
      const header = el('div', 'sentinel-header');
      header.appendChild(el('span', 'sentinel-shield', '🛡'));
      header.appendChild(el('span', 'sentinel-title', 'SENTINEL detected sensitive content'));
      if (llmName) header.appendChild(el('span', 'sentinel-llm', llmName));
      card.appendChild(header);

      // Risk bar
      const riskRow = el('div', 'sentinel-risk');
      const riskLabel = el('div', 'sentinel-risk-label',
        `${LEVEL_LABEL[result.level] || result.level} · ${result.score}/100`);
      const track = el('div', 'sentinel-bar-track');
      const fill = el('div', 'sentinel-bar-fill');
      fill.style.width = Math.max(4, result.score) + '%';
      track.appendChild(fill);
      riskRow.appendChild(riskLabel);
      riskRow.appendChild(track);
      card.appendChild(riskRow);

      // Threat list (already sorted by severity, highest first)
      const list = el('div', 'sentinel-threats');
      for (const t of result.threats) {
        const row = el('div', 'sentinel-threat');
        const dot = el('span', 'sentinel-dot');
        dot.style.background = categoryColor(t.category);
        const label = el('span', 'sentinel-threat-label', t.label);
        const count = t.count > 1 ? el('span', 'sentinel-threat-count', `×${t.count}`) : null;
        const score = el('span', 'sentinel-threat-score', String(t.score));
        row.appendChild(dot);
        row.appendChild(label);
        if (count) row.appendChild(count);
        row.appendChild(score);
        list.appendChild(row);
      }
      card.appendChild(list);

      // Redacted preview
      if (result.redactedText) {
        const previewWrap = el('div', 'sentinel-preview-wrap');
        previewWrap.appendChild(el('div', 'sentinel-preview-label', 'Redacted version'));
        const preview = el('div', 'sentinel-preview');
        preview.textContent = result.redactedText;
        previewWrap.appendChild(preview);
        card.appendChild(previewWrap);
      }

      // Actions
      const actions = el('div', 'sentinel-actions');
      const btnRedact = el('button', 'sentinel-btn sentinel-btn-primary', 'Redact & Send');
      const btnSend = el('button', 'sentinel-btn sentinel-btn-warning', 'Send Anyway');
      const btnCancel = el('button', 'sentinel-btn sentinel-btn-ghost', 'Cancel');
      actions.appendChild(btnRedact);
      actions.appendChild(btnSend);
      actions.appendChild(btnCancel);
      card.appendChild(actions);

      card.appendChild(el('div', 'sentinel-note', '⚠ "Send Anyway" is logged locally (no content stored).'));

      const finish = (decision) => {
        destroy();
        resolve(decision);
      };
      btnRedact.addEventListener('click', () => finish(DECISION.REDACTED));
      btnSend.addEventListener('click', () => finish(DECISION.SENT_ANYWAY));
      btnCancel.addEventListener('click', () => finish(DECISION.CANCELLED));

      // Esc cancels.
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          document.removeEventListener('keydown', onKey, true);
          finish(DECISION.CANCELLED);
        }
      };
      document.addEventListener('keydown', onKey, true);

      root.appendChild(card);
      document.body.appendChild(root);
      // trigger slide-in on next frame
      requestAnimationFrame(() => root.classList.add('sentinel-visible'));
    });
  }

  globalThis.SENTINEL_MODAL = { show, DECISION };
})();
