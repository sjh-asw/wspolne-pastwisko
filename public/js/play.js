/* ─── Student Game View ────────────────────────────────────────────────── */
const socket = io();

const ANIMALS = {
  rabbit: { name: 'Królik', emoji: '🐇', value: 1 },
  sheep:  { name: 'Owca',   emoji: '🐑', value: 2 },
  pig:    { name: 'Świnia', emoji: '🐷', value: 4 },
  cow:    { name: 'Krowa',  emoji: '🐄', value: 8 }
};
const ANIMAL_TYPES = ['rabbit', 'sheep', 'pig', 'cow'];

let state = {};
let myName = '';
let joined = false;
let selectedTribute = null;
let selectedPunishTarget = null;
let phaseASelections = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
let timerInterval = null;

// ─── DOM Elements ─────────────────────────────────────────────────────────
const screens = document.querySelectorAll('.screen');
const topBar = document.getElementById('top-bar');

function showScreen(id) {
  screens.forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  topBar.classList.toggle('hidden', id === 'lobby-screen' || id === 'gameover-screen');
}

// ─── Lobby ────────────────────────────────────────────────────────────────
document.getElementById('join-btn').addEventListener('click', () => {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  const name = document.getElementById('name-input').value.trim();
  const errorEl = document.getElementById('lobby-error');

  if (!code || code.length !== 4) { errorEl.textContent = 'Wpisz 4-znakowy kod pokoju.'; return; }
  if (!name) { errorEl.textContent = 'Wpisz swoją nazwę.'; return; }

  errorEl.textContent = '';
  document.getElementById('join-btn').disabled = true;

  socket.emit('room:join', { code, name }, (res) => {
    document.getElementById('join-btn').disabled = false;
    if (res.error) {
      errorEl.textContent = res.error;
      return;
    }
    myName = name;
    joined = true;
    document.getElementById('join-form').classList.add('hidden');
    document.getElementById('waiting-area').classList.remove('hidden');
  });
});

// Enter key submits
document.getElementById('name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('join-btn').click();
});
document.getElementById('room-code-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('name-input').focus();
});

// ─── Timer ────────────────────────────────────────────────────────────────
function startTimerDisplay(endsAt) {
  clearInterval(timerInterval);
  const timerEl = document.getElementById('timer');
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
}

// ─── Render Herd ──────────────────────────────────────────────────────────
function renderHerd(herd, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = '';
  for (const type of ANIMAL_TYPES) {
    const count = herd[type] || 0;
    if (count > 0) {
      html += `<div class="animal-group">
        <span class="animal-emoji">${ANIMALS[type].emoji}</span>
        <span class="animal-count">×${count}</span>
      </div>`;
    }
  }
  container.innerHTML = html || '<span style="color:var(--text-muted)">Brak zwierząt</span>';
}

function renderHerdValue(herd, elId) {
  const el = document.getElementById(elId);
  if (el) el.textContent = 'Wartość stada: ' + calcHerdValue(herd);
}

function calcHerdValue(herd) {
  let v = 0;
  for (const t of ANIMAL_TYPES) v += (herd[t] || 0) * ANIMALS[t].value;
  return v;
}

function calcHerdCount(herd) {
  let c = 0;
  for (const t of ANIMAL_TYPES) c += (herd[t] || 0);
  return c;
}

// ─── Pasture Bar ──────────────────────────────────────────────────────────
function updatePastureInfo() {
  const total = state.totalHerdValue || 0;
  const cap = state.pastureCapacity || 1;
  const pct = Math.min(100, (total / cap) * 100);

  document.getElementById('pasture-text').textContent = `Pastwisko: ${total} / ${cap}`;

  const fill = document.getElementById('pasture-fill');
  fill.style.width = pct + '%';
  fill.style.background = pct < 60 ? 'var(--green)' : pct < 80 ? 'var(--yellow)' : pct < 95 ? 'var(--orange)' : 'var(--red)';
}

// ─── Phase A: Acquire ─────────────────────────────────────────────────────
function showPhaseA() {
  showScreen('phaseA-screen');
  phaseASelections = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  document.getElementById('phaseA-submitted').classList.add('hidden');
  document.getElementById('phaseA-form').classList.remove('hidden');

  renderHerd(state.herd, 'phaseA-herd');
  renderHerdValue(state.herd, 'phaseA-herd-value');

  const maxAcq = state.maxAcquisition || 2;
  document.getElementById('budget-display').textContent = `Twój limit: ${maxAcq} jednostek`;

  renderAcquireRows(maxAcq);
  updateAcquireTotal(maxAcq);
}

function renderAcquireRows(maxAcq) {
  const container = document.getElementById('acquire-rows');
  container.innerHTML = '';

  for (const type of ANIMAL_TYPES) {
    const animal = ANIMALS[type];
    const poolCount = state.pool[type] || 0;
    const maxAffordable = Math.floor(maxAcq / animal.value);
    const maxAvailable = Math.min(poolCount, maxAffordable);
    const disabled = poolCount === 0 || animal.value > maxAcq;

    const row = document.createElement('div');
    row.className = 'acquire-row' + (disabled ? ' disabled' : '');
    row.innerHTML = `
      <div class="acquire-animal">
        <span class="emoji">${animal.emoji}</span>
        <div class="info">
          <div class="name">${animal.name} (${animal.value})</div>
          <div class="pool-count">W puli: ${poolCount}</div>
        </div>
      </div>
      <div class="acquire-controls">
        <button class="minus-btn" data-type="${type}">−</button>
        <span class="qty" id="qty-${type}">0</span>
        <button class="plus-btn" data-type="${type}">+</button>
      </div>
    `;
    container.appendChild(row);
  }

  // Event listeners
  container.querySelectorAll('.minus-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (phaseASelections[type] > 0) {
        phaseASelections[type]--;
        document.getElementById('qty-' + type).textContent = phaseASelections[type];
        updateAcquireTotal(maxAcq);
      }
    });
  });

  container.querySelectorAll('.plus-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const animal = ANIMALS[type];
      const currentTotal = ANIMAL_TYPES.reduce((s, t) => s + phaseASelections[t] * ANIMALS[t].value, 0);
      const poolCount = state.pool[type] || 0;

      if (currentTotal + animal.value <= maxAcq && phaseASelections[type] < poolCount) {
        phaseASelections[type]++;
        document.getElementById('qty-' + type).textContent = phaseASelections[type];
        updateAcquireTotal(maxAcq);
      }
    });
  });
}

function updateAcquireTotal(maxAcq) {
  const total = ANIMAL_TYPES.reduce((s, t) => s + phaseASelections[t] * ANIMALS[t].value, 0);
  document.getElementById('selected-total').textContent = `Wybrano: ${total} / ${maxAcq} jednostek`;

  // Disable plus buttons that would exceed budget or pool
  for (const type of ANIMAL_TYPES) {
    const plusBtn = document.querySelector(`.plus-btn[data-type="${type}"]`);
    const minusBtn = document.querySelector(`.minus-btn[data-type="${type}"]`);
    if (plusBtn) {
      const canAdd = total + ANIMALS[type].value <= maxAcq && phaseASelections[type] < (state.pool[type] || 0);
      plusBtn.disabled = !canAdd;
    }
    if (minusBtn) {
      minusBtn.disabled = phaseASelections[type] <= 0;
    }
  }
}

document.getElementById('phaseA-confirm').addEventListener('click', () => {
  socket.emit('phaseA:submit', phaseASelections);
  document.getElementById('phaseA-form').classList.add('hidden');
  document.getElementById('phaseA-submitted').classList.remove('hidden');
});

// ─── Phase C: Tribute ─────────────────────────────────────────────────────
function showPhaseC() {
  showScreen('phaseC-screen');
  selectedTribute = null;
  document.getElementById('phaseC-submitted').classList.add('hidden');

  const herd = state.herd;
  const count = calcHerdCount(herd);

  if (count <= 1) {
    document.getElementById('phaseC-form').classList.add('hidden');
    document.getElementById('phaseC-exempt').classList.remove('hidden');
    // Auto-submit
    socket.emit('phaseC:submit', { type: null });
    return;
  }

  document.getElementById('phaseC-form').classList.remove('hidden');
  document.getElementById('phaseC-exempt').classList.add('hidden');

  renderHerd(herd, 'phaseC-herd');

  const container = document.getElementById('tribute-animals');
  container.innerHTML = '';

  for (const type of ANIMAL_TYPES) {
    if (herd[type] > 0) {
      const btn = document.createElement('button');
      btn.className = 'tribute-btn';
      btn.dataset.type = type;
      btn.innerHTML = `
        <span><span class="emoji">${ANIMALS[type].emoji}</span> ${ANIMALS[type].name} ×${herd[type]}</span>
        <span class="value">wartość: ${ANIMALS[type].value}</span>
      `;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tribute-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTribute = type;
        document.getElementById('phaseC-confirm').disabled = false;
      });
      container.appendChild(btn);
    }
  }

  document.getElementById('phaseC-confirm').disabled = true;
}

document.getElementById('phaseC-confirm').addEventListener('click', () => {
  if (!selectedTribute) return;
  socket.emit('phaseC:submit', { type: selectedTribute });
  document.getElementById('phaseC-form').classList.add('hidden');
  document.getElementById('phaseC-submitted').classList.remove('hidden');
});

// ─── Phase D: Punishment ──────────────────────────────────────────────────
function showPhaseD() {
  showScreen('phaseD-screen');
  selectedPunishTarget = null;
  document.getElementById('phaseD-submitted').classList.add('hidden');

  const herd = state.herd;
  const count = calcHerdCount(herd);

  if (count <= 1) {
    document.getElementById('phaseD-form').classList.add('hidden');
    document.getElementById('phaseD-exempt').classList.remove('hidden');
    socket.emit('phaseD:submit', { target: null });
    return;
  }

  document.getElementById('phaseD-form').classList.remove('hidden');
  document.getElementById('phaseD-exempt').classList.add('hidden');

  const list = document.getElementById('punishment-player-list');
  list.innerHTML = '';

  const others = state.otherPlayers || [];
  others.sort((a, b) => b.herdValue - a.herdValue);

  for (const p of others) {
    const item = document.createElement('div');
    item.className = 'player-list-item';
    item.dataset.id = p.id;
    item.innerHTML = `
      <span class="player-name">${p.name}</span>
      <span class="player-herd-val">wartość: ${p.herdValue}</span>
    `;
    item.addEventListener('click', () => {
      list.querySelectorAll('.player-list-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedPunishTarget = p.id;
      document.getElementById('punish-btn').disabled = false;
      document.getElementById('punish-btn').textContent = `Karzę: ${p.name}`;
    });
    list.appendChild(item);
  }

  document.getElementById('punish-btn').disabled = true;
  document.getElementById('punish-btn').textContent = 'Karzę: ...';
}

document.getElementById('punish-btn').addEventListener('click', () => {
  socket.emit('phaseD:submit', { target: selectedPunishTarget });
  document.getElementById('phaseD-form').classList.add('hidden');
  document.getElementById('phaseD-submitted').classList.remove('hidden');
});

document.getElementById('no-punish-btn').addEventListener('click', () => {
  socket.emit('phaseD:submit', { target: null });
  document.getElementById('phaseD-form').classList.add('hidden');
  document.getElementById('phaseD-submitted').classList.remove('hidden');
});

// ─── Socket Events ────────────────────────────────────────────────────────
socket.on('game:state', (s) => {
  state = s;
  updateTopBar();
  updatePastureInfo();

  if (s.phase === 'phaseA') showPhaseA();
  else if (s.phase === 'phaseC') showPhaseC();
  else if (s.phase === 'phaseD') showPhaseD();
  else if (s.phase === 'roundResults') showRoundResults();
  else if (s.phase === 'gameOver' || s.phase === 'betweenGames') { /* handled by game:over */ }
});

socket.on('game:started', () => {
  // Game starting, wait for state
});

socket.on('timer:start', ({ duration, endsAt }) => {
  startTimerDisplay(endsAt);
});

socket.on('submission:count', ({ phase, count, total }) => {
  const el = document.getElementById('waiting-count');
  if (el) el.textContent = `${count}/${total} ✓`;
  // Update various waiting displays
  document.querySelectorAll('.waiting-count').forEach(el => {
    el.textContent = `${count}/${total} ✓`;
  });
});

socket.on('phaseA:result', (data) => {
  state.herd = data.herd;
  state.herdValue = data.herdValue;

  // Show what was acquired
  const acquired = data.acquired;
  let msg = 'Otrzymałeś: ';
  const parts = [];
  for (const t of ANIMAL_TYPES) {
    if (acquired[t] > 0) parts.push(`${ANIMALS[t].emoji}×${acquired[t]}`);
  }
  msg += parts.length > 0 ? parts.join(', ') : 'nic';

  const el = document.getElementById('phaseA-result-text');
  if (el) el.textContent = msg;
});

socket.on('phaseB:result', (data) => {
  if (data.famine) {
    showScreen('famine-screen');
    const el = document.getElementById('famine-screen');
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);

    state.herd = data.herd;
    state.herdValue = data.herdValue;
    state.pastureCapacity = data.pastureCapacity;

    // Show losses
    const losses = data.losses;
    const lossList = document.getElementById('famine-losses');
    let html = '';
    for (const t of ANIMAL_TYPES) {
      if (losses[t] > 0) html += `<div class="losses-item">${ANIMALS[t].emoji} ${ANIMALS[t].name} ×${losses[t]}</div>`;
    }
    lossList.innerHTML = html || '<div class="losses-item">Nic nie straciłeś</div>';

    renderHerd(state.herd, 'famine-remaining-herd');
    document.getElementById('famine-remaining-value').textContent = 'Pozostaje ci: ' + data.herdValue;
    document.getElementById('famine-pasture').textContent = 'Nowa pojemność pastwiska: ' + data.pastureCapacity;

    if (data.eliminated) {
      document.getElementById('famine-eliminated').classList.remove('hidden');
    } else {
      document.getElementById('famine-eliminated').classList.add('hidden');
    }

    updatePastureInfo();
  }
  // If no famine, server will move to Phase C automatically
});

socket.on('phaseC:result', (data) => {
  state.herd = data.herd;
  state.herdValue = data.herdValue;
});

socket.on('phaseC:complete', (data) => {
  state.pastureCapacity = data.pastureCapacity;
  updatePastureInfo();
});

socket.on('phaseD:result', (data) => {
  state.herd = data.herd;
  state.herdValue = data.herdValue;

  showScreen('phaseD-result-screen');

  let html = '';
  if (data.wasTarget && data.punishedBy > 0) {
    html += `<div class="punishment-result was-punished">
      <p>Ukarało cię <strong>${data.punishedBy}</strong> ${data.punishedBy === 1 ? 'gracz' : 'graczy'}.</p>
      <p>Straciłeś: ${data.lostFromPunishment.map(t => ANIMALS[t].emoji).join(' ')}</p>
    </div>`;
  } else {
    html += `<div class="punishment-result"><p>Nikt cię nie ukarał.</p></div>`;
  }

  if (data.punished) {
    html += `<div class="punishment-result">
      <p>Ukarałeś: <strong>${data.punished}</strong></p>
      ${data.lost ? `<p>Koszt kary: ${ANIMALS[data.lost].emoji}</p>` : ''}
    </div>`;
  }

  html += `<div style="margin-top:1rem;">`;
  renderHerdInline(data.herd, 'phaseD-result-herd');
  html += `</div>`;

  document.getElementById('phaseD-result-content').innerHTML = html;
  renderHerd(data.herd, 'phaseD-result-herd');
  document.getElementById('phaseD-result-value').textContent = 'Wartość stada: ' + data.herdValue;
});

function renderHerdInline(herd, containerId) {
  // Will be called after innerHTML is set
}

socket.on('round:results', (data) => {
  state.pastureCapacity = data.pastureCapacity;
  state.totalHerdValue = data.totalHerdValue;
  updatePastureInfo();
  showRoundResults();
});

function showRoundResults() {
  showScreen('round-results-screen');
  renderHerd(state.herd, 'round-result-herd');
  document.getElementById('round-result-value').textContent = 'Wartość stada: ' + calcHerdValue(state.herd);
  document.getElementById('round-result-pasture').textContent =
    `Pojemność pastwiska: ${state.pastureCapacity}`;
  document.getElementById('round-result-round').textContent =
    `Koniec rundy ${state.round}`;
}

socket.on('game:over', (data) => {
  showScreen('gameover-screen');
  document.getElementById('gameover-score').textContent = data.yourScore + ' pkt';
  document.getElementById('gameover-rank').textContent = `Miejsce ${data.yourRank} z ${data.scores.length}`;

  const sb = document.getElementById('gameover-scoreboard');
  sb.innerHTML = '';
  for (const s of data.scores) {
    const item = document.createElement('div');
    item.className = 'scoreboard-item' + (s.name === myName ? ' you' : '');
    item.innerHTML = `
      <span class="rank">#${s.rank}</span>
      <span class="name">${s.name}</span>
      <span class="score">${s.score} pkt</span>
    `;
    sb.appendChild(item);
  }

  if (data.gameNumber === 1) {
    document.getElementById('gameover-waiting-game2').classList.remove('hidden');
  } else {
    document.getElementById('gameover-waiting-game2').classList.add('hidden');
  }
});

socket.on('game:reset', (data) => {
  state = {};
  showScreen('lobby-screen');
  document.getElementById('join-form').classList.add('hidden');
  document.getElementById('waiting-area').classList.remove('hidden');
  document.getElementById('waiting-msg').textContent = `Gra 2 — Z komunikacją. Oczekiwanie na rozpoczęcie...`;
});

socket.on('game:paused', () => {
  // Could show a pause overlay
});

socket.on('game:resumed', () => {
  // Could hide pause overlay
});

socket.on('kicked', () => {
  alert('Zostałeś usunięty z gry.');
  window.location.href = '/';
});

function updateTopBar() {
  const roundEl = document.getElementById('round-display');
  const phaseEl = document.getElementById('phase-display');
  const pastureEl = document.getElementById('topbar-pasture');
  const herdValEl = document.getElementById('topbar-herd-value');

  if (roundEl) roundEl.textContent = `Runda ${state.round || 0} z 5`;

  const phaseNames = {
    phaseA: 'Faza A: Dobranie zwierząt',
    phaseB: 'Faza B: Klęska głodu',
    phaseC: 'Faza C: Danina',
    phaseD: 'Faza D: Porachunki',
    roundResults: 'Wyniki rundy'
  };
  if (phaseEl) phaseEl.textContent = phaseNames[state.phase] || '';
  if (pastureEl) pastureEl.textContent = `🌿 ${state.pastureCapacity || 0}`;
  if (herdValEl) herdValEl.textContent = `🐾 ${calcHerdValue(state.herd || {})}`;
}

// ─── Player count updates in lobby ────────────────────────────────────────
socket.on('player:joined', (data) => {
  const el = document.getElementById('lobby-player-count');
  if (el) el.textContent = data.playerCount;
});
