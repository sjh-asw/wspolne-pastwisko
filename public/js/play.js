/* ─── Student Game View ────────────────────────────────────────────────── */
const socket = io(window.location.origin, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 20,
  transports: ['websocket', 'polling']
});

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
let pendingSubmit = null; // { event, data } — retry on reconnect

// HTML escape to prevent XSS from player names
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Polish grammar helper for "jednostka"
function jednostki(n) {
  if (n === 1) return 'jednostka';
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return 'jednostek';
  if (lastOne >= 2 && lastOne <= 4) return 'jednostki';
  return 'jednostek';
}

// ─── Reliable Submit ──────────────────────────────────────────────────────
function reliableEmit(event, data, onSuccess) {
  pendingSubmit = { event, data };
  socket.emit(event, data, (res) => {
    if (res && res.ok) {
      pendingSubmit = null;
      if (onSuccess) onSuccess(res);
    } else if (res && res.error) {
      // Server rejected — show error briefly, allow retry
      pendingSubmit = null;
    }
    // If no callback received (timeout), pendingSubmit stays for reconnect retry
  });
  // If no ack in 5s, show a warning
  setTimeout(() => {
    if (pendingSubmit && pendingSubmit.event === event) {
      showConnectionWarning(true);
    }
  }, 5000);
}

function showConnectionWarning(show) {
  let el = document.getElementById('connection-warning');
  if (!el) {
    el = document.createElement('div');
    el.id = 'connection-warning';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--red);color:#fff;text-align:center;padding:0.5rem;font-size:0.9rem;z-index:200;';
    el.textContent = 'Problem z połączeniem — próbuję ponownie...';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'block' : 'none';
}

socket.on('connect', () => {
  showConnectionWarning(false);

  // Determine reconnect credentials: either from in-memory state or localStorage (page refresh)
  let reconnectCode = null;
  let reconnectName = null;

  if (joined && myName) {
    reconnectCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    reconnectName = myName;
  } else {
    // Page refresh recovery: check localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('pastwisko_session'));
      if (saved && saved.code && saved.name) {
        reconnectCode = saved.code;
        reconnectName = saved.name;
      }
    } catch(e) {}
  }

  if (reconnectCode && reconnectName) {
    socket.emit('room:join', { code: reconnectCode, name: reconnectName }, (res) => {
      if (res && res.error) {
        // Room no longer exists or name conflict — clear saved session
        try { localStorage.removeItem('pastwisko_session'); } catch(e) {}
        joined = false;
        myName = '';
        showScreen('lobby-screen');
        document.getElementById('join-form').classList.remove('hidden');
        document.getElementById('waiting-area').classList.add('hidden');
        return;
      }
      if (res && (res.success || res.reconnected)) {
        // Recover in-memory state
        myName = reconnectName;
        joined = true;
        document.getElementById('room-code-input').value = reconnectCode;
        document.getElementById('join-form').classList.add('hidden');
        document.getElementById('waiting-area').classList.remove('hidden');
      }
      // Retry pending submission if server hasn't recorded it yet
      if (pendingSubmit && state.hasSubmitted) {
        const phase = pendingSubmit.event.split(':')[0];
        if (state.hasSubmitted[phase]) {
          pendingSubmit = null;
          return;
        }
      }
      if (pendingSubmit) {
        const { event, data } = pendingSubmit;
        socket.emit(event, data, (ackRes) => {
          if (ackRes && ackRes.ok) {
            pendingSubmit = null;
            showConnectionWarning(false);
          }
        });
      }
    });
  }
});

socket.on('disconnect', () => {
  showConnectionWarning(true);
});

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
    // Save for page refresh recovery
    try { localStorage.setItem('pastwisko_session', JSON.stringify({ code, name })); } catch(e) {}
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

// ─── Waiting Screen (for phases without player input, e.g. phaseB) ───────
function showPhaseWaiting(msg) {
  showScreen('round-results-screen');
  document.getElementById('round-result-round').textContent = msg || 'Oczekiwanie...';
  document.getElementById('round-result-herd').innerHTML = '';
  document.getElementById('round-result-value').textContent = '';
  document.getElementById('round-result-pasture').textContent = '';
}

// ─── Phase A: Acquire ─────────────────────────────────────────────────────
function showPhaseA() {
  showScreen('phaseA-screen');

  // If server already has our submission (e.g. after reconnect), show submitted screen
  if (state.hasSubmitted && state.hasSubmitted.phaseA) {
    document.getElementById('phaseA-form').classList.add('hidden');
    document.getElementById('phaseA-submitted').classList.remove('hidden');
    return;
  }

  phaseASelections = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  document.getElementById('phaseA-submitted').classList.add('hidden');
  document.getElementById('phaseA-form').classList.remove('hidden');
  document.getElementById('phaseA-confirm').disabled = false;

  renderHerd(state.herd, 'phaseA-herd');
  renderHerdValue(state.herd, 'phaseA-herd-value');

  const maxAcq = state.maxAcquisition || 2;
  document.getElementById('budget-display').textContent = `Twój limit: ${maxAcq} ${jednostki(maxAcq)}`;

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
  document.getElementById('selected-total').textContent = `Wybrano: ${total} / ${maxAcq} ${jednostki(maxAcq)}`;

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
  document.getElementById('phaseA-confirm').disabled = true;
  reliableEmit('phaseA:submit', phaseASelections, () => {
    document.getElementById('phaseA-form').classList.add('hidden');
    document.getElementById('phaseA-submitted').classList.remove('hidden');
  });
});

// ─── Phase C: Tribute ─────────────────────────────────────────────────────
function showPhaseC() {
  showScreen('phaseC-screen');

  // If server already has our submission (e.g. after reconnect), show submitted screen
  if (state.hasSubmitted && state.hasSubmitted.phaseC) {
    document.getElementById('phaseC-form').classList.add('hidden');
    document.getElementById('phaseC-exempt').classList.add('hidden');
    document.getElementById('phaseC-submitted').classList.remove('hidden');
    return;
  }

  selectedTribute = null;
  document.getElementById('phaseC-submitted').classList.add('hidden');

  const herd = state.herd;
  const count = calcHerdCount(herd);

  if (count <= 1) {
    document.getElementById('phaseC-form').classList.add('hidden');
    document.getElementById('phaseC-exempt').classList.remove('hidden');
    // Auto-submit (exempt)
    reliableEmit('phaseC:submit', { type: null });
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
  document.getElementById('phaseC-confirm').disabled = true;
  reliableEmit('phaseC:submit', { type: selectedTribute }, () => {
    document.getElementById('phaseC-form').classList.add('hidden');
    document.getElementById('phaseC-submitted').classList.remove('hidden');
  });
});

// ─── Phase D: Punishment ──────────────────────────────────────────────────
function showPhaseD() {
  showScreen('phaseD-screen');

  // If server already has our submission (e.g. after reconnect), show submitted screen
  if (state.hasSubmitted && state.hasSubmitted.phaseD) {
    document.getElementById('phaseD-form').classList.add('hidden');
    document.getElementById('phaseD-exempt').classList.add('hidden');
    document.getElementById('phaseD-submitted').classList.remove('hidden');
    return;
  }

  selectedPunishTarget = null;
  document.getElementById('phaseD-submitted').classList.add('hidden');
  document.getElementById('punish-btn').disabled = true;
  document.getElementById('no-punish-btn').disabled = false;

  const herd = state.herd;
  const count = calcHerdCount(herd);

  if (count <= 1) {
    document.getElementById('phaseD-form').classList.add('hidden');
    document.getElementById('phaseD-exempt').classList.remove('hidden');
    reliableEmit('phaseD:submit', { target: null });
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
      <span class="player-name">${escapeHtml(p.name)}</span>
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
  document.getElementById('punish-btn').disabled = true;
  document.getElementById('no-punish-btn').disabled = true;
  reliableEmit('phaseD:submit', { target: selectedPunishTarget }, () => {
    document.getElementById('phaseD-form').classList.add('hidden');
    document.getElementById('phaseD-submitted').classList.remove('hidden');
  });
});

document.getElementById('no-punish-btn').addEventListener('click', () => {
  document.getElementById('punish-btn').disabled = true;
  document.getElementById('no-punish-btn').disabled = true;
  reliableEmit('phaseD:submit', { target: null }, () => {
    document.getElementById('phaseD-form').classList.add('hidden');
    document.getElementById('phaseD-submitted').classList.remove('hidden');
  });
});

// ─── Socket Events ────────────────────────────────────────────────────────
socket.on('game:state', (s) => {
  state = s;
  updateTopBar();
  updatePastureInfo();

  // Clear pending submit if server already has our submission — and fix UI
  if (pendingSubmit && s.hasSubmitted) {
    const phase = pendingSubmit.event.split(':')[0];
    if (s.hasSubmitted[phase]) {
      pendingSubmit = null;
      // Force submitted UI in case the reliableEmit ack was lost
      if (phase === 'phaseA') {
        document.getElementById('phaseA-form').classList.add('hidden');
        document.getElementById('phaseA-submitted').classList.remove('hidden');
      } else if (phase === 'phaseC') {
        document.getElementById('phaseC-form').classList.add('hidden');
        document.getElementById('phaseC-exempt').classList.add('hidden');
        document.getElementById('phaseC-submitted').classList.remove('hidden');
      } else if (phase === 'phaseD') {
        document.getElementById('phaseD-form').classList.add('hidden');
        document.getElementById('phaseD-exempt').classList.add('hidden');
        document.getElementById('phaseD-submitted').classList.remove('hidden');
      }
    }
  }

  if (s.phase === 'phaseA') showPhaseA();
  else if (s.phase === 'phaseB') showPhaseWaiting('Sprawdzanie pastwiska...');
  else if (s.phase === 'waiting_for_instructor') showPhaseWaiting('Oczekiwanie na prowadzącego...');
  else if (s.phase === 'phaseC') showPhaseC();
  else if (s.phase === 'phaseD') showPhaseD();
  else if (s.phase === 'roundResults') showRoundResults();
  else if (s.phase === 'gameOver' || s.phase === 'betweenGames') {
    // Show a waiting screen if game:over event hasn't arrived yet
    showScreen('gameover-screen');
    document.getElementById('gameover-score').textContent = calcHerdValue(s.herd) + ' pkt';
    document.getElementById('gameover-rank').textContent = 'Oczekiwanie na wyniki...';
    document.getElementById('gameover-scoreboard').innerHTML = '';
    if (s.phase === 'betweenGames') {
      document.getElementById('gameover-waiting-game2').classList.remove('hidden');
    }
  }
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
    const names = (data.punisherNames || []).map(n => escapeHtml(n)).join(', ');
    html += `<div class="punishment-result was-punished">
      <p>⚡ Ukarał${data.punishedBy === 1 ? '' : 'o'} cię <strong>${data.punishedBy}</strong> ${data.punishedBy === 1 ? 'gracz' : 'graczy'}:</p>
      <p class="punisher-names">${names}</p>
      <p>Straciłeś: ${(() => {
        const counts = {};
        for (const t of data.lostFromPunishment) counts[t] = (counts[t] || 0) + 1;
        return Object.entries(counts).map(([t, c]) => ANIMALS[t].emoji + ' ' + ANIMALS[t].name + (c > 1 ? ' \u00d7' + c : '')).join(', ');
      })()}</p>
    </div>`;
  } else {
    html += `<div class="punishment-result safe"><p>✅ Nikt cię nie ukarał.</p></div>`;
  }

  if (data.punished) {
    html += `<div class="punishment-result gave-punishment">
      <p>🔨 Ukarałeś: <strong>${escapeHtml(data.punished)}</strong></p>
      ${data.lost ? `<p>Koszt kary: ${ANIMALS[data.lost].emoji} ${ANIMALS[data.lost].name}</p>` : ''}
    </div>`;
  } else {
    html += `<div class="punishment-result"><p>Nikogo nie ukarałeś.</p></div>`;
  }

  document.getElementById('phaseD-result-content').innerHTML = html;
  renderHerd(data.herd, 'phaseD-result-herd');
  document.getElementById('phaseD-result-value').textContent = 'Wartość stada: ' + data.herdValue;
});


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
      <span class="name">${escapeHtml(s.name)}</span>
      <span class="score">${s.score} pkt</span>
    `;
    sb.appendChild(item);
  }

  if (data.gameNumber === 1) {
    document.getElementById('gameover-waiting-game2').classList.remove('hidden');
  } else {
    document.getElementById('gameover-waiting-game2').classList.add('hidden');
    // Final game over — clear session
    try { localStorage.removeItem('pastwisko_session'); } catch(e) {}
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
  clearInterval(timerInterval);
  const timerEl = document.getElementById('timer');
  timerEl.textContent = '⏸';
  timerEl.classList.remove('warning', 'danger');

  // Show pause overlay
  let overlay = document.getElementById('pause-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pause-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:150;';
    overlay.innerHTML = '<div style="text-align:center;color:#fff;font-size:1.5rem;font-weight:700;"><div style="font-size:3rem;margin-bottom:0.5rem;">⏸</div>Gra wstrzymana</div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
});

socket.on('game:resumed', () => {
  const overlay = document.getElementById('pause-overlay');
  if (overlay) overlay.style.display = 'none';
});

socket.on('kicked', () => {
  try { localStorage.removeItem('pastwisko_session'); } catch(e) {}
  alert('Zostałeś usunięty z gry.');
  window.location.href = '/';
});

function updateTopBar() {
  const roundEl = document.getElementById('round-display');
  const phaseEl = document.getElementById('phase-display');
  const pastureEl = document.getElementById('topbar-pasture');
  const herdValEl = document.getElementById('topbar-herd-value');

  if (roundEl) {
    const mr = state.maxRounds;
    roundEl.textContent = mr > 0 ? `Runda ${state.round || 0} z ${mr}` : `Runda ${state.round || 0}`;
  }

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
