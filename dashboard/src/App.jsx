import { useEffect, useState, useCallback } from 'react';
import Background3D from './components/Background3D.jsx';
import Overview from './components/Overview.jsx';
import History from './components/History.jsx';
import Settings from './components/Settings.jsx';
import { getEvents } from './data.js';

const TABS = ['Overview', 'History', 'Settings'];

export default function App() {
  const [tab, setTab] = useState('Overview');
  const [events, setEvents] = useState([]);
  const [theme, setTheme] = useState('light');

  const reload = useCallback(() => {
    getEvents().then(setEvents);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return (
    <>
      <div className="aurora" aria-hidden>
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>
      <Background3D />
      <div className="app">
        <div className="topbar">
          <span className="brand"><span>🛡 SENTINEL</span></span>
          <nav className="nav">
            {TABS.map((t) => (
              <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </nav>
          <div className="spacer" />
          <span className="status-pill"><span className="dot" /> Protected</span>
          <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
          </button>
        </div>

        {tab === 'Overview' && <Overview events={events} />}
        {tab === 'History' && <History events={events} />}
        {tab === 'Settings' && <Settings onChanged={reload} />}
      </div>
    </>
  );
}
