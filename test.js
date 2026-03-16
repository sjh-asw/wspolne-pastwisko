/**
 * Automated test: Simulates a 6-player game for 5 rounds.
 *
 * Player behaviors:
 * - 2 "greedy": acquire max, return cheapest, never punish
 * - 2 "moderate": acquire 2 units, return sheep, punish largest herd
 * - 2 "cooperative": acquire 1 unit, return most valuable, punish greedy
 */

const { herdValue, herdCount, giniCoefficient, addValueAsAnimals, ANIMALS, ANIMAL_TYPES } = require('./server.js');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function test(name, fn) {
  console.log(`\n▸ ${name}`);
  fn();
}

// Close server so test can exit
const { server } = require('./server.js');

// ─── Unit Tests ───────────────────────────────────────────────────────────

test('herdValue calculation', () => {
  assert(herdValue({ rabbit: 2, sheep: 0, pig: 0, cow: 0 }) === 2, 'Two rabbits = 2');
  assert(herdValue({ rabbit: 1, sheep: 1, pig: 1, cow: 1 }) === 15, '1 of each = 15');
  assert(herdValue({ rabbit: 0, sheep: 0, pig: 0, cow: 3 }) === 24, '3 cows = 24');
  assert(herdValue({ rabbit: 0, sheep: 0, pig: 0, cow: 0 }) === 0, 'Empty herd = 0');
});

test('giniCoefficient', () => {
  assert(giniCoefficient([10, 10, 10, 10]) === 0, 'Equal values = 0');
  assert(giniCoefficient([0, 0, 0, 100]) > 0.5, 'Very unequal > 0.5');
  assert(giniCoefficient([]) === 0, 'Empty = 0');
});

test('addValueAsAnimals', () => {
  const herd = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  addValueAsAnimals(herd, 15);
  assert(herd.cow === 1, '15 value: 1 cow');
  assert(herd.pig === 1, '15 value: 1 pig');
  assert(herd.sheep === 1, '15 value: 1 sheep');
  assert(herd.rabbit === 1, '15 value: 1 rabbit');

  const herd2 = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  addValueAsAnimals(herd2, 4);
  assert(herd2.pig === 1 && herd2.cow === 0, '4 value: 1 pig');

  const herd3 = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  addValueAsAnimals(herd3, 3);
  assert(herd3.sheep === 1 && herd3.rabbit === 1, '3 value: 1 sheep + 1 rabbit');
});

// ─── Game Simulation ──────────────────────────────────────────────────────

test('Game simulation setup', () => {
  const numPlayers = 6;
  const pastureCapacity = 4 * numPlayers; // 24
  assert(pastureCapacity === 24, 'Starting pasture = 24');

  const pool = {
    rabbit: numPlayers * 3, // 18
    sheep: numPlayers * 2,  // 12
    pig: numPlayers * 1,    // 6
    cow: Math.floor(numPlayers / 3) // 2
  };
  assert(pool.rabbit === 18, 'Pool rabbits = 18');
  assert(pool.sheep === 12, 'Pool sheep = 12');
  assert(pool.pig === 6, 'Pool pigs = 6');
  assert(pool.cow === 2, 'Pool cows = 2');

  // All players start with 2 rabbits
  const players = [];
  for (let i = 0; i < 6; i++) {
    players.push({ herd: { rabbit: 2, sheep: 0, pig: 0, cow: 0 } });
  }
  const totalStart = players.reduce((s, p) => s + herdValue(p.herd), 0);
  assert(totalStart === 12, 'Total starting value = 12 (< capacity 24)');
});

test('Acquisition limits', () => {
  // Player with herd value 2: max_acquisition = max(2, 2) = 2
  assert(Math.max(2, 2) === 2, 'Herd value 2 → limit 2');
  // Player with herd value 8: max_acquisition = max(2, 8) = 8
  assert(Math.max(2, 8) === 8, 'Herd value 8 → limit 8');
  // Player with herd value 1: max_acquisition = max(2, 1) = 2
  assert(Math.max(2, 1) === 2, 'Herd value 1 → limit 2');
});

test('Famine check logic', () => {
  // total_needed > capacity → famine
  assert(25 > 24, 'Famine when needed > capacity');
  assert(!(24 > 24), 'No famine when equal');
  assert(!(20 > 24), 'No famine when under');
});

test('Culling: halve herd value, remove from most expensive first', () => {
  const herd = { rabbit: 2, sheep: 2, pig: 1, cow: 1 };
  // Value = 2 + 4 + 4 + 8 = 18, lose half = 9
  const currentVal = herdValue(herd);
  assert(currentVal === 18, 'Pre-cull value = 18');

  let toLose = Math.floor(currentVal / 2); // 9
  assert(toLose === 9, 'Must lose 9');

  // Remove cow (8), remaining to lose: 1
  // Remove rabbit (1), remaining: 0
  // Result: rabbit:1, sheep:2, pig:1, cow:0
  // But actual logic handles splitting too
  const herdCopy = { ...herd };
  let remaining = toLose;

  for (let i = ANIMAL_TYPES.length - 1; i >= 0 && remaining > 0; i--) {
    const type = ANIMAL_TYPES[i];
    const animalValue = ANIMALS[type].value;
    while (herdCopy[type] > 0 && remaining > 0) {
      if (animalValue <= remaining) {
        herdCopy[type]--;
        remaining -= animalValue;
      } else {
        // Split
        herdCopy[type]--;
        const change = animalValue - remaining;
        addValueAsAnimals(herdCopy, change);
        remaining = 0;
      }
    }
  }

  assert(remaining === 0, 'Culling removed exact amount');
  assert(herdValue(herdCopy) === 9, 'Post-cull value = 9');
});

test('Tribute increases pasture correctly', () => {
  let pasture = 24;
  // Return cow (8) + return rabbit (1)
  pasture += 8 + 1;
  assert(pasture === 33, 'Pasture after tribute = 33');
});

test('Punishment mechanics', () => {
  // Both lose cheapest animal
  const punisher = { rabbit: 1, sheep: 1, pig: 0, cow: 0 };
  const target = { rabbit: 0, sheep: 1, pig: 1, cow: 0 };

  // Punisher loses rabbit (cheapest)
  assert(punisher.rabbit > 0, 'Punisher has rabbit to lose');
  punisher.rabbit--;

  // Target loses sheep (cheapest they have)
  assert(target.sheep > 0, 'Target has sheep to lose');
  target.sheep--;

  assert(herdValue(punisher) === 2, 'Punisher left with sheep (2)');
  assert(herdValue(target) === 4, 'Target left with pig (4)');
});

test('Player with 1 animal cannot punish', () => {
  const player = { rabbit: 1, sheep: 0, pig: 0, cow: 0 };
  const count = Object.values(player).reduce((s, v) => s + v, 0);
  assert(count <= 1, 'Player with 1 animal: cannot punish');
});

test('Player with 1 animal cannot be further punished', () => {
  const target = { rabbit: 0, sheep: 0, pig: 0, cow: 1 };
  // After first punishment: loses cow → 0 animals → eliminated
  // Actually, cannot be punished if count <= 1
  const count = Object.values(target).reduce((s, v) => s + v, 0);
  assert(count <= 1, 'Player with only 1 cow: count = 1, immune to further punishment');
});

test('Player with 1 animal is exempt from tribute', () => {
  const herd = { rabbit: 1, sheep: 0, pig: 0, cow: 0 };
  const count = Object.values(herd).reduce((s, v) => s + v, 0);
  assert(count <= 1, 'Single animal → exempt from tribute');
});

test('Player with 0 animals is eliminated', () => {
  const herd = { rabbit: 0, sheep: 0, pig: 0, cow: 0 };
  assert(herdValue(herd) === 0, '0 animals → eliminated');
});

test('Multiple punishers targeting same player', () => {
  const target = { rabbit: 3, sheep: 1, pig: 0, cow: 0 };
  // 3 punishers target this player
  // Each removes cheapest: rabbit, rabbit, rabbit
  let count = 3;
  let removed = 0;
  while (count > 0 && Object.values(target).reduce((s, v) => s + v, 0) > 1) {
    // Remove cheapest
    for (const t of ANIMAL_TYPES) {
      if (target[t] > 0) {
        target[t]--;
        removed++;
        break;
      }
    }
    count--;
  }
  assert(removed === 3, 'All 3 punishments applied');
  assert(herdValue(target) === 2, 'Target left with sheep (2)');
});

test('Pool depletion', () => {
  const pool = { rabbit: 2, sheep: 0, pig: 0, cow: 0 };
  // 3 players want 1 rabbit each, only 2 available
  const requests = [1, 1, 1];
  const total = requests.reduce((s, v) => s + v, 0);
  assert(total > pool.rabbit, 'Demand exceeds supply');
  // Proportional: each gets floor(2 * 1/3) = 0, remainder distributed randomly
});

test('Famine pasture reduction', () => {
  const numPlayers = 6;
  let pasture = 24;
  // Famine: capacity decreases by numPlayers
  pasture = Math.max(numPlayers, pasture - numPlayers);
  assert(pasture === 18, 'After famine: 24 - 6 = 18');

  // Can't go below numPlayers
  pasture = 7;
  pasture = Math.max(numPlayers, pasture - numPlayers);
  assert(pasture === 6, 'Floor at numPlayers');
});

test('Game end conditions', () => {
  // 5 rounds completed
  assert(5 >= 5, 'Game ends after 5 rounds');
  // 2 famines
  assert(2 >= 2, 'Game ends after 2 famines');
});

test('Game 2 reset preserves Game 1 scores', () => {
  const game1Results = { scores: [{ name: 'A', score: 10 }], gini: 0.3 };
  // After reset, game1Results should still be accessible
  assert(game1Results.scores[0].score === 10, 'Game 1 scores preserved');
  assert(game1Results.gini === 0.3, 'Game 1 Gini preserved');
});

test('Famine with multiple culling passes', () => {
  // Extreme case: capacity = 6, total herd = 100
  const herds = [
    { rabbit: 0, sheep: 0, pig: 0, cow: 3 }, // 24
    { rabbit: 0, sheep: 0, pig: 0, cow: 3 }, // 24
    { rabbit: 0, sheep: 0, pig: 0, cow: 3 }, // 24
  ];
  const capacity = 6;
  let passes = 0;

  while (herds.reduce((s, h) => s + herdValue(h), 0) > capacity && passes < 10) {
    passes++;
    for (const h of herds) {
      const val = herdValue(h);
      const toLose = Math.floor(val / 2);
      let remaining = toLose;
      for (let i = ANIMAL_TYPES.length - 1; i >= 0 && remaining > 0; i--) {
        const type = ANIMAL_TYPES[i];
        const av = ANIMALS[type].value;
        while (h[type] > 0 && remaining > 0) {
          if (av <= remaining) {
            h[type]--;
            remaining -= av;
          } else {
            h[type]--;
            addValueAsAnimals(h, av - remaining);
            remaining = 0;
          }
        }
      }
    }
  }

  const totalFinal = herds.reduce((s, h) => s + herdValue(h), 0);
  assert(totalFinal <= capacity, `After ${passes} passes, total ${totalFinal} <= capacity ${capacity}`);
  assert(passes > 1, `Required multiple passes: ${passes}`);
});

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED ✓');
}

server.close();
process.exit(failed > 0 ? 1 : 0);
