/* ─── Instructor Dashboard ─────────────────────────────────────────────── */
const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 20 });
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
  rabbit: { name: 'Królik', emoji: '🐇', value: 1 },
  sheep:  { name: 'Owca',   emoji: '🐑', value: 2 },
  pig:    { name: 'Świnia', emoji: '🐷', value: 4 },
  cow:    { name: 'Krowa',  emoji: '🐄', value: 8 }
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

// ─── QR Code + LAN URL ───────────────────────────────────────────────────
function updateLobbyUrl(code) {
  // Fetch LAN IP from server for proper network URL
  fetch('/api/network-info')
    .then(r => r.json())
    .then(info => {
      const playUrl = `${info.url}/play.html`;
      document.getElementById('room-url').textContent = `Wejdź na: ${playUrl}`;
      generateQR(playUrl);
    })
    .catch(() => {
      // Fallback to window.location if fetch fails
      const playUrl = `${window.location.origin}/play.html`;
      document.getElementById('room-url').textContent = `Wejdź na: ${playUrl}`;
      generateQR(playUrl);
    });
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
    const saved = JSON.parse(localStorage.getItem('pastwisko_dashboard'));
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
        localStorage.removeItem('pastwisko_dashboard');
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
    try { localStorage.setItem('pastwisko_dashboard', JSON.stringify({ code: res.code, token: res.token })); } catch(e) {}
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
        hint.textContent = 'Gra bez limitu rund — kończy się po 3 klęskach głodu';
      } else {
        hint.textContent = `Gra kończy się po ${rounds} rundach lub 2 klęskach głodu`;
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
  // Hide "Dalej" button when a new active phase starts
  document.getElementById('next-phase-btn').classList.add('hidden');
  if (s.phase === 'lobby' || s.phase === 'betweenGames') {
    showScreen('dash-lobby');
    if (s.gameNumber === 2) {
      document.getElementById('lobby-title').textContent = 'Gra 2 — Z komunikacją';
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
    `Gra ${state.gameNumber}: ${state.gameNumber === 1 ? 'Bez komunikacji' : 'Z komunikacją'}`;
  const phaseNames = {
    phaseA: 'Faza A: Dobranie zwierząt',
    phaseB: 'Faza B: Klęska głodu',
    phaseC: 'Faza C: Danina',
    phaseD: 'Faza D: Porachunki',
    roundResults: 'Wyniki rundy',
    gameOver: 'Gra zakończona'
  };
  const roundLabel = state.maxRounds > 0 ? `Runda ${state.round} z ${state.maxRounds}` : `Runda ${state.round} (∞)`;
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

  document.getElementById('pasture-occupancy').textContent = `Zajętość: ${total} / ${cap}`;

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
    document.getElementById('round-label').textContent = `Runda: ${round}/${maxRounds}`;
    let dots = '';
    const showDots = Math.min(maxRounds, 15); // cap visual dots at 15
    for (let i = 1; i <= showDots; i++) {
      dots += i <= round ? '🟩' : '⬜';
    }
    if (maxRounds > 15) dots += '…';
    document.getElementById('round-dots').textContent = dots;
  } else {
    document.getElementById('round-label').textContent = `Runda: ${round} (∞)`;
    document.getElementById('round-dots').textContent = '🟩'.repeat(Math.min(round, 20));
  }
}

function updateFamineCounter() {
  const count = state.famineCount || 0;
  const maxFamines = state.maxFamines || 2;
  document.getElementById('famine-label').textContent = `Klęski głodu: ${count}/${maxFamines}`;
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
    sep.textContent = `··· ${list.length - 8} więcej ···`;
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
      <h3>Faza A: Dobranie zwierząt</h3>
      <div class="submission-counter">Decyzje: ${count}/${total} ✓</div>
      <div id="pending-players" style="display:none;font-size:0.85rem;color:var(--orange);margin-top:0.3rem;"></div>
      <div class="phase-detail" id="phaseA-detail"></div>
    `;
  } else if (state.phase === 'phaseC') {
    const count = counts.phaseC || 0;
    el.innerHTML = `
      <h3>Faza C: Danina</h3>
      <div class="submission-counter">Daniny: ${count}/${total} ✓</div>
      <div id="pending-players" style="display:none;font-size:0.85rem;color:var(--orange);margin-top:0.3rem;"></div>
      <div class="phase-detail" id="phaseC-detail"></div>
    `;
  } else if (state.phase === 'phaseD') {
    const count = counts.phaseD || 0;
    el.innerHTML = `
      <h3>Faza D: Porachunki</h3>
      <div class="submission-counter">Porachunki: ${count}/${total} ✓</div>
      <div id="pending-players" style="display:none;font-size:0.85rem;color:var(--orange);margin-top:0.3rem;"></div>
      <div class="phase-detail" id="phaseD-detail"></div>
    `;
  } else if (state.phase === 'phaseB') {
    el.innerHTML = `<h3>Faza B: Klęska głodu</h3><div class="submission-counter" style="color:var(--red);">Sprawdzanie...</div>`;
  } else if (state.phase === 'roundResults') {
    el.innerHTML = `<h3>Wyniki rundy ${state.round}</h3>`;
  } else {
    el.innerHTML = '';
  }
}

// ─── Submission counts ────────────────────────────────────────────────────
socket.on('submission:count', ({ phase, count, total, pending }) => {
  if (state.submissionCounts) state.submissionCounts[phase] = count;
  const counterEl = document.querySelector('.submission-counter');
  if (counterEl) {
    const labels = { phaseA: 'Decyzje', phaseC: 'Daniny', phaseD: 'Porachunki' };
    counterEl.textContent = `${labels[phase] || ''}: ${count}/${total} ✓`;
  }
  // Show pending player names on dashboard
  if (pending && pending.length > 0) {
    const pendingEl = document.getElementById('pending-players');
    if (pendingEl) {
      pendingEl.textContent = `Czekamy na: ${pending.join(', ')}`;
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

  let html = `<p style="margin-bottom:0.5rem;">Łącznie pozyskano: ${data.totalAcquiredValue} jednostek</p>`;
  html += `<p style="font-size:0.8rem;color:var(--text-muted);">Pula: ${ANIMAL_TYPES.map(t => ANIMALS[t].emoji + data.pool[t]).join(' ')}</p>`;
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
  detail.innerHTML = `<p>${parts.join(', ')} → pastwisko +${data.totalTributeValue}</p>`;
});

socket.on('phaseD:resolved', (data) => {
  const detail = document.getElementById('phaseD-detail');
  if (!detail) return;

  let html = `<p>${data.uniquePunishers} graczy ukarało kogoś. ${data.uniqueTargets} osób było karanych.</p>`;
  html += `<p>Utracono łącznie: ${data.totalAnimalsLost} zwierząt</p>`;

  // Punishment bar chart
  if (data.punishmentResults && data.uniqueTargets > 0) {
    const targets = {};
    for (const [sid, r] of Object.entries(data.punishmentResults)) {
      if (r.wasTarget && r.punishedBy > 0) {
        const name = state.players?.[sid]?.name || '???';
        targets[sid] = { name: data.punishmentAnonymous ? `Gracz ${Object.keys(targets).length + 1}` : escapeHtml(name), count: r.punishedBy };
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
          label: 'Pojemność pastwiska',
          data: capacityData,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76,175,80,0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        },
        {
          label: 'Łączna wartość stad',
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
    try { localStorage.removeItem('pastwisko_dashboard'); } catch(e) {}
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
      <h3>Gra 1 — Bez komunikacji — Zakończona</h3>
      <div class="stat-highlight" style="color:var(--brown);">Wyniki</div>
    </div>
    <div class="comparison-card">
      <h3>Statystyki</h3>
      <div class="stat-row"><span class="label">Rundy rozegrane</span><span class="value">${g1.roundsSurvived}</span></div>
      <div class="stat-row"><span class="label">Klęski głodu</span><span class="value">${g1.faminesOccurred}</span></div>
      <div class="stat-row"><span class="label">Średnia wartość stada</span><span class="value">${g1.avgHerdValue}</span></div>
      <div class="stat-row"><span class="label">Współczynnik Giniego</span><span class="value">${g1.gini}</span></div>
      <div class="stat-row"><span class="label">Łączne kary</span><span class="value">${g1.totalPunishments}</span></div>
    </div>
    <div class="comparison-card">
      <h3>Tabela wyników</h3>
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
        Reset — Rozpocznij Grę 2 — Z komunikacją
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
    container.innerHTML = '<h2>Gra zakończona</h2>';
    return;
  }

  let html = `
    <div class="comparison-card" style="grid-column: 1 / -1; text-align:center;">
      <h3>Porównanie: Gra 1 vs Gra 2</h3>
    </div>
    <div class="comparison-card">
      <h3>Gra 1 — Bez komunikacji</h3>
      <div class="stat-row"><span class="label">Rundy</span><span class="value">${g1.roundsSurvived}</span></div>
      <div class="stat-row"><span class="label">Klęski głodu</span><span class="value">${g1.faminesOccurred}</span></div>
      <div class="stat-row"><span class="label">Średnia wartość stada</span><span class="value">${g1.avgHerdValue}</span></div>
      <div class="stat-row"><span class="label">Wsp. Giniego (nierówność)</span><span class="value">${g1.gini}</span></div>
      <div class="stat-row"><span class="label">Łączne kary</span><span class="value">${g1.totalPunishments}</span></div>
    </div>
    <div class="comparison-card">
      <h3>Gra 2 — Z komunikacją</h3>
      <div class="stat-row"><span class="label">Rundy</span><span class="value">${g2.roundsSurvived}</span></div>
      <div class="stat-row"><span class="label">Klęski głodu</span><span class="value">${g2.faminesOccurred}</span></div>
      <div class="stat-row"><span class="label">Średnia wartość stada</span><span class="value">${g2.avgHerdValue}</span></div>
      <div class="stat-row"><span class="label">Wsp. Giniego (nierówność)</span><span class="value">${g2.gini}</span></div>
      <div class="stat-row"><span class="label">Łączne kary</span><span class="value">${g2.totalPunishments}</span></div>
    </div>
  `;

  // Highlight key differences
  const betterFamine = g2.faminesOccurred < g1.faminesOccurred;
  const betterGini = g2.gini < g1.gini;
  const betterAvg = g2.avgHerdValue > g1.avgHerdValue;

  html += `<div class="comparison-card" style="grid-column: 1 / -1;">
    <h3>Wnioski</h3>
    <div class="stat-row"><span class="label">Mniej klęsk głodu z komunikacją?</span><span class="value">${betterFamine ? '✅ Tak' : '❌ Nie'}</span></div>
    <div class="stat-row"><span class="label">Mniejsza nierówność z komunikacją?</span><span class="value">${betterGini ? '✅ Tak' : '❌ Nie'}</span></div>
    <div class="stat-row"><span class="label">Wyższa średnia wartość stada?</span><span class="value">${betterAvg ? '✅ Tak' : '❌ Nie'}</span></div>
  </div>`;

  // Combined scoreboard
  html += `<div class="comparison-card"><h3>Gra 1 — Top 10</h3>`;
  for (const s of (g1.scores || []).slice(0, 10)) {
    html += `<div class="stat-row"><span class="label">#${s.rank} ${escapeHtml(s.name)}</span><span class="value">${s.score}</span></div>`;
  }
  html += `</div><div class="comparison-card"><h3>Gra 2 — Top 10</h3>`;
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
  document.getElementById('lobby-title').textContent = 'Gra 2 — Z komunikacją';
  startBtn.textContent = 'Rozpocznij Grę 2 — Z komunikacją';
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
  if (confirm('Czy na pewno chcesz zakończyć grę?')) {
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
    phaseB: '▶ Dalej — Sprawdzenie pastwiska',
    phaseC: '▶ Dalej — Danina',
    phaseD: '▶ Dalej — Porachunki',
    roundResults: '▶ Dalej — Wyniki rundy',
    nextRound: '▶ Dalej — Następna runda',
    gameOver: '▶ Dalej — Zakończ grę'
  };
  nextPhaseBtn.textContent = labels[nextPhase] || '▶ Dalej';
  nextPhaseBtn.classList.remove('hidden');
});
