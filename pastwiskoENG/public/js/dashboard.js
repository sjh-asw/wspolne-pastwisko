/* ─── Instructor Dashboard ─────────────────────────────────────────────── */
const socket = io(window.location.origin, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 20,
  transports: ['websocket', 'polling']
});
let firstConnect = true;

socket.on('connect', () => {
  if (!firstConnect && roomCode && dashboardToken) {
    // Reconnect after socket drop — rejoin existing room
    socket.emit('dashboard:join', { code: roomCode, token: dashboardToken }, (res) => {
      if (res && res.success) return;
      // Room gone — nothing we can do
    });
  }
  firstConnect = false;
});

const ANIMALS = {
  rabbit: { name: 'Rabbit', emoji: '🐇', value: 1 },
  sheep:  { name: 'Sheep',  emoji: '🐑', value: 2 },
  pig:    { name: 'Pig',    emoji: '🐷', value: 4 },
  cow:    { name: 'Cow',    emoji: '🐄', value: 8 }
};
const ANIMAL_TYPES = ['rabbit', 'sheep', 'pig', 'cow'];

// HTML escape to prevent XSS from player names
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let state = {};
let roomCode = null;
let dashboardToken = null;
let pastureChart = null;
let timerInterval = null;
let controlsVisible = false;

// ─── Screens ──────────────────────────────────────────────────────────────
const screens = document.querySelectorAll('.dash-screen');
function showScreen(id) {
  screens.forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.getElementById('dash-top-bar').classList.toggle('hidden',
    id === 'dash-lobby' || id === 'dash-comparison');
}

// ─── QR Code + URL ───────────────────────────────────────────────────────
function updateLobbyUrl(code) {
  // On cloud (HTTPS or non-default port hidden): use window.location.origin
  // On LAN (HTTP + localhost/IP): try /api/network-info for proper LAN IP
  const origin = window.location.origin;
  const isCloud = window.location.protocol === 'https:';

  if (isCloud) {
    // Cloud deployment — use the public URL directly
    const playUrl = `${origin}/play.html`;
    document.getElementById('room-url').textContent = `Go to: ${origin}`;
    generateQR(playUrl);
  } else {
    // Local/WiFi — fetch LAN IP from server
    fetch('/api/network-info')
      .then(r => r.json())
      .then(info => {
        const playUrl = `${info.url}/play.html`;
        document.getElementById('room-url').textContent = `Go to: ${playUrl}`;
        generateQR(playUrl);
      })
      .catch(() => {
        const playUrl = `${origin}/play.html`;
        document.getElementById('room-url').textContent = `Go to: ${origin}`;
        generateQR(playUrl);
      });
  }
}

let qrInstance = null;
function generateQR(url) {
  const container = document.getElementById('qr-container');
  if (!container || typeof QRCode === 'undefined') return;
  // Clear previous QR
  container.innerHTML = '';
  qrInstance = new QRCode(container, {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#795548',
    colorLight: '#FFF8E1',
    correctLevel: QRCode.CorrectLevel.M
  });
}

// ─── Create or Rejoin Room on Load ───────────────────────────────────────
function initRoom() {
  // Try to rejoin existing room from localStorage (page refresh recovery)
  try {
    const saved = JSON.parse(localStorage.getItem('pasture_dashboard'));
    if (saved && saved.code && saved.token) {
      socket.emit('dashboard:join', { code: saved.code, token: saved.token }, (res) => {
        if (res && res.success) {
          roomCode = saved.code;
          dashboardToken = saved.token;
          document.getElementById('room-code').textContent = saved.code;
          updateLobbyUrl(saved.code);
          // State will arrive via game:state event
          return;
        }
        // Room no longer exists or token invalid — create new
        localStorage.removeItem('pasture_dashboard');
        createNewRoom();
      });
      return;
    }
  } catch(e) {}
  createNewRoom();
}

function createNewRoom() {
  socket.emit('room:create', (res) => {
    if (res && res.error) {
      document.getElementById('room-code').textContent = '---';
      document.getElementById('room-url').textContent = res.error;
      showScreen('dash-lobby');
      return;
    }
    roomCode = res.code;
    dashboardToken = res.token;
    try { localStorage.setItem('pasture_dashboard', JSON.stringify({ code: res.code, token: res.token })); } catch(e) {}
    document.getElementById('room-code').textContent = res.code;
    updateLobbyUrl(res.code);
    showScreen('dash-lobby');
  });
}

initRoom();

// ─── Lobby ────────────────────────────────────────────────────────────────
const playerListEl = document.getElementById('lobby-player-list');
const playerCountEl = document.getElementById('lobby-player-count');
const startBtn = document.getElementById('start-game-btn');

socket.on('player:joined', ({ name, playerCount, players }) => {
  playerCountEl.textContent = playerCount;
  playerListEl.innerHTML = '';
  for (const n of players) {
    const chip = document.createElement('span');
    chip.className = 'player-chip';
    chip.textContent = n;
    playerListEl.appendChild(chip);
  }
  startBtn.disabled = playerCount < 2;
});

socket.on('player:disconnected', ({ name, playerCount }) => {
  playerCountEl.textContent = playerCount;
});

socket.on('player:reconnected', ({ name, playerCount }) => {
  playerCountEl.textContent = playerCount;
});

// ─── Round count selector ────────────────────────────────────────────────
document.querySelectorAll('.round-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const rounds = parseInt(btn.dataset.rounds);
    socket.emit('instructor:setRounds', { maxRounds: rounds });
    const hint = document.getElementById('round-config-hint');
    if (hint) {
      if (rounds === 0) {
        hint.textContent = 'Unlimited rounds — game ends after 3 famines';
      } else {
        hint.textContent = `Game ends after ${rounds} rounds or 2 famines`;
      }
    }
  });
});

startBtn.addEventListener('click', () => {
  socket.emit('game:start');
});

// ─── Timer ────────────────────────────────────────────────────────────────
socket.on('timer:start', ({ duration, endsAt }) => {
  clearInterval(timerInterval);
  const timerEl = document.getElementById('dash-timer');
  function update() {
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    timerEl.textContent = remaining + 's';
    timerEl.classList.remove('warning', 'danger');
    if (remaining <= 5) timerEl.classList.add('danger');
    else if (remaining <= 10) timerEl.classList.add('warning');
    if (remaining <= 0) clearInterval(timerInterval);
  }
  update();
  timerInterval = setInterval(update, 200);
});

socket.on('game:paused', () => {
  clearInterval(timerInterval);
  const timerEl = document.getElementById('dash-timer');
  timerEl.textContent = '⏸';
  timerEl.classList.remove('warning', 'danger');
});

socket.on('game:resumed', () => {
  // Timer will restart via timer:start event from server
});

// ─── Game State ───────────────────────────────────────────────────────────
socket.on('game:state', (s) => {
  state = s;
  // Hide "Next" button when a new active phase starts
  document.getElementById('next-phase-btn').classList.add('hidden');
  if (s.phase === 'lobby' || s.phase === 'betweenGames') {
    showScreen('dash-lobby');
    if (s.gameNumber === 2) {
      document.getElementById('lobby-title').textContent = 'Game 2 — With Communication';
    }
    return;
  }
  showScreen('dash-game');
  updateDashboard();
});

socket.on('game:started', () => {
  showScreen('dash-game');
});

function updateDashboard() {
  // Top bar
  document.getElementById('dash-game-label').textContent =
    `Game ${state.gameNumber}: ${state.gameNumber === 1 ? 'No Communication' : 'With Communication'}`;
  const phaseNames = {
    phaseA: 'Phase A: Acquire Animals',
    phaseB: 'Phase B: Famine',
    phaseC: 'Phase C: Tribute',
    phaseD: 'Phase D: Punishment',
    roundResults: 'Round Results',
    gameOver: 'Game Over'
  };
  const roundLabel = state.maxRounds > 0 ? `Round ${state.round} of ${state.maxRounds}` : `Round ${state.round} (∞)`;
  document.getElementById('dash-round-phase').textContent =
    `${roundLabel} — ${phaseNames[state.phase] || ''}`;

  // Pasture meter
  updatePastureMeter();
  // Round counter
  updateRoundCounter();
  // Famine counter
  updateFamineCounter();
  // Leaderboard
  updateLeaderboard();
  // Phase status
  updatePhaseStatus();
  // Chart
  updateChart();
}

function updatePastureMeter() {
  const total = state.totalHerdValue || 0;
  const cap = state.pastureCapacity || 1;
  const pct = Math.min(100, (total / cap) * 100);

  document.getElementById('pasture-occupancy').textContent = `Occupancy: ${total} / ${cap}`;

  const fill = document.getElementById('pasture-fill-large');
  fill.style.width = pct + '%';
  fill.className = 'fill';
  if (pct < 60) fill.classList.add('green');
  else if (pct < 80) fill.classList.add('yellow');
  else if (pct < 95) fill.classList.add('orange');
  else fill.classList.add('red');
}

function updateRoundCounter() {
  const round = state.round || 0;
  const maxRounds = state.maxRounds != null ? state.maxRounds : 5;
  if (maxRounds > 0) {
    document.getElementById('round-label').textContent = `Round: ${round}/${maxRounds}`;
    let dots = '';
    const showDots = Math.min(maxRounds, 15); // cap visual dots at 15
    for (let i = 1; i <= showDots; i++) {
      dots += i <= round ? '🟩' : '⬜';
    }
    if (maxRounds > 15) dots += '…';
    document.getElementById('round-dots').textContent = dots;
  } else {
    document.getElementById('round-label').textContent = `Round: ${round} (∞)`;
    document.getElementById('round-dots').textContent = '🟩'.repeat(Math.min(round, 20));
  }
}

function updateFamineCounter() {
  const count = state.famineCount || 0;
  const maxFamines = state.maxFamines || 2;
  document.getElementById('famine-label').textContent = `Famines: ${count}/${maxFamines}`;
  let skulls = '';
  for (let i = 0; i < maxFamines; i++) {
    skulls += i < count ? '☠️' : '🦴';
  }
  document.getElementById('famine-skulls').textContent = skulls;
}

function updateLeaderboard() {
  const players = state.players || {};
  const list = Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.herdValue - a.herdValue);

  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '';

  // Top 5
  const top = list.slice(0, 5);
  const bottom = list.length > 8 ? list.slice(-3) : [];

  top.forEach((p, i) => {
    container.appendChild(createLeaderboardItem(i + 1, p));
  });

  if (bottom.length > 0 && list.length > 8) {
    const sep = document.createElement('div');
    sep.className = 'leaderboard-separator';
    sep.textContent = `··· ${list.length - 8} more ···`;
    container.appendChild(sep);

    bottom.forEach((p, i) => {
      container.appendChild(createLeaderboardItem(list.length - 2 + i, p));
    });
  } else if (list.length > 5) {
    list.slice(5).forEach((p, i) => {
      container.appendChild(createLeaderboardItem(6 + i, p));
    });
  }
}

function createLeaderboardItem(rank, p) {
  const item = document.createElement('div');
  item.className = 'leaderboard-item';
  if (p.eliminated) item.style.opacity = '0.4';

  let icons = '';
  for (const t of ANIMAL_TYPES) {
    const c = p.herd[t] || 0;
    if (c > 0) icons += ANIMALS[t].emoji + (c > 1 ? c : '') + ' ';
  }

  item.innerHTML = `
    <span class="rank">#${rank}</span>
    <span class="name">${escapeHtml(p.name)}</span>
    <span class="herd-icons">${icons}</span>
    <span class="value">${p.herdValue}</span>
  `;
  return item;
}

function updatePhaseStatus() {
  const el = document.getElementById('phase-status-content');
  const counts = state.submissionCounts || {};
  const total = state.playerCount || 0;

  if (state.phase === 'phaseA') {
    const count = counts.phaseA || 0;
    el.innerHTML = `
      <h3>Phase A: Acquire Animals</h3>
      <div class="submission-counter">Decisions: ${count}/${total} ✓</div>
      <div id="pending-players" style="display:none;font-size:0.85rem;color:var(--orange);margin-top:0.3rem;"></div>
      <div class="phase-detail" id="phaseA-detail"></div>
    `;
  } else if (state.phase === 'phaseC') {
    const count = counts.phaseC || 0;
    el.innerHTML = `
      <h3>Phase C: Tribute</h3>
      <div class="submission-counter">Tributes: ${count}/${total} ✓</div>
      <div id="pending-players" style="display:none;font-size:0.85rem;color:var(--orange);margin-top:0.3rem;"></div>
      <div class="phase-detail" id="phaseC-detail"></div>
    `;
  } else if (state.phase === 'phaseD') {
    const count = counts.phaseD || 0;
    el.innerHTML = `
      <h3>Phase D: Punishment</h3>
      <div class="submission-counter">Punishments: ${count}/${total} ✓</div>
      <div id="pending-players" style="display:none;font-size:0.85rem;color:var(--orange);margin-top:0.3rem;"></div>
      <div class="phase-detail" id="phaseD-detail"></div>
    `;
  } else if (state.phase === 'phaseB') {
    el.innerHTML = `<h3>Phase B: Famine</h3><div class="submission-counter" style="color:var(--red);">Checking...</div>`;
  } else if (state.phase === 'roundResults') {
    el.innerHTML = `<h3>Round ${state.round} Results</h3>`;
  } else {
    el.innerHTML = '';
  }
}

// ─── Submission counts ────────────────────────────────────────────────────
socket.on('submission:count', ({ phase, count, total, pending }) => {
  if (state.submissionCounts) state.submissionCounts[phase] = count;
  const counterEl = document.querySelector('.submission-counter');
  if (counterEl) {
    const labels = { phaseA: 'Decisions', phaseC: 'Tributes', phaseD: 'Punishments' };
    counterEl.textContent = `${labels[phase] || ''}: ${count}/${total} ✓`;
  }
  // Show pending player names on dashboard
  if (pending && pending.length > 0) {
    const pendingEl = document.getElementById('pending-players');
    if (pendingEl) {
      pendingEl.textContent = `Waiting for: ${pending.join(', ')}`;
      pendingEl.style.display = 'block';
    }
  } else {
    const pendingEl = document.getElementById('pending-players');
    if (pendingEl) pendingEl.style.display = 'none';
  }
});

// ─── Phase Results ────────────────────────────────────────────────────────
socket.on('phaseA:resolved', (data) => {
  // Update pool
  if (data.pool) state.pool = data.pool;

  // Show acquisition bar chart
  const detail = document.getElementById('phaseA-detail');
  if (!detail) return;

  const entries = Object.values(data.acquisitionDetails)
    .sort((a, b) => b.acquiredValue - a.acquiredValue);
  const maxVal = Math.max(1, ...entries.map(e => e.acquiredValue));

  let html = `<p style="margin-bottom:0.5rem;">Total acquired: ${data.totalAcquiredValue} units</p>`;
  html += `<p style="font-size:0.8rem;color:var(--text-muted);">Pool: ${ANIMAL_TYPES.map(t => ANIMALS[t].emoji + data.pool[t]).join(' ')}</p>`;
  html += '<div class="bar-chart">';
  for (const e of entries.slice(0, 10)) {
    const w = (e.acquiredValue / maxVal * 100);
    html += `<div class="bar-row">
      <span class="bar-label">${escapeHtml(e.name)}</span>
      <div class="bar" style="width:${w}%"></div>
      <span class="bar-value">${e.acquiredValue}</span>
    </div>`;
  }
  html += '</div>';
  detail.innerHTML = html;
});

socket.on('phaseB:result', (data) => {
  if (data.famine) {
    state.famineCount = data.famineCount;
    state.pastureCapacity = data.pastureCapacity;
    state.totalHerdValue = data.totalHerdValue;
    updatePastureMeter();
    updateFamineCounter();
  }
});

socket.on('phaseC:resolved', (data) => {
  state.pastureCapacity = data.pastureCapacity;
  updatePastureMeter();

  const detail = document.getElementById('phaseC-detail');
  if (!detail) return;

  const bd = data.tributeBreakdown;
  let parts = [];
  for (const t of ANIMAL_TYPES) {
    if (bd[t] > 0) parts.push(`${bd[t]} ${ANIMALS[t].name.toLowerCase()}`);
  }
  detail.innerHTML = `<p>${parts.join(', ')} → pasture +${data.totalTributeValue}</p>`;
});

socket.on('phaseD:resolved', (data) => {
  const detail = document.getElementById('phaseD-detail');
  if (!detail) return;

  let html = `<p>${data.uniquePunishers} player${data.uniquePunishers === 1 ? '' : 's'} punished someone. ${data.uniqueTargets} player${data.uniqueTargets === 1 ? ' was' : 's were'} punished.</p>`;
  html += `<p>Total animals lost: ${data.totalAnimalsLost}</p>`;

  // Punishment bar chart
  if (data.punishmentResults && data.uniqueTargets > 0) {
    const targets = {};
    for (const [sid, r] of Object.entries(data.punishmentResults)) {
      if (r.wasTarget && r.punishedBy > 0) {
        const name = state.players?.[sid]?.name || '???';
        targets[sid] = { name: data.punishmentAnonymous ? `Player ${Object.keys(targets).length + 1}` : escapeHtml(name), count: r.punishedBy };
      }
    }
    const targetList = Object.values(targets).sort((a, b) => b.count - a.count);
    const maxP = Math.max(1, ...targetList.map(t => t.count));

    html += '<div class="bar-chart">';
    for (const t of targetList) {
      const w = (t.count / maxP * 100);
      html += `<div class="bar-row">
        <span class="bar-label">${t.name}</span>
        <div class="bar punishment" style="width:${w}%"></div>
        <span class="bar-value">${t.count}</span>
      </div>`;
    }
    html += '</div>';
  }

  detail.innerHTML = html;
});

// ─── Chart.js ─────────────────────────────────────────────────────────────
function updateChart() {
  const history = state.history || [];
  if (history.length === 0) return;

  const canvas = document.getElementById('pasture-chart');
  const ctx = canvas.getContext('2d');

  const labels = history.map(h => `R${h.round}`);
  const capacityData = history.map(h => h.pastureCapacity);
  const herdData = history.map(h => h.totalHerdValue);

  if (pastureChart) {
    pastureChart.data.labels = labels;
    pastureChart.data.datasets[0].data = capacityData;
    pastureChart.data.datasets[1].data = herdData;
    pastureChart.update();
    return;
  }

  if (typeof Chart === 'undefined') return;

  pastureChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pasture capacity',
          data: capacityData,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76,175,80,0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        },
        {
          label: 'Total herd value',
          data: herdData,
          borderColor: '#FF9800',
          backgroundColor: 'rgba(255,152,0,0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// ─── Game Over ────────────────────────────────────────────────────────────
socket.on('game:over', (data) => {
  if (data.gameNumber === 1) {
    // Show between-games comparison
    showScreen('dash-comparison');
    renderComparison(data);
  } else {
    // Final comparison of both games
    showScreen('dash-comparison');
    renderFinalComparison(data);
    // Clear dashboard session — game is fully over
    try { localStorage.removeItem('pasture_dashboard'); } catch(e) {}
  }
});

socket.on('game:betweenGames', (data) => {
  showScreen('dash-comparison');
  renderComparison(data.game1Results || data);
});

function renderComparison(g1) {
  const container = document.getElementById('comparison-content');

  let html = `
    <div class="comparison-card" style="grid-column: 1 / -1; text-align:center;">
      <h3>Game 1 — No Communication — Completed</h3>
      <div class="stat-highlight" style="color:var(--brown);">Results</div>
    </div>
    <div class="comparison-card">
      <h3>Statistics</h3>
      <div class="stat-row"><span class="label">Rounds played</span><span class="value">${g1.roundsSurvived}</span></div>
      <div class="stat-row"><span class="label">Famines</span><span class="value">${g1.faminesOccurred}</span></div>
      <div class="stat-row"><span class="label">Average herd value</span><span class="value">${g1.avgHerdValue}</span></div>
      <div class="stat-row"><span class="label">Gini coefficient</span><span class="value">${g1.gini}</span></div>
      <div class="stat-row"><span class="label">Total punishments</span><span class="value">${g1.totalPunishments}</span></div>
    </div>
    <div class="comparison-card">
      <h3>Scoreboard</h3>
  `;

  for (const s of (g1.scores || []).slice(0, 10)) {
    let icons = '';
    for (const t of ANIMAL_TYPES) {
      if (s.herd[t] > 0) icons += ANIMALS[t].emoji + s.herd[t] + ' ';
    }
    html += `<div class="stat-row"><span class="label">#${s.rank} ${escapeHtml(s.name)}</span><span class="value">${icons} = ${s.score}</span></div>`;
  }

  html += `</div>
    <div class="comparison-card" style="grid-column: 1 / -1; text-align:center;">
      <button id="reset-game2-btn" class="btn btn-primary" style="font-size:1.3rem;padding:1rem 3rem;">
        Reset — Start Game 2 — With Communication
      </button>
    </div>
  `;

  container.innerHTML = html;
  document.getElementById('reset-game2-btn').addEventListener('click', () => {
    socket.emit('instructor:resetGame2');
  });
}

function renderFinalComparison(g2) {
  const g1 = g2.game1Results || state.game1Results;
  const container = document.getElementById('comparison-content');

  if (!g1) {
    container.innerHTML = '<h2>Game Over</h2>';
    return;
  }

  let html = `
    <div class="comparison-card" style="grid-column: 1 / -1; text-align:center;">
      <h3>Comparison: Game 1 vs Game 2</h3>
    </div>
    <div class="comparison-card">
      <h3>Game 1 — No Communication</h3>
      <div class="stat-row"><span class="label">Rounds</span><span class="value">${g1.roundsSurvived}</span></div>
      <div class="stat-row"><span class="label">Famines</span><span class="value">${g1.faminesOccurred}</span></div>
      <div class="stat-row"><span class="label">Average herd value</span><span class="value">${g1.avgHerdValue}</span></div>
      <div class="stat-row"><span class="label">Gini coefficient (inequality)</span><span class="value">${g1.gini}</span></div>
      <div class="stat-row"><span class="label">Total punishments</span><span class="value">${g1.totalPunishments}</span></div>
    </div>
    <div class="comparison-card">
      <h3>Game 2 — With Communication</h3>
      <div class="stat-row"><span class="label">Rounds</span><span class="value">${g2.roundsSurvived}</span></div>
      <div class="stat-row"><span class="label">Famines</span><span class="value">${g2.faminesOccurred}</span></div>
      <div class="stat-row"><span class="label">Average herd value</span><span class="value">${g2.avgHerdValue}</span></div>
      <div class="stat-row"><span class="label">Gini coefficient (inequality)</span><span class="value">${g2.gini}</span></div>
      <div class="stat-row"><span class="label">Total punishments</span><span class="value">${g2.totalPunishments}</span></div>
    </div>
  `;

  // Highlight key differences
  const betterFamine = g2.faminesOccurred < g1.faminesOccurred;
  const betterGini = g2.gini < g1.gini;
  const betterAvg = g2.avgHerdValue > g1.avgHerdValue;

  html += `<div class="comparison-card" style="grid-column: 1 / -1;">
    <h3>Conclusions</h3>
    <div class="stat-row"><span class="label">Fewer famines with communication?</span><span class="value">${betterFamine ? '✅ Yes' : '❌ No'}</span></div>
    <div class="stat-row"><span class="label">Less inequality with communication?</span><span class="value">${betterGini ? '✅ Yes' : '❌ No'}</span></div>
    <div class="stat-row"><span class="label">Higher average herd value?</span><span class="value">${betterAvg ? '✅ Yes' : '❌ No'}</span></div>
  </div>`;

  // Combined scoreboard
  html += `<div class="comparison-card"><h3>Game 1 — Top 10</h3>`;
  for (const s of (g1.scores || []).slice(0, 10)) {
    html += `<div class="stat-row"><span class="label">#${s.rank} ${escapeHtml(s.name)}</span><span class="value">${s.score}</span></div>`;
  }
  html += `</div><div class="comparison-card"><h3>Game 2 — Top 10</h3>`;
  for (const s of (g2.scores || []).slice(0, 10)) {
    html += `<div class="stat-row"><span class="label">#${s.rank} ${escapeHtml(s.name)}</span><span class="value">${s.score}</span></div>`;
  }
  html += `</div>`;

  container.innerHTML = html;
}

// ─── Round Results ────────────────────────────────────────────────────────
socket.on('round:results', (data) => {
  state.history = data.history;
  state.pastureCapacity = data.pastureCapacity;
  state.totalHerdValue = data.totalHerdValue;
  state.famineCount = data.famineCount;
  updateDashboard();
});

// ─── Game Reset ───────────────────────────────────────────────────────────
socket.on('game:reset', (data) => {
  state = {};
  if (pastureChart) {
    pastureChart.destroy();
    pastureChart = null;
  }
  showScreen('dash-lobby');
  document.getElementById('lobby-title').textContent = 'Game 2 — With Communication';
  startBtn.textContent = 'Start Game 2 — With Communication';
  // Hide round config in Game 2 (same settings as Game 1)
  const roundConfig = document.getElementById('round-config');
  if (roundConfig) roundConfig.style.display = 'none';
  // Update timer button active state for Game 2
  if (data.timerDuration) {
    document.querySelectorAll('.timer-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.duration) === data.timerDuration);
    });
  }
});

// ─── Controls Panel ───────────────────────────────────────────────────────
document.getElementById('controls-toggle').addEventListener('click', () => {
  controlsVisible = !controlsVisible;
  document.getElementById('controls-panel').classList.toggle('visible', controlsVisible);
});

document.getElementById('ctrl-pause').addEventListener('click', () => {
  socket.emit('instructor:pause');
  document.getElementById('ctrl-pause').classList.add('hidden');
  document.getElementById('ctrl-resume').classList.remove('hidden');
});

document.getElementById('ctrl-resume').addEventListener('click', () => {
  socket.emit('instructor:resume');
  document.getElementById('ctrl-resume').classList.add('hidden');
  document.getElementById('ctrl-pause').classList.remove('hidden');
});

document.getElementById('ctrl-skip').addEventListener('click', () => {
  socket.emit('instructor:skipPhase');
});

document.getElementById('ctrl-end').addEventListener('click', () => {
  if (confirm('Are you sure you want to end the game?')) {
    socket.emit('instructor:endGame');
  }
});

document.getElementById('ctrl-reset-game2').addEventListener('click', () => {
  socket.emit('instructor:resetGame2');
});

// Timer controls
document.querySelectorAll('.timer-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dur = parseInt(btn.dataset.duration);
    socket.emit('instructor:setTimer', { duration: dur });
    document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('ctrl-toggle-anon').addEventListener('click', () => {
  socket.emit('instructor:togglePunishmentAnonymity');
});

// ─── Next Phase Button ────────────────────────────────────────────────────
const nextPhaseBtn = document.getElementById('next-phase-btn');

nextPhaseBtn.addEventListener('click', () => {
  socket.emit('instructor:nextPhase');
  nextPhaseBtn.classList.add('hidden');
});

socket.on('phase:waitingForNext', ({ nextPhase }) => {
  const labels = {
    phaseB: '▶ Next — Check Pasture',
    phaseC: '▶ Next — Tribute',
    phaseD: '▶ Next — Punishment',
    roundResults: '▶ Next — Round Results',
    nextRound: '▶ Next — Next Round',
    gameOver: '▶ Next — End Game'
  };
  nextPhaseBtn.textContent = labels[nextPhase] || '▶ Next';
  nextPhaseBtn.classList.remove('hidden');
});
