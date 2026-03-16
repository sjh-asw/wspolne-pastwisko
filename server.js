const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Game State ──────────────────────────────────────────────────────────────

const ANIMALS = {
  rabbit: { name: 'Królik', emoji: '🐇', value: 1 },
  sheep:  { name: 'Owca',   emoji: '🐑', value: 2 },
  pig:    { name: 'Świnia', emoji: '🐷', value: 4 },
  cow:    { name: 'Krowa',  emoji: '🐄', value: 8 }
};

const ANIMAL_TYPES = ['rabbit', 'sheep', 'pig', 'cow'];
const MAX_ROUNDS = 5;
const MAX_FAMINES = 2;

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
    timerDuration: 30,    // seconds per phase
    timerHandle: null,
    timerEnd: null,
    isPaused: false,
    history: [],          // per-round stats
    game1Results: null,
    phaseASubmissions: {},
    phaseCSubmissions: {},
    phaseDSubmissions: {},
    dashboardSocket: null,
    roundSummary: null,
    soundEnabled: false,
    punishmentAnonymous: true
  };
  rooms[code] = room;
  return room;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getPlayerCount(room) {
  return Object.values(room.players).filter(p => !p.isSpectator).length;
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
  room.timerHandle = setTimeout(() => {
    room.timerHandle = null;
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
    phase: room.phase,
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
    phase: room.phase,
    round: room.round,
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
    roundSummary: room.roundSummary
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

  // Auto-submit for eliminated players
  for (const [sid, p] of Object.entries(room.players)) {
    if (!p.isSpectator && p.eliminated) {
      room.phaseASubmissions[sid] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
    }
  }

  sendGameState(room);

  startTimer(room, room.timerDuration, () => {
    // Auto-submit for players who haven't submitted
    for (const [sid, p] of Object.entries(room.players)) {
      if (!p.isSpectator && !p.eliminated && !room.phaseASubmissions[sid]) {
        room.phaseASubmissions[sid] = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
      }
    }
    resolvePhaseA(room);
  });
}

function resolvePhaseA(room) {
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

  // Move to Phase B (famine check)
  setTimeout(() => startPhaseB(room), 2000);
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
    setTimeout(() => startPhaseC(room), 2000);
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

  // Check if game ends (2 famines)
  if (room.famineCount >= MAX_FAMINES) {
    setTimeout(() => endGame(room), 8000);
    return;
  }

  setTimeout(() => startPhaseC(room), 8000);
}

function startPhaseC(room) {
  room.phase = 'phaseC';
  room.phaseCSubmissions = {};

  const activePlayers = getActivePlayers(room);

  // Auto-submit for players with <= 1 animal (exempt) or eliminated
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    if (p.eliminated || herdCount(p.herd) <= 1) {
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
      if (!p.isSpectator && !p.eliminated && !room.phaseCSubmissions[sid]) {
        // Return cheapest
        const cheapest = ANIMAL_TYPES.find(t => p.herd[t] > 0);
        room.phaseCSubmissions[sid] = { type: cheapest || null, exempt: !cheapest };
      }
    }
    resolvePhaseC(room);
  });
}

function resolvePhaseC(room) {
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

  broadcastDashboard(room, 'phaseC:resolved', {
    totalTributeValue,
    tributeBreakdown,
    pastureCapacity: room.pastureCapacity
  });

  broadcastToRoom(room, 'phaseC:complete', {
    totalTributeValue,
    pastureCapacity: room.pastureCapacity
  });

  setTimeout(() => startPhaseD(room), 2000);
}

function startPhaseD(room) {
  room.phase = 'phaseD';
  room.phaseDSubmissions = {};

  // Auto-submit for eliminated players and those with <=1 animal
  for (const [sid, p] of Object.entries(room.players)) {
    if (p.isSpectator) continue;
    if (p.eliminated || herdCount(p.herd) <= 1) {
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
  clearTimer(room);

  // Collect all punishments
  const punishments = {}; // targetSid -> [punisherSid, ...]
  const punishers = [];

  for (const [sid, sub] of Object.entries(room.phaseDSubmissions)) {
    if (sub.target && room.players[sub.target]) {
      if (!punishments[sub.target]) punishments[sub.target] = [];
      punishments[sub.target].push(sid);
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
        punishmentResults[punisherSid] = { punished: null, lost: null, wasTarget: false, punishedBy: 0, lostFromPunishment: [] };
      }
      punishmentResults[punisherSid].punished = target.name;
      punishmentResults[punisherSid].lost = punisherLost;

      if (!punishmentResults[targetSid]) {
        punishmentResults[targetSid] = { punished: null, lost: null, wasTarget: false, punishedBy: 0, lostFromPunishment: [] };
      }
      punishmentResults[targetSid].wasTarget = true;
      punishmentResults[targetSid].punishedBy++;
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
    const result = punishmentResults[sid] || { punished: null, lost: null, wasTarget: false, punishedBy: 0, lostFromPunishment: [] };
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
    totalTribute: room.roundSummary?.totalTributeValue || 0,
    totalPunishments: uniquePunishers,
    totalAnimalsLostToPunishment: totalAnimalsLost
  };
  room.history.push(roundData);

  // Show round results then check end conditions
  setTimeout(() => showRoundResults(room), 3000);
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

  // Check end conditions
  const shouldEnd = room.round >= MAX_ROUNDS || room.famineCount >= MAX_FAMINES ||
    (isPoolEmpty(room) && room.round > 0);

  if (shouldEnd) {
    setTimeout(() => endGame(room), 8000);
  } else {
    setTimeout(() => startRound(room), 8000);
  }
}

function endGame(room) {
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
  room.timerDuration = 20; // Shorter timers for Game 2
  room.totalFamineCount = room.famineCount; // preserve for stats
  initGame(room);
  room.phase = 'lobby';

  broadcastToRoom(room, 'game:reset', {
    gameNumber: 2,
    game1Results: room.game1Results
  });

  sendGameState(room);
}

// ─── Socket.io Connection Handling ───────────────────────────────────────────

io.on('connection', (socket) => {
  let currentRoom = null;
  let isInstructor = false;

  // Create room (instructor)
  socket.on('room:create', (callback) => {
    const room = createRoom();
    room.dashboardSocket = socket.id;
    currentRoom = room;
    isInstructor = true;
    if (callback) callback({ code: room.code });
  });

  // Join room (student)
  socket.on('room:join', ({ code, name }, callback) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) {
      if (callback) callback({ error: 'Nie znaleziono pokoju o tym kodzie.' });
      return;
    }

    // Check if name is taken
    const nameTaken = Object.values(room.players).some(p => p.name === name && !p.disconnected);
    if (nameTaken) {
      if (callback) callback({ error: 'Ta nazwa jest już zajęta.' });
      return;
    }

    // Check for reconnection
    const reconnectEntry = Object.entries(room.players).find(([, p]) => p.name === name && p.disconnected);
    if (reconnectEntry) {
      const [oldSid, oldPlayer] = reconnectEntry;
      // Transfer player to new socket
      delete room.players[oldSid];
      oldPlayer.socketId = socket.id;
      oldPlayer.disconnected = false;
      room.players[socket.id] = oldPlayer;
      currentRoom = room;

      if (callback) callback({ success: true, reconnected: true });
      io.to(socket.id).emit('game:state', getGameStateForPlayer(room, oldPlayer));
      broadcastDashboard(room, 'player:reconnected', { name, playerCount: getPlayerCount(room) });
      return;
    }

    const player = {
      socketId: socket.id,
      name: name.substring(0, 20),
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

  // Dashboard joins room
  socket.on('dashboard:join', ({ code }, callback) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) {
      if (callback) callback({ error: 'Room not found' });
      return;
    }
    room.dashboardSocket = socket.id;
    currentRoom = room;
    isInstructor = true;
    if (callback) callback({ success: true });
    io.to(socket.id).emit('game:state', getGameStateForDashboard(room));
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

  // Phase A submission
  socket.on('phaseA:submit', (data) => {
    if (!currentRoom) return;
    const room = currentRoom;
    const player = room.players[socket.id];
    if (!player || player.isSpectator || player.eliminated) return;
    if (room.phase !== 'phaseA') return;
    if (room.phaseASubmissions[socket.id]) return; // already submitted

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

    // Notify dashboard of submission count
    const count = Object.keys(room.phaseASubmissions).length;
    const total = getPlayerCount(room);
    broadcastDashboard(room, 'submission:count', { phase: 'phaseA', count, total });
    broadcastToRoom(room, 'submission:count', { phase: 'phaseA', count, total });

    // Check if all submitted
    if (count >= total) {
      resolvePhaseA(room);
    }
  });

  // Phase C submission
  socket.on('phaseC:submit', ({ type }) => {
    if (!currentRoom) return;
    const room = currentRoom;
    const player = room.players[socket.id];
    if (!player || player.isSpectator || player.eliminated) return;
    if (room.phase !== 'phaseC') return;
    if (room.phaseCSubmissions[socket.id]) return;

    if (herdCount(player.herd) <= 1) {
      room.phaseCSubmissions[socket.id] = { type: null, exempt: true };
    } else if (type && ANIMAL_TYPES.includes(type) && player.herd[type] > 0) {
      room.phaseCSubmissions[socket.id] = { type };
    } else {
      return; // invalid
    }

    const count = Object.keys(room.phaseCSubmissions).length;
    const total = getPlayerCount(room);
    broadcastDashboard(room, 'submission:count', { phase: 'phaseC', count, total });
    broadcastToRoom(room, 'submission:count', { phase: 'phaseC', count, total });

    if (count >= total) {
      resolvePhaseC(room);
    }
  });

  // Phase D submission
  socket.on('phaseD:submit', ({ target }) => {
    if (!currentRoom) return;
    const room = currentRoom;
    const player = room.players[socket.id];
    if (!player || player.isSpectator || player.eliminated) return;
    if (room.phase !== 'phaseD') return;
    if (room.phaseDSubmissions[socket.id]) return;

    if (herdCount(player.herd) <= 1) {
      room.phaseDSubmissions[socket.id] = { target: null, cannotPunish: true };
    } else {
      room.phaseDSubmissions[socket.id] = { target: target || null };
    }

    const count = Object.keys(room.phaseDSubmissions).length;
    const total = getPlayerCount(room);
    broadcastDashboard(room, 'submission:count', { phase: 'phaseD', count, total });
    broadcastToRoom(room, 'submission:count', { phase: 'phaseD', count, total });

    if (count >= total) {
      resolvePhaseD(room);
    }
  });

  // ─── Instructor Controls ────────────────────────────────────────────

  socket.on('instructor:pause', () => {
    if (!currentRoom || !isInstructor) return;
    currentRoom.isPaused = true;
    clearTimer(currentRoom);
    broadcastToRoom(currentRoom, 'game:paused', {});
  });

  socket.on('instructor:resume', () => {
    if (!currentRoom || !isInstructor) return;
    currentRoom.isPaused = false;
    broadcastToRoom(currentRoom, 'game:resumed', {});
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
    const player = currentRoom.players[playerId];
    if (player) {
      io.to(playerId).emit('kicked', {});
      delete currentRoom.players[playerId];
      broadcastDashboard(currentRoom, 'player:left', {
        name: player.name,
        playerCount: getPlayerCount(currentRoom)
      });
    }
  });

  socket.on('instructor:setTimer', ({ duration }) => {
    if (!currentRoom || !isInstructor) return;
    currentRoom.timerDuration = Math.min(60, Math.max(15, duration));
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

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Wspólne Pastwisko server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to start`);
});

module.exports = { server, io, rooms, ANIMALS, ANIMAL_TYPES, herdValue, herdCount, giniCoefficient, addValueAsAnimals };
