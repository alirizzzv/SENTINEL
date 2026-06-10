export default function RiskBadge({ level }) {
  const text = level === 'HIGH' ? 'HIGH' : level;
  return <span className={`badge ${level}`}>{text}</span>;
}
