const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
// Trust reverse proxy (Render, Heroku, etc.) for correct protocol/IP detection
app.set('trust proxy', 1);
const server = http.createServer(app);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || null; // Set to your domain in production, e.g. 'https://pasture.example.com'
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN || true,  // In production set ALLOWED_ORIGIN; default reflects request origin
    methods: ['GET', 'POST']
  },
  allowEIO3: true,  // Allow Engine.IO v3 clients (broader compatibility)
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket']  // Explicitly allow both transports behind reverse proxy
});

app.use(express.static(path.join(__dirname, 'public')));

// Health check for cloud platforms (Render, etc.)
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ─── LAN IP Detection ────────────────────────────────────────────────────────
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;

app.get('/api/network-info', (req, res) => {
  const port = PORT;
  const lanIP = getLanIP();
  const protocol = req.protocol; // 'https' behind reverse proxy (trust proxy), 'http' locally
  res.json({ lanIP, port, url: `${protocol}://${lanIP}:${port}` });
});

// ─── Game State ──────────────────────────────────────────────────────────────

const ANIMALS = {
  rabbit: { name: 'Rabbit', emoji: '🐇', value: 1 },
  sheep:  { name: 'Sheep',  emoji: '🐑', value: 2 },
  pig:    { name: 'Pig',    emoji: '🐷', value: 4 },
  cow:    { name: 'Cow',    emoji: '🐄', value: 8 }
};

const ANIMAL_TYPES = ['rabbit', 'sheep', 'pig', 'cow'];
const DEFAULT_MAX_ROUNDS = 5;
const DEFAULT_MAX_FAMINES = 2;
const INFINITY_MAX_FAMINES = 3; // for unlimited rounds mode
const MAX_ROOMS = 50;
const MAX_PLAYERS_PER_ROOM = 60;

// All active rooms keyed by room code
const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms[code]);
  return code;
}

function createRoom() {
  const code = generateRoomCode();
  const room = {
    code,
    players: {},          // socketId -> player object
    phase: 'lobby',       // lobby, phaseA, phaseB, phaseC, phaseD, roundResults, gameOver, betweenGames
    round: 0,
    gameNumber: 1,
    pastureCapacity: 0,
    pool: { rabbit: 0, sheep: 0, pig: 0, cow: 0 },
    famineCount: 0,
    totalFamineCount: 0,
    maxRounds: DEFAULT_MAX_ROUNDS,
    maxFamines: DEFAULT_MAX_FAMINES,
    timerDuration: 300,   // seconds per phase (5 minutes)
    timerHandle: null,
    timerEnd: null,
    isPaused: false,
    history: [],          // per-round stats
    game1Results: null,
    phaseASubmissions: {},
    phaseCSubmissions: {},
    phaseDSubmissions: {},
    dashboardSocket: null,
    dashboardToken: crypto.randomBytes(16).toString('hex'),
    roundSummary: null,
    soundEnabled: false,
    punishmentAnonymous: true
  };
  rooms[code] = room;
  return room;
}

// ─── Name Sanitization ──────────────────────────────────────────────────────

function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  // Strip control characters and zero-width chars
  let clean = name.replace(/[\x00-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '').trim();
  // Limit length
  clean = clean.substring(0, 20);
  if (clean.length === 0) return null;
  return clean;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getPlayerCount(room) {
  return Object.values(room.players).filter(p => !p.isSpectator).length;
}

function getConnectedPlayerCount(room) {
  return Object.values(room.players).filter(p => !p.isSpectator && !p.disconnected).length;
}

function getActivePlayers(room) {
  return Object.values(room.players).filter(p => !p.isSpectator && !p.eliminated);
}

function herdValue(herd) {
  let total = 0;
  for (const type of ANIMAL_TYPES) {
    total += (herd[type] || 0) * ANIMALS[type].value;
  }
  return total;
}

function herdCount(herd) {
  let total = 0;
  for (const type of ANIMAL_TYPES) {
    total += (herd[type] || 0);
  }
  return total;
}

function totalHerdValue(room) {
  let total = 0;
  for (const p of Object.values(room.players)) {
    if (!p.isSpectator) total += herdValue(p.herd);
  }
  return total;
}

function initPool(numPlayers) {
  return {
    rabbit: numPlayers * 3,
    sheep: numPlayers * 2,
    pig: numPlayers * 1,
    cow: Math.floor(numPlayers / 3)
  };
}

function initGame(room) {
  const numPlayers = getPlayerCount(room);
  room.pastureCapacity = 4 * numPlayers;
  room.pool = initPool(numPlayers);
  room.round = 0;
  room.famineCount = 0;
  room.history = [];
  room.phaseASubmissions = {};
  room.phaseCSubmissions = {};
  room.phaseDSubmissions = {};
  room.roundSummary = null;

  for (const p of Object.values(room.players)) {
    if (p.isSpectator) continue;
    p.herd = { rabbit: 2, sheep: 0, pig: 0, cow: 0 };
    p.eliminated = false;
    p.score = 0;
    p.phaseAHistory = [];
    p.phaseCHistory = [];
    p.phaseDHistory = [];
    p.punishmentsReceived = 0;
    p.punishmentsGiven = 0;
  }
}

function removeAnimalFromHerd(herd, type) {
  if (herd[type] > 0) {
    herd[type]--;
    return true;
  }
  return false;
}

// Remove cheapest animal from herd, return the type removed (or null)
function removeCheapestAnimal(herd) {
  for (const type of ANIMAL_TYPES) { // rabbit first (cheapest)
    if (herd[type] > 0) {
      herd[type]--;
      return type;
    }
  }
  return null;
}

// Remove most expensive animal from herd, return the type removed (or null)
function removeMostExpensiveAnimal(herd) {
  for (let i = ANIMAL_TYPES.length - 1; i >= 0; i--) {
    const type = ANIMAL_TYPES[i];
    if (herd[type] > 0) {
      herd[type]--;
      return type;
    }
  }
  return null;
}

// Convert value into animals added to herd (used during famine splitting)
function addValueAsAnimals(herd, value) {
  // Greedily convert value into largest animals possible
  for (let i = ANIMAL_TYPES.length - 1; i >= 0; i--) {
    const type = ANIMAL_TYPES[i];
    const animalValue = ANIMALS[type].value;
    while (value >= animalValue) {
      herd[type] = (herd[type] || 0) + 1;
      value -= animalValue;
    }
  }
}

function returnAnimalToPool(room, type) {
  room.pool[type] = (room.pool[type] || 0) + 1;
}

function isPoolEmpty(room) {
  return ANIMAL_TYPES.every(t => room.pool[t] <= 0);
}

// Calculate Gini coefficient
function giniCoefficient(values) {
  if (values.length === 0) return 0;
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;
  let sumDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiff += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return sumDiff / (2 * n * n * mean);
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function startTimer(room, duration, callback) {
  clearTimer(room);
  const dur = duration || room.timerDuration;
  room.timerEnd = Date.now() + dur * 1000;
  room.timerCallback = callback;
  room.timerHandle = setTimeout(() => {
    room.timerHandle = null;
    room.timerCallback = null;
    callback();
  }, dur * 1000);
  // Broadcast timer start
  broadcastToRoom(room, 'timer:start', { duration: dur, endsAt: room.timerEnd });
}

function clearTimer(room) {
  if (room.timerHandle) {
    clearTimeout(room.timerHandle);
    room.timerHandle = null;
  }
  room.timerEnd = null;
  room.timerCallback = null;
}

// ─── Broadcasting ────────────────────────────────────────────────────────────

function broadcastToRoom(room, event, data) {
  for (const socketId of Object.keys(room.players)) {
    io.to(socketId).emit(event, data);
  }
  if (room.dashboardSocket) {
    io.to(room.dashboardSocket).emit(event, data);
  }
}

function broadcastDashboard(room, event, data) {
  if (room.dashboardSocket) {
    io.to(room.dashboardSocket).emit(event, data);
  }
}

function sendGameState(room) {
  const state = getGameStateForDashboard(room);
  broadcastDashboard(room, 'game:state', state);

  // Send individual state to each player
  for (const [socketId, player] of Object.entries(room.players)) {
    if (player.isSpectator) continue;
    io.to(socketId).emit('game:state', getGameStateForPlayer(room, player));
  }
}

function getGameStateForDashboard(room) {
  const players = {};
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    players[sid] = {
      name: p.name,
      herd: { ...p.herd },
      herdValue: herdValue(p.herd),
      eliminated: p.eliminated,
      punishmentsReceived: p.punishmentsReceived || 0,
      punishmentsGiven: p.punishmentsGiven || 0
    };
  }
  return {
    phase: dashboardPhase(room),
    round: room.round,
    gameNumber: room.gameNumber,
    pastureCapacity: room.pastureCapacity,
    totalHerdValue: totalHerdValue(room),
    pool: { ...room.pool },
    famineCount: room.famineCount,
    playerCount: getPlayerCount(room),
    players,
    history: room.history,
    game1Results: room.game1Results,
    maxRounds: room.maxRounds,
    maxFamines: room.maxFamines,
    timerDuration: room.timerDuration,
    isPaused: room.isPaused,
    roundSummary: room.roundSummary,
    soundEnabled: room.soundEnabled,
    punishmentAnonymous: room.punishmentAnonymous,
    submissionCounts: {
      phaseA: Object.keys(room.phaseASubmissions).length,
      phaseC: Object.keys(room.phaseCSubmissions).length,
      phaseD: Object.keys(room.phaseDSubmissions).length
    }
  };
}

// Map transitional server phases to client-friendly phase names (player view)
function clientPhase(room) {
  const p = room.phase;
  if (p === 'phaseA_resolving') return 'phaseB';
  if (p === 'phaseC_resolving') return 'waiting_for_instructor';
  if (p === 'phaseD_resolving') return 'waiting_for_instructor';
  if (p === 'phaseB' && room.pendingNext) return 'waiting_for_instructor';
  return p;
}

// Map transitional phases for dashboard (keep them recognizable for display)
function dashboardPhase(room) {
  const p = room.phase;
  if (p === 'phaseA_resolving') return 'phaseA';
  if (p === 'phaseC_resolving') return 'phaseC';
  if (p === 'phaseD_resolving') return 'phaseD';
  return p;
}

function getGameStateForPlayer(room, player) {
  // List of other players for Phase D
  const otherPlayers = [];
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator || sid === player.socketId) continue;
    otherPlayers.push({
      id: sid,
      name: p.name,
      herdValue: herdValue(p.herd)
    });
  }

  return {
    phase: clientPhase(room),
    round: room.round,
    maxRounds: room.maxRounds,
    gameNumber: room.gameNumber,
    pastureCapacity: room.pastureCapacity,
    totalHerdValue: totalHerdValue(room),
    pool: { ...room.pool },
    famineCount: room.famineCount,
    herd: { ...player.herd },
    herdValue: herdValue(player.herd),
    herdCount: herdCount(player.herd),
    eliminated: player.eliminated,
    maxAcquisition: Math.max(2, herdValue(player.herd)),
    otherPlayers,
    playerCount: getPlayerCount(room),
    timerDuration: room.timerDuration,
    roundSummary: room.roundSummary,
    hasSubmitted: {
      phaseA: !!room.phaseASubmissions[player.socketId],
      phaseC: !!room.phaseCSubmissions[player.socketId],
      phaseD: !!room.phaseDSubmissions[player.socketId]
    }
  };
}

// ─── Phase Management ────────────────────────────────────────────────────────

function startRound(room) {
  room.round++;
  room.phaseASubmissions = {};
  room.phaseCSubmissions = {};
  room.phaseDSubmissions = {};
  room.roundSummary = null;

  // Check if pool is empty -> skip Phase A
  if (isPoolEmpty(room)) {
    // Skip directly to Phase C
    startPhaseC(room);
    return;
  }

  startPhaseA(room);
}

function startPhaseA(room) {
  room.phase = 'phaseA';
  room.phaseASubmissions = {};

  // Auto-submit for eliminated or disconnected players
  for (const [sid, p] of Object.entries(room.players)) {
    if (!p.isSpectator && (p.eliminated || p.disconnected)) {
      room.phaseASubmissions[sid] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
    }
  }

  sendGameState(room);

  startTimer(room, room.timerDuration, () => {
    // Auto-submit for players who haven't submitted
    for (const [sid, p] of Object.entries(room.players)) {
      if (!p.isSpectator && !room.phaseASubmissions[sid]) {
        room.phaseASubmissions[sid] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
      }
    }
    resolvePhaseA(room);
  });
}

function resolvePhaseA(room) {
  if (room.phase !== 'phaseA') return; // Guard against double resolution
  room.phase = 'phaseA_resolving';
  clearTimer(room);

  const submissions = room.phaseASubmissions;
  const actualAcquisitions = {};

  // Calculate total demand per animal type
  const totalDemand = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  for (const sub of Object.values(submissions)) {
    for (const type of ANIMAL_TYPES) {
      totalDemand[type] += (sub[type] || 0);
    }
  }

  // Resolve conflicts: if demand > supply, distribute proportionally with random tiebreaking
  for (const [sid, sub] of Object.entries(submissions)) {
    actualAcquisitions[sid] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  }

  for (const type of ANIMAL_TYPES) {
    const available = room.pool[type];
    if (totalDemand[type] <= available) {
      // Everyone gets what they asked for
      for (const [sid, sub] of Object.entries(submissions)) {
        actualAcquisitions[sid][type] = sub[type] || 0;
      }
    } else if (available > 0) {
      // Proportional distribution with random tiebreaking
      const requesters = Object.entries(submissions)
        .filter(([, sub]) => (sub[type] || 0) > 0)
        .map(([sid, sub]) => ({ sid, requested: sub[type] || 0 }));

      // Shuffle for random tiebreaking
      for (let i = requesters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [requesters[i], requesters[j]] = [requesters[j], requesters[i]];
      }

      let remaining = available;
      const totalRequested = requesters.reduce((s, r) => s + r.requested, 0);

      for (const req of requesters) {
        const share = Math.min(req.requested, Math.floor(available * req.requested / totalRequested));
        actualAcquisitions[req.sid][type] = share;
        remaining -= share;
      }

      // Distribute remainder one by one
      let idx = 0;
      while (remaining > 0 && idx < requesters.length) {
        const req = requesters[idx];
        if (actualAcquisitions[req.sid][type] < req.requested) {
          actualAcquisitions[req.sid][type]++;
          remaining--;
        }
        idx++;
      }
    }
    // else available == 0, everyone gets 0
  }

  // Apply acquisitions
  let totalAcquiredValue = 0;
  const acquisitionDetails = {};
  for (const [sid, acq] of Object.entries(actualAcquisitions)) {
    const player = room.players[sid];
    if (!player || player.isSpectator) continue;

    let playerAcqValue = 0;
    for (const type of ANIMAL_TYPES) {
      player.herd[type] += acq[type];
      room.pool[type] -= acq[type];
      playerAcqValue += acq[type] * ANIMALS[type].value;
    }
    totalAcquiredValue += playerAcqValue;

    acquisitionDetails[sid] = {
      name: player.name,
      acquired: { ...acq },
      acquiredValue: playerAcqValue,
      newHerdValue: herdValue(player.herd)
    };

    player.phaseAHistory.push({ ...acq });

    // Send individual result to player
    io.to(sid).emit('phaseA:result', {
      acquired: acq,
      acquiredValue: playerAcqValue,
      herd: { ...player.herd },
      herdValue: herdValue(player.herd)
    });
  }

  // Dashboard update
  broadcastDashboard(room, 'phaseA:resolved', {
    acquisitionDetails,
    totalAcquiredValue,
    pool: { ...room.pool }
  });

  // Phase B (famine check) is automatic — no instructor click needed
  startPhaseB(room);
}

function startPhaseB(room) {
  room.phase = 'phaseB';

  const totalNeeded = totalHerdValue(room);
  const capacity = room.pastureCapacity;

  if (totalNeeded <= capacity) {
    // No famine
    broadcastToRoom(room, 'phaseB:result', {
      famine: false,
      totalNeeded,
      capacity,
      pastureCapacity: room.pastureCapacity
    });
    // Wait for instructor to advance to Phase C
    room.pendingNext = () => startPhaseC(room);
    broadcastDashboard(room, 'phase:waitingForNext', { nextPhase: 'phaseC' });
    return;
  }

  // FAMINE!
  room.famineCount++;
  room.totalFamineCount++;
  const numPlayers = getPlayerCount(room);

  // Pasture trampled
  room.pastureCapacity = Math.max(numPlayers, room.pastureCapacity - numPlayers);

  // Culling loop
  const playerLosses = {};
  let passes = 0;

  while (totalHerdValue(room) > room.pastureCapacity) {
    passes++;
    for (const [sid, p] of Object.entries(room.players)) {
      if (p.isSpectator || p.eliminated) continue;

      const currentValue = herdValue(p.herd);
      if (currentValue === 0) continue;

      const toLose = Math.floor(currentValue / 2);
      if (toLose === 0) continue;

      if (!playerLosses[sid]) playerLosses[sid] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };

      let remaining = toLose;
      // Remove from most expensive first
      for (let i = ANIMAL_TYPES.length - 1; i >= 0 && remaining > 0; i--) {
        const type = ANIMAL_TYPES[i];
        const animalValue = ANIMALS[type].value;

        while (p.herd[type] > 0 && remaining > 0) {
          if (animalValue <= remaining) {
            // Remove whole animal
            p.herd[type]--;
            remaining -= animalValue;
            playerLosses[sid][type]++;
            returnAnimalToPool(room, type);
          } else {
            // Split: remove this animal, add back smaller animals worth the difference
            p.herd[type]--;
            playerLosses[sid][type]++;
            const change = animalValue - remaining;
            // Add back smaller animals
            addValueAsAnimals(p.herd, change);
            returnAnimalToPool(room, type);
            // The smaller animals we added aren't returned to pool — they stay in herd
            remaining = 0;
          }
        }
      }

      // Check if eliminated
      if (herdValue(p.herd) === 0) {
        p.eliminated = true;
      }
    }

    if (passes > 10) break; // Safety valve
  }

  // Send results
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    io.to(sid).emit('phaseB:result', {
      famine: true,
      losses: playerLosses[sid] || { rabbit: 0, sheep: 0, pig: 0, cow: 0 },
      herd: { ...p.herd },
      herdValue: herdValue(p.herd),
      eliminated: p.eliminated,
      pastureCapacity: room.pastureCapacity
    });
  }

  broadcastDashboard(room, 'phaseB:result', {
    famine: true,
    famineCount: room.famineCount,
    pastureCapacity: room.pastureCapacity,
    totalHerdValue: totalHerdValue(room),
    playerLosses,
    cullingPasses: passes
  });

  // Check if game ends (max famines reached)
  if (room.famineCount >= room.maxFamines) {
    room.pendingNext = () => endGame(room);
    broadcastDashboard(room, 'phase:waitingForNext', { nextPhase: 'gameOver' });
    return;
  }

  // Wait for instructor to advance to Phase C
  room.pendingNext = () => startPhaseC(room);
  broadcastDashboard(room, 'phase:waitingForNext', { nextPhase: 'phaseC' });
}

function startPhaseC(room) {
  room.phase = 'phaseC';
  room.phaseCSubmissions = {};

  const activePlayers = getActivePlayers(room);

  // Auto-submit for players with <= 1 animal, eliminated, or disconnected
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    if (p.eliminated || p.disconnected || herdCount(p.herd) <= 1) {
      room.phaseCSubmissions[sid] = { type: null, exempt: true };
    }
  }

  // Check if all exempt
  if (Object.keys(room.phaseCSubmissions).length >= getPlayerCount(room)) {
    resolvePhaseC(room);
    return;
  }

  sendGameState(room);

  startTimer(room, room.timerDuration, () => {
    // Auto-submit cheapest animal for non-submitters
    for (const [sid, p] of Object.entries(room.players)) {
      if (!p.isSpectator && !room.phaseCSubmissions[sid]) {
        const cheapest = ANIMAL_TYPES.find(t => p.herd[t] > 0);
        room.phaseCSubmissions[sid] = { type: cheapest || null, exempt: !cheapest };
      }
    }
    resolvePhaseC(room);
  });
}

function resolvePhaseC(room) {
  if (room.phase !== 'phaseC') return; // Guard against double resolution
  room.phase = 'phaseC_resolving';
  clearTimer(room);

  let totalTributeValue = 0;
  const tributeBreakdown = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };

  for (const [sid, sub] of Object.entries(room.phaseCSubmissions)) {
    const player = room.players[sid];
    if (!player || player.isSpectator || sub.exempt || !sub.type) continue;

    if (player.herd[sub.type] > 0) {
      player.herd[sub.type]--;
      returnAnimalToPool(room, sub.type);
      const val = ANIMALS[sub.type].value;
      totalTributeValue += val;
      tributeBreakdown[sub.type]++;

      player.phaseCHistory.push(sub.type);

      io.to(sid).emit('phaseC:result', {
        returned: sub.type,
        returnedValue: val,
        herd: { ...player.herd },
        herdValue: herdValue(player.herd)
      });
    }
  }

  // Pasture grows
  room.pastureCapacity += totalTributeValue;

  // Save for round history (used in resolvePhaseD)
  room.currentRoundTribute = totalTributeValue;

  broadcastDashboard(room, 'phaseC:resolved', {
    totalTributeValue,
    tributeBreakdown,
    pastureCapacity: room.pastureCapacity
  });

  broadcastToRoom(room, 'phaseC:complete', {
    totalTributeValue,
    pastureCapacity: room.pastureCapacity
  });

  // Wait for instructor to advance to Phase D
  room.pendingNext = () => startPhaseD(room);
  broadcastDashboard(room, 'phase:waitingForNext', { nextPhase: 'phaseD' });
}

function startPhaseD(room) {
  room.phase = 'phaseD';
  room.phaseDSubmissions = {};

  // Auto-submit for eliminated, disconnected, or those with <=1 animal
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    if (p.eliminated || p.disconnected || herdCount(p.herd) <= 1) {
      room.phaseDSubmissions[sid] = { target: null, cannotPunish: true };
    }
  }

  if (Object.keys(room.phaseDSubmissions).length >= getPlayerCount(room)) {
    resolvePhaseD(room);
    return;
  }

  sendGameState(room);

  startTimer(room, room.timerDuration, () => {
    // Auto-submit "no punishment" for non-submitters
    for (const [sid, p] of Object.entries(room.players)) {
      if (!p.isSpectator && !room.phaseDSubmissions[sid]) {
        room.phaseDSubmissions[sid] = { target: null };
      }
    }
    resolvePhaseD(room);
  });
}

function resolvePhaseD(room) {
  if (room.phase !== 'phaseD') return; // Guard against double resolution
  room.phase = 'phaseD_resolving';
  clearTimer(room);

  // Collect all punishments — resolve target by name if socket ID is stale
  const punishments = {}; // targetSid -> [punisherSid, ...]
  const punishers = [];

  // Build name->sid lookup for resolving stale IDs
  const nameSidMap = {};
  for (const [sid, p] of Object.entries(room.players)) {
    if (!p.isSpectator) nameSidMap[p.name] = sid;
  }

  for (const [sid, sub] of Object.entries(room.phaseDSubmissions)) {
    let targetSid = sub.target;
    if (targetSid && !room.players[targetSid] && sub.targetName) {
      // Socket ID is stale — resolve by name
      targetSid = nameSidMap[sub.targetName] || null;
    }
    if (targetSid && room.players[targetSid]) {
      if (!punishments[targetSid]) punishments[targetSid] = [];
      punishments[targetSid].push(sid);
      punishers.push(sid);
    }
  }

  const punishmentResults = {};
  let totalAnimalsLost = 0;

  // Process punishments
  for (const [targetSid, punisherList] of Object.entries(punishments)) {
    const target = room.players[targetSid];
    if (!target || target.isSpectator) continue;

    for (const punisherSid of punisherList) {
      const punisher = room.players[punisherSid];
      if (!punisher || punisher.isSpectator) continue;

      // Check if target still has >1 animal
      if (herdCount(target.herd) <= 1) continue;
      // Check if punisher still has >1 animal
      if (herdCount(punisher.herd) <= 1) continue;

      // Both lose cheapest animal
      const punisherLost = removeCheapestAnimal(punisher.herd);
      const targetLost = removeCheapestAnimal(target.herd);

      if (punisherLost) {
        returnAnimalToPool(room, punisherLost);
        totalAnimalsLost++;
        punisher.punishmentsGiven = (punisher.punishmentsGiven || 0) + 1;
      }
      if (targetLost) {
        returnAnimalToPool(room, targetLost);
        totalAnimalsLost++;
        target.punishmentsReceived = (target.punishmentsReceived || 0) + 1;
      }

      // Record results
      if (!punishmentResults[punisherSid]) {
        punishmentResults[punisherSid] = { punished: null, lost: null, wasTarget: false, punishedBy: 0, lostFromPunishment: [], punisherNames: [] };
      }
      punishmentResults[punisherSid].punished = target.name;
      punishmentResults[punisherSid].lost = punisherLost;

      if (!punishmentResults[targetSid]) {
        punishmentResults[targetSid] = { punished: null, lost: null, wasTarget: false, punishedBy: 0, lostFromPunishment: [], punisherNames: [] };
      }
      punishmentResults[targetSid].wasTarget = true;
      punishmentResults[targetSid].punishedBy++;
      punishmentResults[targetSid].punisherNames.push(punisher.name);
      if (targetLost) punishmentResults[targetSid].lostFromPunishment.push(targetLost);

      // Check elimination
      if (herdValue(punisher.herd) === 0) punisher.eliminated = true;
      if (herdValue(target.herd) === 0) target.eliminated = true;
    }
  }

  // Count unique targets and punishers
  const uniquePunishers = new Set(punishers).size;
  const uniqueTargets = Object.keys(punishments).length;

  // Send individual results
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    const result = punishmentResults[sid] || { punished: null, lost: null, wasTarget: false, punishedBy: 0, lostFromPunishment: [], punisherNames: [] };
    io.to(sid).emit('phaseD:result', {
      ...result,
      herd: { ...p.herd },
      herdValue: herdValue(p.herd),
      eliminated: p.eliminated
    });
  }

  // Dashboard
  broadcastDashboard(room, 'phaseD:resolved', {
    uniquePunishers,
    uniqueTargets,
    totalAnimalsLost,
    punishmentResults,
    punishmentAnonymous: room.punishmentAnonymous
  });

  // Record round history
  const roundData = {
    round: room.round,
    pastureCapacity: room.pastureCapacity,
    totalHerdValue: totalHerdValue(room),
    famineCount: room.famineCount,
    totalTribute: room.currentRoundTribute || 0,
    totalPunishments: uniquePunishers,
    totalAnimalsLostToPunishment: totalAnimalsLost
  };
  room.history.push(roundData);

  // Wait for instructor to advance to round results (so players can see punishment results)
  room.pendingNext = () => showRoundResults(room);
  broadcastDashboard(room, 'phase:waitingForNext', { nextPhase: 'roundResults' });
}

function showRoundResults(room) {
  room.phase = 'roundResults';

  const summary = {
    round: room.round,
    pastureCapacity: room.pastureCapacity,
    totalHerdValue: totalHerdValue(room),
    famineCount: room.famineCount,
    pool: { ...room.pool },
    history: room.history
  };

  room.roundSummary = summary;
  sendGameState(room);
  broadcastToRoom(room, 'round:results', summary);

  // Check end conditions (maxRounds=0 means unlimited)
  const shouldEnd = (room.maxRounds > 0 && room.round >= room.maxRounds) ||
    room.famineCount >= room.maxFamines ||
    (isPoolEmpty(room) && room.round > 0);

  if (shouldEnd) {
    room.pendingNext = () => endGame(room);
    broadcastDashboard(room, 'phase:waitingForNext', { nextPhase: 'gameOver' });
  } else {
    room.pendingNext = () => startRound(room);
    broadcastDashboard(room, 'phase:waitingForNext', { nextPhase: 'nextRound' });
  }
}

function endGame(room) {
  if (room.phase === 'gameOver' || room.phase === 'betweenGames') return; // Guard against double invocation
  room.phase = 'gameOver';
  clearTimer(room);

  // Calculate scores
  const scores = [];
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    p.score = herdValue(p.herd);
    scores.push({
      id: sid,
      name: p.name,
      score: p.score,
      herd: { ...p.herd },
      eliminated: p.eliminated,
      punishmentsGiven: p.punishmentsGiven || 0,
      punishmentsReceived: p.punishmentsReceived || 0
    });
  }
  scores.sort((a, b) => b.score - a.score);

  // Add rank
  scores.forEach((s, i) => s.rank = i + 1);

  const herdValues = scores.map(s => s.score);
  const gini = giniCoefficient(herdValues);
  const avgHerdValue = herdValues.length > 0 ? herdValues.reduce((s, v) => s + v, 0) / herdValues.length : 0;

  const gameResults = {
    gameNumber: room.gameNumber,
    scores,
    gini: Math.round(gini * 1000) / 1000,
    avgHerdValue: Math.round(avgHerdValue * 10) / 10,
    roundsSurvived: room.round,
    faminesOccurred: room.famineCount,
    totalPunishments: room.history.reduce((s, r) => s + (r.totalPunishments || 0), 0),
    history: room.history,
    pastureCapacity: room.pastureCapacity
  };

  if (room.gameNumber === 1) {
    room.game1Results = gameResults;
  }

  // Send to all
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    const playerScore = scores.find(s => s.id === sid);
    io.to(sid).emit('game:over', {
      ...gameResults,
      yourScore: playerScore?.score || 0,
      yourRank: playerScore?.rank || 0
    });
  }

  broadcastDashboard(room, 'game:over', {
    ...gameResults,
    game1Results: room.game1Results
  });

  if (room.gameNumber === 1) {
    room.phase = 'betweenGames';
    broadcastDashboard(room, 'game:betweenGames', {
      game1Results: room.game1Results
    });
  }
}

function resetForGame2(room) {
  room.gameNumber = 2;
  // Keep current timer duration (instructor may have changed it)
  room.totalFamineCount = room.famineCount; // preserve for stats
  initGame(room);
  room.phase = 'lobby';

  broadcastToRoom(room, 'game:reset', {
    gameNumber: 2,
    game1Results: room.game1Results,
    timerDuration: room.timerDuration
  });

  sendGameState(room);
}

// ─── Socket.io Connection Handling ───────────────────────────────────────────

io.on('connection', (socket) => {
  let currentRoom = null;
  let isInstructor = false;

  // Create room (instructor)
  socket.on('room:create', (callback) => {
    if (Object.keys(rooms).length >= MAX_ROOMS) {
      if (callback) callback({ error: 'Too many active rooms. Please try again later.' });
      return;
    }
    const room = createRoom();
    room.dashboardSocket = socket.id;
    currentRoom = room;
    isInstructor = true;
    if (callback) callback({ code: room.code, token: room.dashboardToken });
  });

  // Join room (student)
  socket.on('room:join', ({ code, name }, callback) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) {
      if (callback) callback({ error: 'Room not found.' });
      return;
    }

    const cleanName = sanitizeName(name);
    if (!cleanName) {
      if (callback) callback({ error: 'Invalid name.' });
      return;
    }

    // Check if name is taken
    const nameTaken = Object.values(room.players).some(p => p.name === cleanName && !p.disconnected);
    if (nameTaken) {
      if (callback) callback({ error: 'This name is already taken.' });
      return;
    }

    // Check for reconnection
    const reconnectEntry = Object.entries(room.players).find(([, p]) => p.name === cleanName && p.disconnected);
    if (reconnectEntry) {
      const [oldSid, oldPlayer] = reconnectEntry;
      // Transfer player to new socket
      delete room.players[oldSid];
      oldPlayer.socketId = socket.id;
      oldPlayer.disconnected = false;
      room.players[socket.id] = oldPlayer;
      currentRoom = room;

      // Migrate submission keys from old socket ID to new socket ID
      for (const submMap of [room.phaseASubmissions, room.phaseCSubmissions, room.phaseDSubmissions]) {
        if (submMap[oldSid] !== undefined) {
          submMap[socket.id] = submMap[oldSid];
          delete submMap[oldSid];
        }
      }

      if (callback) callback({ success: true, reconnected: true });
      broadcastDashboard(room, 'player:reconnected', { name, playerCount: getPlayerCount(room) });

      // Send state to reconnected player
      io.to(socket.id).emit('game:state', getGameStateForPlayer(room, oldPlayer));
      // During phaseD, other players need updated otherPlayers list (socket IDs changed)
      if (room.phase === 'phaseD') {
        for (const [sid, p] of Object.entries(room.players)) {
          if (p.isSpectator || sid === socket.id) continue;
          io.to(sid).emit('game:state', getGameStateForPlayer(room, p));
        }
      }
      return;
    }

    // Block new players from joining mid-game (only reconnects allowed)
    if (room.phase !== 'lobby' && room.phase !== 'betweenGames') {
      if (callback) callback({ error: 'Game is in progress. Cannot join.' });
      return;
    }

    // Limit players per room
    if (getPlayerCount(room) >= MAX_PLAYERS_PER_ROOM) {
      if (callback) callback({ error: 'Room is full.' });
      return;
    }

    const player = {
      socketId: socket.id,
      name: cleanName,
      herd: { rabbit: 2, sheep: 0, pig: 0, cow: 0 },
      eliminated: false,
      isSpectator: false,
      disconnected: false,
      score: 0,
      phaseAHistory: [],
      phaseCHistory: [],
      phaseDHistory: [],
      punishmentsReceived: 0,
      punishmentsGiven: 0
    };

    room.players[socket.id] = player;
    currentRoom = room;

    if (callback) callback({ success: true });

    broadcastToRoom(room, 'player:joined', {
      name: player.name,
      playerCount: getPlayerCount(room),
      players: Object.values(room.players).filter(p => !p.isSpectator).map(p => p.name)
    });

    // If game is already running, send current state
    if (room.phase !== 'lobby') {
      io.to(socket.id).emit('game:state', getGameStateForPlayer(room, player));
    }
  });

  // Dashboard joins room (requires secret token)
  socket.on('dashboard:join', ({ code, token }, callback) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) {
      if (callback) callback({ error: 'Room not found' });
      return;
    }
    if (!token || token !== room.dashboardToken) {
      if (callback) callback({ error: 'Invalid dashboard token' });
      return;
    }
    room.dashboardSocket = socket.id;
    currentRoom = room;
    isInstructor = true;
    if (callback) callback({ success: true });
    io.to(socket.id).emit('game:state', getGameStateForDashboard(room));

    // Re-send pending "Next" button state if applicable
    if (room.pendingNext) {
      let nextPhase = 'nextRound';
      const p = room.phase;
      if (p === 'phaseB' && room.famineCount >= room.maxFamines) nextPhase = 'gameOver';
      else if (p === 'phaseB') nextPhase = 'phaseC';
      else if (p === 'phaseC' || p === 'phaseC_resolving') nextPhase = 'phaseD';
      else if (p === 'phaseD_resolving') nextPhase = 'roundResults';
      else if (p === 'roundResults') {
        const shouldEnd = (room.maxRounds > 0 && room.round >= room.maxRounds) ||
          room.famineCount >= room.maxFamines ||
          (isPoolEmpty(room) && room.round > 0);
        nextPhase = shouldEnd ? 'gameOver' : 'nextRound';
      }
      io.to(socket.id).emit('phase:waitingForNext', { nextPhase });
    }
  });

  // Start game
  socket.on('game:start', () => {
    if (!currentRoom || !isInstructor) return;
    const room = currentRoom;
    if (getPlayerCount(room) < 2) return;

    initGame(room);
    broadcastToRoom(room, 'game:started', { gameNumber: room.gameNumber });
    startRound(room);
  });

  // Helper: send submission count + pending player names to dashboard
  function broadcastSubmissionStatus(room, phase, submissions) {
    const count = Object.keys(submissions).length;
    const total = getPlayerCount(room);
    const pending = [];
    for (const [sid, p] of Object.entries(room.players)) {
      if (!p.isSpectator && !p.disconnected && !submissions[sid]) {
        pending.push(p.name);
      }
    }
    broadcastDashboard(room, 'submission:count', { phase, count, total, pending });
    broadcastToRoom(room, 'submission:count', { phase, count, total });
  }

  // Phase A submission
  socket.on('phaseA:submit', (data, callback) => {
    if (!currentRoom) { if (callback) callback({ error: true }); return; }
    const room = currentRoom;
    const player = room.players[socket.id];
    if (!player || player.isSpectator || player.eliminated) { if (callback) callback({ error: true }); return; }
    if (room.phase !== 'phaseA') { if (callback) callback({ error: true }); return; }
    if (room.phaseASubmissions[socket.id]) { if (callback) callback({ ok: true, alreadySubmitted: true }); return; }

    // Validate acquisition
    const maxAcq = Math.max(2, herdValue(player.herd));
    let totalRequested = 0;
    const validated = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };

    for (const type of ANIMAL_TYPES) {
      const qty = Math.max(0, Math.floor(data[type] || 0));
      const cost = qty * ANIMALS[type].value;
      if (totalRequested + cost <= maxAcq && qty <= room.pool[type]) {
        validated[type] = qty;
        totalRequested += cost;
      }
    }

    room.phaseASubmissions[socket.id] = validated;
    if (callback) callback({ ok: true });

    broadcastSubmissionStatus(room, 'phaseA', room.phaseASubmissions);

    if (Object.keys(room.phaseASubmissions).length >= getPlayerCount(room)) {
      resolvePhaseA(room);
    }
  });

  // Phase C submission
  socket.on('phaseC:submit', ({ type }, callback) => {
    if (!currentRoom) { if (callback) callback({ error: true }); return; }
    const room = currentRoom;
    const player = room.players[socket.id];
    if (!player || player.isSpectator || player.eliminated) { if (callback) callback({ error: true }); return; }
    if (room.phase !== 'phaseC') { if (callback) callback({ error: true }); return; }
    if (room.phaseCSubmissions[socket.id]) { if (callback) callback({ ok: true, alreadySubmitted: true }); return; }

    if (herdCount(player.herd) <= 1) {
      room.phaseCSubmissions[socket.id] = { type: null, exempt: true };
    } else if (type && ANIMAL_TYPES.includes(type) && player.herd[type] > 0) {
      room.phaseCSubmissions[socket.id] = { type };
    } else {
      if (callback) callback({ error: true });
      return;
    }

    if (callback) callback({ ok: true });

    broadcastSubmissionStatus(room, 'phaseC', room.phaseCSubmissions);

    if (Object.keys(room.phaseCSubmissions).length >= getPlayerCount(room)) {
      resolvePhaseC(room);
    }
  });

  // Phase D submission
  socket.on('phaseD:submit', ({ target }, callback) => {
    if (!currentRoom) { if (callback) callback({ error: true }); return; }
    const room = currentRoom;
    const player = room.players[socket.id];
    if (!player || player.isSpectator || player.eliminated) { if (callback) callback({ error: true }); return; }
    if (room.phase !== 'phaseD') { if (callback) callback({ error: true }); return; }
    if (room.phaseDSubmissions[socket.id]) { if (callback) callback({ ok: true, alreadySubmitted: true }); return; }

    if (herdCount(player.herd) <= 1) {
      room.phaseDSubmissions[socket.id] = { target: null, cannotPunish: true };
    } else {
      // Store target name alongside socket ID for resilience against reconnects
      let targetName = null;
      if (target) {
        const targetPlayer = room.players[target];
        if (targetPlayer) targetName = targetPlayer.name;
      }
      room.phaseDSubmissions[socket.id] = { target: target || null, targetName };
    }

    if (callback) callback({ ok: true });

    broadcastSubmissionStatus(room, 'phaseD', room.phaseDSubmissions);

    if (Object.keys(room.phaseDSubmissions).length >= getPlayerCount(room)) {
      resolvePhaseD(room);
    }
  });

  // ─── Instructor Controls ────────────────────────────────────────────

  socket.on('instructor:nextPhase', () => {
    if (!currentRoom || !isInstructor) return;
    const room = currentRoom;
    if (room.pendingNext) {
      const next = room.pendingNext;
      room.pendingNext = null;
      next();
    }
  });

  socket.on('instructor:pause', () => {
    if (!currentRoom || !isInstructor) return;
    const room = currentRoom;
    room.isPaused = true;
    // Save remaining time and callback before clearing
    if (room.timerEnd) {
      room.pausedRemaining = Math.max(1, Math.ceil((room.timerEnd - Date.now()) / 1000));
      room.pausedCallback = room.timerCallback;
    }
    clearTimer(room);
    broadcastToRoom(room, 'game:paused', {});
  });

  socket.on('instructor:resume', () => {
    if (!currentRoom || !isInstructor) return;
    const room = currentRoom;
    room.isPaused = false;
    // Restart timer with remaining time
    if (room.pausedRemaining && room.pausedCallback) {
      startTimer(room, room.pausedRemaining, room.pausedCallback);
      room.pausedRemaining = null;
      room.pausedCallback = null;
    }
    broadcastToRoom(room, 'game:resumed', {});
  });

  socket.on('instructor:skipPhase', () => {
    if (!currentRoom || !isInstructor) return;
    const room = currentRoom;

    // Force-submit defaults for all non-submitted players and resolve
    if (room.phase === 'phaseA') {
      for (const [sid, p] of Object.entries(room.players)) {
        if (!p.isSpectator && !p.eliminated && !room.phaseASubmissions[sid]) {
          room.phaseASubmissions[sid] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
        }
      }
      resolvePhaseA(room);
    } else if (room.phase === 'phaseC') {
      for (const [sid, p] of Object.entries(room.players)) {
        if (!p.isSpectator && !p.eliminated && !room.phaseCSubmissions[sid]) {
          const cheapest = ANIMAL_TYPES.find(t => p.herd[t] > 0);
          room.phaseCSubmissions[sid] = { type: cheapest || null, exempt: !cheapest };
        }
      }
      resolvePhaseC(room);
    } else if (room.phase === 'phaseD') {
      for (const [sid, p] of Object.entries(room.players)) {
        if (!p.isSpectator && !room.phaseDSubmissions[sid]) {
          room.phaseDSubmissions[sid] = { target: null };
        }
      }
      resolvePhaseD(room);
    }
  });

  socket.on('instructor:endGame', () => {
    if (!currentRoom || !isInstructor) return;
    endGame(currentRoom);
  });

  socket.on('instructor:resetGame2', () => {
    if (!currentRoom || !isInstructor) return;
    resetForGame2(currentRoom);
  });

  socket.on('instructor:kickPlayer', ({ playerId }) => {
    if (!currentRoom || !isInstructor) return;
    const room = currentRoom;
    const player = room.players[playerId];
    if (player) {
      io.to(playerId).emit('kicked', {});

      // Remove player's submissions (they no longer count)
      delete room.phaseASubmissions[playerId];
      delete room.phaseCSubmissions[playerId];
      delete room.phaseDSubmissions[playerId];

      delete room.players[playerId];

      broadcastDashboard(room, 'player:left', {
        name: player.name,
        playerCount: getPlayerCount(room)
      });

      // Check if kick unblocks phase resolution
      if (room.phase === 'phaseA' && Object.keys(room.phaseASubmissions).length >= getPlayerCount(room)) {
        resolvePhaseA(room);
      } else if (room.phase === 'phaseC' && Object.keys(room.phaseCSubmissions).length >= getPlayerCount(room)) {
        resolvePhaseC(room);
      } else if (room.phase === 'phaseD' && Object.keys(room.phaseDSubmissions).length >= getPlayerCount(room)) {
        resolvePhaseD(room);
      }
    }
  });

  socket.on('instructor:setRounds', ({ maxRounds }) => {
    if (!currentRoom || !isInstructor) return;
    const room = currentRoom;
    // Only allow changing in lobby
    if (room.phase !== 'lobby' && room.phase !== 'betweenGames') return;
    const validOptions = [0, 5, 10, 15]; // 0 = unlimited
    if (!validOptions.includes(maxRounds)) return;
    room.maxRounds = maxRounds;
    room.maxFamines = maxRounds === 0 ? INFINITY_MAX_FAMINES : DEFAULT_MAX_FAMINES;
  });

  socket.on('instructor:setTimer', ({ duration }) => {
    if (!currentRoom || !isInstructor) return;
    currentRoom.timerDuration = Math.min(300, Math.max(15, duration));
    broadcastDashboard(currentRoom, 'timer:updated', { duration: currentRoom.timerDuration });
  });

  socket.on('instructor:toggleSound', () => {
    if (!currentRoom || !isInstructor) return;
    currentRoom.soundEnabled = !currentRoom.soundEnabled;
    broadcastDashboard(currentRoom, 'sound:toggled', { enabled: currentRoom.soundEnabled });
  });

  socket.on('instructor:togglePunishmentAnonymity', () => {
    if (!currentRoom || !isInstructor) return;
    currentRoom.punishmentAnonymous = !currentRoom.punishmentAnonymous;
    broadcastDashboard(currentRoom, 'punishment:anonymityToggled', { anonymous: currentRoom.punishmentAnonymous });
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = currentRoom;

    if (isInstructor) {
      // Dashboard disconnected — keep room alive but mark
      // Don't delete room — instructor may reconnect
      return;
    }

    const player = room.players[socket.id];
    if (player) {
      player.disconnected = true;
      broadcastDashboard(room, 'player:disconnected', {
        name: player.name,
        playerCount: getPlayerCount(room)
      });

      // If in active phase, auto-submit defaults
      if (room.phase === 'phaseA' && !room.phaseASubmissions[socket.id]) {
        room.phaseASubmissions[socket.id] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
        const count = Object.keys(room.phaseASubmissions).length;
        const total = getPlayerCount(room);
        if (count >= total) resolvePhaseA(room);
      } else if (room.phase === 'phaseC' && !room.phaseCSubmissions[socket.id]) {
        const cheapest = ANIMAL_TYPES.find(t => player.herd[t] > 0);
        room.phaseCSubmissions[socket.id] = { type: cheapest || null, exempt: !cheapest || herdCount(player.herd) <= 1 };
        const count = Object.keys(room.phaseCSubmissions).length;
        const total = getPlayerCount(room);
        if (count >= total) resolvePhaseC(room);
      } else if (room.phase === 'phaseD' && !room.phaseDSubmissions[socket.id]) {
        room.phaseDSubmissions[socket.id] = { target: null };
        const count = Object.keys(room.phaseDSubmissions).length;
        const total = getPlayerCount(room);
        if (count >= total) resolvePhaseD(room);
      }
    }
  });
});

// ─── Room Cleanup ─────────────────────────────────────────────────────────────
// Clean up empty rooms every 10 minutes
setInterval(() => {
  for (const [code, room] of Object.entries(rooms)) {
    const hasConnectedPlayers = Object.values(room.players).some(p => !p.disconnected);
    const dashboardAlive = room.dashboardSocket && io.sockets.sockets.get(room.dashboardSocket);
    if (!hasConnectedPlayers && !dashboardAlive) {
      clearTimer(room);
      delete rooms[code];
    }
  }
}, 10 * 60 * 1000);

// ─── Start Server ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const lanIP = getLanIP();
  console.log('');
  console.log('  🐇🐑🐷🐄  Common Pasture  🐇🐑🐷🐄');
  console.log('  ──────────────────────────────────────');
  console.log(`  Instructor panel:    http://localhost:${PORT}/dashboard.html`);
  console.log(`  Students (this LAN): http://${lanIP}:${PORT}`);
  console.log('  ──────────────────────────────────────');
  console.log('  Ctrl+C to stop the server');
  console.log('');
});

module.exports = { server, io, rooms, ANIMALS, ANIMAL_TYPES, herdValue, herdCount, giniCoefficient, addValueAsAnimals };
