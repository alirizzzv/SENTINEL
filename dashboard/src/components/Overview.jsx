import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  Tooltip,
  Filler,
} from 'chart.js';
import RiskBadge from './RiskBadge.jsx';
import { computeStats, riskTrend, threatBreakdown } from '../data.js';

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Filler);

function StatCard({ num, cap, sub }) {
  return (
    <div className="card stat">
      <div className="num">{num}</div>
      <div className="cap">{cap}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Overview({ events }) {
  const stats = computeStats(events);
  const trend = riskTrend(events);
  const breakdown = threatBreakdown(events);

  const lineData = {
    labels: trend.map((t) => t.label),
    datasets: [
      {
        data: trend.map((t) => t.value),
        borderColor: '#4f8ef7',
        backgroundColor: 'rgba(79,142,247,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };
  const lineOpts = {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#8899aa', maxTicksLimit: 8, font: { size: 10 } } },
      y: { grid: { color: 'rgba(136,153,170,0.1)' }, ticks: { color: '#8899aa', font: { size: 10 } }, min: 0, max: 100 },
    },
    maintainAspectRatio: false,
  };

  const doughnutData = {
    labels: breakdown.map((b) => b.label),
    datasets: [
      {
        data: breakdown.map((b) => b.count),
        backgroundColor: breakdown.map((b) => b.color),
        borderColor: '#0f1623',
        borderWidth: 2,
      },
    ],
  };
  const recent = [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  return (
    <div className="page">
      <div className="section-title">Overview</div>
      <div className="grid-4">
        <StatCard num={stats.total} cap="Prompts Scanned" sub="all time" />
        <StatCard num={stats.threatsCaught} cap="Threats Caught" />
        <StatCard num={`${stats.redactionRate}%`} cap="Redaction Rate" sub="of threats redacted" />
        <StatCard num={stats.cleanStreak} cap="Clean Streak" sub="consecutive safe" />
      </div>

      <div className="grid-2 mt">
        <div className="card">
          <div className="section-title">Risk Trend · last 30 days</div>
          <div style={{ height: 220 }}>
            <Line data={lineData} options={lineOpts} />
          </div>
        </div>
        <div className="card">
          <div className="section-title">Threat Breakdown</div>
          {breakdown.length ? (
            <>
              <div style={{ height: 150 }}>
                <Doughnut
                  data={doughnutData}
                  options={{ plugins: { legend: { display: false } }, cutout: '62%', maintainAspectRatio: false }}
                />
              </div>
              <div className="mt">
                {breakdown.map((b) => (
                  <div className="bd-row" key={b.category}>
                    <span className="bd-dot" style={{ background: b.color }} />
                    <span className="bd-label">{b.label}</span>
                    <span className="bd-count">{b.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">No threats detected yet.</div>
          )}
        </div>
      </div>

      <div className="card mt">
        <div className="section-title">Recent Activity</div>
        {recent.length ? (
          recent.map((e) => (
            <div className="bd-row" key={e.id}>
              <span className="mono muted" style={{ width: 70 }}>{timeAgo(e.timestamp)}</span>
              <span style={{ width: 80 }}>{e.llm}</span>
              <RiskBadge level={e.riskLevel} />
              <span className="cats" style={{ flex: 1 }}>
                {(e.threatCategories || []).map((c, i) => (
                  <span className="cat-chip" key={i}>{c}</span>
                ))}
              </span>
              <span className="muted mono" style={{ fontSize: 11 }}>{e.userDecision}</span>
            </div>
          ))
        ) : (
          <div className="empty">No activity yet.</div>
        )}
      </div>
    </div>
  );
}
