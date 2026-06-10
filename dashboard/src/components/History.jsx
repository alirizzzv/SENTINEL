import { useMemo, useState } from 'react';
import RiskBadge from './RiskBadge.jsx';

const COLS = [
  { key: 'timestamp', label: 'Time' },
  { key: 'llm', label: 'LLM' },
  { key: 'riskLevel', label: 'Risk' },
  { key: 'riskScore', label: 'Score' },
  { key: 'threatCategories', label: 'Threats' },
  { key: 'userDecision', label: 'Decision' },
  { key: 'processingTimeMs', label: 'Speed' },
];

function toCSV(events) {
  const header = 'timestamp,llm,riskLevel,riskScore,threatCategories,threatCount,userDecision,processingTimeMs';
  const rows = events.map((e) =>
    [
      new Date(e.timestamp).toISOString(),
      e.llm,
      e.riskLevel,
      e.riskScore,
      `"${(e.threatCategories || []).join('|')}"`,
      e.threatCount,
      e.userDecision,
      e.processingTimeMs,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export default function History({ events }) {
  const [risk, setRisk] = useState('ALL');
  const [llm, setLlm] = useState('ALL');
  const [sort, setSort] = useState({ key: 'timestamp', dir: -1 });

  const filtered = useMemo(() => {
    let out = events.filter(
      (e) => (risk === 'ALL' || e.riskLevel === risk) && (llm === 'ALL' || e.llm === llm),
    );
    out = [...out].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av < bv) return -sort.dir;
      if (av > bv) return sort.dir;
      return 0;
    });
    return out;
  }, [events, risk, llm, sort]);

  function exportCSV() {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sentinel-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="section-title">History · {filtered.length} events</div>
      <div className="filters">
        <select value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="ALL">All risk levels</option>
          <option value="SAFE">Safe</option>
          <option value="CAUTION">Caution</option>
          <option value="HIGH">High</option>
        </select>
        <select value={llm} onChange={(e) => setLlm(e.target.value)}>
          <option value="ALL">All LLMs</option>
          <option value="ChatGPT">ChatGPT</option>
          <option value="Claude">Claude</option>
          <option value="Gemini">Gemini</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="card" style={{ padding: 6 }}>
        <table className="history">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() =>
                    setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : -1 }))
                  }
                >
                  {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="mono muted">{new Date(e.timestamp).toLocaleString()}</td>
                <td>{e.llm}</td>
                <td><RiskBadge level={e.riskLevel} /></td>
                <td className="mono">{e.riskScore}</td>
                <td>
                  <span className="cats">
                    {(e.threatCategories || []).map((c, i) => (
                      <span className="cat-chip" key={i}>{c}</span>
                    ))}
                  </span>
                </td>
                <td className="mono muted">{e.userDecision}</td>
                <td className="mono muted">{e.processingTimeMs}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="empty">No events match these filters.</div>}
      </div>
    </div>
  );
}
