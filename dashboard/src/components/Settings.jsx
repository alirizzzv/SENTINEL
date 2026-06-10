import { useState } from 'react';
import { CATEGORY_META, clearEvents, isExtension } from '../data.js';

function Switch({ on, onClick }) {
  return (
    <div className={`switch ${on ? 'on' : ''}`} onClick={onClick} role="switch" aria-checked={on}>
      <span className="knob" />
    </div>
  );
}

export default function Settings({ onChanged }) {
  const [sensitivity, setSensitivity] = useState('MEDIUM');
  const [adapters, setAdapters] = useState({ ChatGPT: true, Claude: true, Gemini: true });
  const [cats, setCats] = useState(
    Object.fromEntries(Object.keys(CATEGORY_META).map((k) => [k, true])),
  );

  async function handleClear() {
    if (!confirm('Clear all locally stored scan history? This cannot be undone.')) return;
    await clearEvents();
    onChanged && onChanged();
  }

  return (
    <div className="page">
      <div className="section-title">Detection</div>
      <div className="card">
        <div className="set-row">
          <div className="set-label">
            <b>Injection sensitivity</b>
            <span>Lower the threshold to catch subtler injection attempts.</span>
          </div>
          <div className="seg">
            {['LOW', 'MEDIUM', 'HIGH'].map((s) => (
              <button key={s} className={sensitivity === s ? 'active' : ''} onClick={() => setSensitivity(s)}>
                {s[0] + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        {Object.entries(CATEGORY_META).map(([k, m]) => (
          <div className="set-row" key={k}>
            <div className="set-label">
              <b style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                {m.label}
              </b>
            </div>
            <Switch on={cats[k]} onClick={() => setCats((c) => ({ ...c, [k]: !c[k] }))} />
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 20 }}>LLM Adapters</div>
      <div className="card">
        {Object.keys(adapters).map((name) => (
          <div className="set-row" key={name}>
            <div className="set-label"><b>{name}</b><span>Intercept prompts on {name}.</span></div>
            <Switch on={adapters[name]} onClick={() => setAdapters((a) => ({ ...a, [name]: !a[name] }))} />
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 20 }}>Privacy</div>
      <div className="card">
        <div className="set-row">
          <div className="set-label">
            <b>Local history</b>
            <span>{isExtension ? 'Stored in your browser (IndexedDB), metadata only.' : 'Preview data (no extension context).'}</span>
          </div>
          <button className="btn btn-danger" onClick={handleClear}>Clear history</button>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 20 }}>Enterprise</div>
      <div className="card disabled-box">
        <div className="set-row">
          <div className="set-label"><b>Enterprise sync</b><span>Send anonymized metadata to your org's backend.</span></div>
          <Switch on={false} onClick={() => {}} />
        </div>
        <div className="set-row"><div className="set-label"><b>Backend URL</b></div><input className="btn" placeholder="https://…" disabled /></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Contact your IT admin to enable enterprise mode.</div>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Settings shown here are a control surface for the demo build; wiring them to persisted
        config is part of the enterprise milestone.
      </div>
    </div>
  );
}
