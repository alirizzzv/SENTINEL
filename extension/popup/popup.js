/* Popup — pulls aggregate stats from the background worker and renders them. */

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return `${Math.floor(h / 24)} day(s) ago`;
}

function render(stats) {
  document.getElementById('todayScans').textContent = stats.todayScans ?? 0;
  document.getElementById('todayThreats').textContent = stats.todayThreats ?? 0;
  document.getElementById('streak').textContent = stats.cleanStreak ?? 0;

  const last = document.getElementById('lastThreat');
  if (stats.lastThreat) {
    const cats = (stats.lastThreat.categories || []).join(', ') || 'threat';
    last.textContent = `Last threat: ${timeAgo(stats.lastThreat.when)} · ${cats}`;
  } else {
    last.textContent = 'No threats recorded yet.';
  }
}

chrome.runtime.sendMessage({ type: 'SENTINEL_STATS' }, (resp) => {
  if (resp && resp.ok) render(resp.stats);
});

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
});
