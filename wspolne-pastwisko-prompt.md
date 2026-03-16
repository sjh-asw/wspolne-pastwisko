# Prompt for Claude Code: "Wspólne Pastwisko" — Digitalized Classroom Multiplayer Game

## Context

I need a browser-based multiplayer game that demonstrates the "Tragedy of the Commons" for a university Environmental Sociology class (28–33 students, 90-minute session). The game is based on Jarosław Flis's board game "Wspólne Pastwisko" (Common Pasture), adapted for simultaneous digital play.

Players are farmers sharing a common pasture. They raise animals of different types (rabbits, sheep, pigs, cows) that require different amounts of pasture. If the total herd exceeds pasture capacity, famine strikes and herds are culled. The goal is to build the largest herd (by value) — but greed destroys the commons.

The instructor displays a dashboard on a projector. Students play on their phones.

---

## Game Mechanics (adapted from Flis's design)

### Animals
Four animal types, each with a **value** that equals both its score worth AND the amount of pasture it needs:

| Animal   | Polish name | Value / Pasture cost |
|----------|-------------|---------------------|
| Rabbit   | Królik      | 1                   |
| Sheep    | Owca        | 2                   |
| Pig      | Świnia      | 4                   |
| Cow      | Krowa       | 8                   |

### Pasture
- **Starting pasture capacity** = `4 × number_of_players` (e.g., 30 players → capacity 120)
- Pasture capacity is tracked as a single integer and displayed to all players
- The pasture can grow or shrink during the game

### Starting Conditions
- Each player begins with **2 rabbits** (total herd value = 2)
- A shared **animal pool** contains a finite supply of animals available for acquisition. Starting pool: `number_of_players × 3` rabbits, `number_of_players × 2` sheep, `number_of_players × 1` pigs, `floor(number_of_players / 3)` cows. These are the animals available to take — when the pool is empty, no more animals can be acquired.

### Round Structure (each round = 1 "year")

Each round has **4 phases**, executed in sequence:

---

#### PHASE A: "Dobranie zwierząt" (Acquire Animals)

**All players decide simultaneously** (this is the key simplification from the board game).

Each player may acquire up to **2 units of pasture value** worth of new animals from the shared pool. Exception: if a player's current herd value is > 2, they may acquire up to **as many units as they already own** (representing economic power — richer farmers can acquire more).

Concretely, the acquisition limit per player per round is:
```
max_acquisition = max(2, current_herd_value)
```

The player sees the available animals in the pool and picks what they want, up to their limit. They can pick any combination (e.g., 1 sheep = 2 units, or 2 rabbits = 2 units, or 1 pig = 4 units if their herd is already ≥ 4).

**Conflict resolution for limited pool:** All players submit their choices simultaneously. If total demand for a given animal type exceeds supply, distribute proportionally with random tiebreaking. Players who requested unavailable animals get nothing for those slots (no substitution). Show them what they actually received.

After all acquisitions, reveal the new total herd sizes on the dashboard.

---

#### PHASE B: "Klęska głodu" (Famine Check)

**This is automatic — no player decisions needed.**

Calculate total pasture needed by all herds:
```
total_needed = sum of (each player's herd value)
```

**If `total_needed <= pasture_capacity`:** No famine. Proceed to Phase C.

**If `total_needed > pasture_capacity`:** FAMINE STRIKES.

Famine resolution:
1. The pasture is "trampled" — capacity decreases by `number_of_players` (the pasture shrinks permanently, representing ecological degradation). Minimum capacity = number_of_players (it cannot go below this floor).
2. Each player loses **half their herd value** (rounded down). The server automatically removes animals starting from the most valuable ones. When removing, if an animal's full value would exceed the remaining "debt," it is converted into smaller animals worth the difference (e.g., losing a cow worth 8 but only needing to lose 4 more → cow is replaced by pig worth 4, and the pig is what remains). Lost animal tokens return to the shared pool.
3. After culling, check again: if `total_needed` is STILL greater than `pasture_capacity`, repeat the culling (halve again). Continue until herds fit the pasture. (In practice, one round of culling almost always suffices.)

**Famine counter:** Track the number of famines. Display prominently on dashboard.

---

#### PHASE C: "Danina" (Tribute / Contribution to the Commons)

**All players decide simultaneously.**

Each player MUST return exactly **one animal** from their herd to the shared pool. They choose which one. They cannot return their last animal — if a player has only 1 animal, they are exempt from tribute.

The pasture grows by the total pasture value of all returned animals:
```
pasture_capacity += sum of (value of all returned animals)
```

This represents the commons being replenished through collective contribution. Crucially, returning a cow (value 8) helps the pasture much more than returning a rabbit (value 1) — but costs the player more. This is the core cooperation/free-rider tension.

Returned animal tokens go back to the shared pool (available for future acquisition).

---

#### PHASE D: "Porachunki" (Reckoning / Costly Punishment)

**All players decide simultaneously.**

Each player MAY (but doesn't have to) punish **one** other player. This is optional — you can skip this phase by clicking "Nie karuję nikogo" (I punish no one).

If a player chooses to punish someone:
- The punisher selects a target from a list of all other players (shown with display names and herd values)
- **Both** the punisher and the target lose one animal. The server removes the **cheapest animal** each of them owns.
- If a player is targeted by multiple punishers, they lose one animal per punisher (but never their last animal — a player with only 1 animal cannot be punished further).
- A punisher who has only 1 animal cannot punish anyone (they'd lose their last animal).

Lost animals go back to the shared pool.

This models **costly punishment** (altruistic punishment in the behavioral economics literature): enforcing norms costs the enforcer too. In Game 1 (no communication), punishment is blind — players don't know others' intentions. In Game 2 (with communication), players can warn, threaten, and coordinate punishment collectively, making it far more effective as a governance tool.

**Dashboard display for Phase D:**
- Live counter: "Porachunki: 14/30 ✓"
- After resolution: anonymized network summary — "8 graczy ukarało kogoś. 3 osoby były karane." (8 players punished someone. 3 people were punished.)
- Bar chart showing number of punishments received per player (named or anonymous — configurable by instructor toggle)
- Total animals lost to punishment this round

---

### End Conditions
The game ends when ANY of these occur:
- **5 rounds** have been completed
- **2 famines** have occurred (after the 2nd famine, the game ends immediately at end of that round)
- The shared **animal pool is completely empty** AND all players have made their Phase A choices (nothing left to acquire)
- The **instructor manually ends the game**

### Scoring
Each player's score = **total value of their surviving herd** at game end.
- Rabbit = 1 point, Sheep = 2, Pig = 4, Cow = 8
- Display a ranked scoreboard at the end

### Two Phases of Play (Pedagogical Structure)

The game session supports **two sequential games**:

**Game 1 — "Bez komunikacji" (No Communication):** Students play in silence. No talking allowed in the classroom. This demonstrates the tragedy — individual rationality leads to collective ruin.

**Game 2 — "Z komunikacją" (With Communication):** Instructor resets everything (new pasture, new starting herds, refilled pool) but keeps Game 1 scores visible for comparison. Now students can talk freely in the classroom. This demonstrates Ostrom's insight: communication, trust, and social norms enable commons governance.

The instructor dashboard needs a **"Reset — Start Game 2"** button that:
- Preserves Game 1 final scores and famine count for comparison
- Resets pasture, herds (2 rabbits each), and pool to starting values
- Marks the session as "Game 2 — With Communication"
- **Automatically reduces all phase timers to 20 seconds** (from 30s in Game 1) — students already know the interface, and shorter timers keep the pace up to fit both games + debriefing in 90 minutes

---

## Technical Requirements

### Stack
- **Backend:** Node.js + Express + Socket.io
- **Frontend:** Vanilla HTML + CSS + JavaScript (NO React, NO frameworks)
- **No database:** All state in memory
- **Single codebase**, one `package.json`

### Three Views

**1. Landing Page (`/`)**
Simple choice: "Dołącz do gry" (Join Game) or "Panel prowadzącego" (Instructor Dashboard). Clean, centered, mobile-friendly.

**2. Student View (`/play`)**
Mobile-first. Must work on any phone. All interactions via large touch buttons.

Screens (switch between them based on game state):

- **Lobby screen:** Enter room code (4 characters) + display name → "Dołącz" button → waiting screen showing "Oczekiwanie na rozpoczęcie gry..." with player count

- **Phase A screen (Acquire):**
  - Top bar: Round number, current pasture capacity, your herd value, timer countdown
  - "Your herd" display: show icons/emoji for each animal you own (🐇🐑🐷🐄), grouped by type with count
  - "Available in pool" display: show counts of each animal type remaining
  - "Your acquisition budget: X units" 
  - 4 rows, one per animal type. Each row: animal icon + name + value + a +/- stepper or quantity selector (0 to max affordable). Disable animals that aren't available in pool or exceed budget.
  - Running total: "Wybrano: X / Y jednostek" (Selected: X / Y units)
  - Big "Zatwierdź" (Confirm) button
  - After confirming: "Oczekiwanie na innych graczy... (15/30)" with count

- **Famine screen (if famine occurs):**
  - Red/orange warning screen: "KLĘSKA GŁODU! 🔥"
  - Show what was lost: "Straciłeś: 1 krowę, 1 owcę" 
  - Show remaining herd
  - Auto-advance after 8 seconds (or tap to continue)

- **Phase C screen (Tribute):**
  - "Oddaj jedno zwierzę na wspólne pastwisko" (Return one animal to the common pasture)
  - Show your herd with selectable animal buttons
  - Tap an animal to select it → "Zatwierdź daninę" (Confirm tribute) button
  - If player has only 1 animal: show "Jesteś zwolniony z daniny" (You are exempt) and auto-skip

- **Phase D screen (Reckoning):**
  - "Porachunki — czy chcesz ukarać innego gracza?" (Reckoning — do you want to punish another player?)
  - Explanation text: "Kara kosztuje! Ty i wybrany gracz tracicie po jednym zwierzęciu." (Punishment costs! You and the chosen player each lose one animal.)
  - Scrollable list of all other players showing: display name + current herd value. Tap to select.
  - Two big buttons: "Karuję: [selected name]" (I punish: [name]) and "Nie karuję nikogo" (I punish no one)
  - If player has only 1 animal: show "Nie możesz karać — masz tylko jedno zwierzę" (You cannot punish — you only have one animal) and auto-skip
  - After confirming: "Oczekiwanie na innych graczy..."
  - Result screen: "Nikt cię nie ukarał" / "Ukarało cię X graczy. Straciłeś: [animals]" — and if you punished: "Ukarałeś [name]. Straciłeś: [animal]"

- **Round results screen:**
  - Your herd (with icons), your herd value
  - Pasture capacity (with trend arrow ↑↓)
  - Brief round summary: total acquired by group, famine yes/no, total tribute
  - "Następna runda..." (Next round...) — auto-advance after 10 seconds or tap

- **Game over screen:**
  - Your final score + rank
  - "Gra zakończona!" (Game over!)
  - If Game 1 ended: "Prowadzący przygotowuje Grę 2..."

**3. Instructor Dashboard (`/dashboard`)**
Designed for projector. Large fonts, high contrast on light background. Landscape-oriented.

Screens:

- **Setup screen:**
  - Room code displayed VERY LARGE (200px+ font) so students see it from the back
  - URL to share (e.g., "Wejdź na: [url]")
  - List of connected players (names, auto-scrolling if >15)
  - Player count: "Połączonych graczy: 28"
  - "Rozpocznij Grę 1 — Bez komunikacji" button (only active when ≥ 2 players)

- **Game screen (main dashboard during play):**
  - **Top bar:** Game number (1 or 2), Round number, Phase name, Timer
  - **Left panel (60% width):**
    - **Pasture meter:** Large visual bar showing `total_herd_value / pasture_capacity`. 
      - Green when < 60% full
      - Yellow when 60-80%
      - Orange when 80-95%
      - Red when > 95% (imminent famine)
      - Show both numbers: "Zajętość: 87 / 120" (Occupancy: 87 / 120)
    - **Pasture history chart:** Line chart (use Chart.js) showing pasture capacity over rounds (one line) and total herd value over rounds (another line). When they cross = famine. This is the KEY visual for debriefing.
    - **Famine counter:** "Klęski głodu: 0/2" with skull icons ☠️
  - **Right panel (40% width):**
    - **Phase A:** "Decyzje: 14/30 ✓" live counter. Then after resolution: bar chart of how much each player acquired this round (sorted descending). Also show pool depletion.
    - **Phase C:** "Daniny: 20/30 ✓" live counter. Then after resolution: breakdown of what was returned (e.g., "5 krów, 8 owiec, 12 królików → pastwisko +42")
    - **Phase D:** "Porachunki: 14/30 ✓" live counter. Then after resolution: anonymized summary — "8 graczy ukarało kogoś. 3 osoby były karane." Bar chart showing punishments received per player (instructor can toggle named/anonymous via a button). Total animals lost to punishment this round.
    - **Leaderboard (always visible):** Top 5 players by herd value, with animal breakdown. Also show bottom 3 (to highlight inequality).

- **Between-game comparison screen (after Game 1, before Game 2):**
  - Side-by-side stats: Game 1 results
  - "Reset — Rozpocznij Grę 2 — Z komunikacją" button
  - After Game 2: side-by-side comparison of both games:
    - Rounds survived
    - Famines occurred
    - Final average herd value
    - Gini coefficient of herd values (inequality measure — very useful for sociology debriefing!)
    - Total punishments issued (Game 1 vs Game 2 — expect big difference!)
    - Punishment effectiveness: did punished players reduce acquisition in subsequent rounds?
    - Pasture trajectory chart (both games overlaid)

- **Instructor controls (floating panel, toggleable):**
  - Pause / Resume game
  - Skip to next phase (if students are slow)
  - Kick player
  - Adjust timer duration (15s / 30s / 45s / 60s)
  - End game early
  - "Reset — Game 2" button

### Design & UX

**Color scheme:** Earthy greens and browns (pasture theme). 
- Pasture healthy: lush green (#4CAF50)
- Pasture stressed: yellow-brown (#FFC107 → #FF9800)
- Famine: deep red (#F44336)
- Background: warm off-white (#FFF8E1) for dashboard, dark (#2E2E2E) for student phones
- Accents: warm wood brown (#795548)

**Animal display:** Use emoji throughout: 🐇 🐑 🐷 🐄. Large size on phones (32px+). On dashboard, show both emoji and counts.

**Typography:** 
- Dashboard: large, legible sans-serif (system fonts). Room code in monospace, 200px+.
- Student view: minimum 18px body text, 24px+ for numbers and choices

**Animations (subtle, not distracting):**
- Pasture meter fills/drains smoothly
- Famine screen: brief screen shake or red flash
- New animals appear with a gentle fade-in
- Tribute: animal "flies" off screen toward center (representing the commons)

**Sound (optional, off by default, toggle on dashboard):**
- Gentle "moo" / animal sound on acquisition
- Ominous rumble on famine
- Positive chime on tribute

**Responsiveness:**
- Student view: portrait phone only, 320px-428px width range
- Dashboard: landscape, 1024px+ width, optimized for 1920×1080 projector

### Robustness
- **Disconnection:** If a student disconnects during a phase, treat as: Phase A = acquire nothing, Phase C = return cheapest animal. If they reconnect within the same round, restore their state. If they reconnect in a later round, they rejoin with whatever herd they had.
- **Late joins:** Students who join after Round 1 start with 2 rabbits but missed earlier rounds. Their score reflects only what they have.
- **Timer expiry:** If a player doesn't submit before timer, apply defaults (acquire nothing / return cheapest animal) and move on. Don't let one slow player block 29 others.
- **Edge cases:**
  - Player with 0 animals (all died in famine): they are "eliminated" but stay connected to watch. They can rejoin in Game 2.
  - Pool completely empty: Phase A is auto-skipped.
  - All players exempt from tribute: Phase C is auto-skipped.

---

## Deployment
- Include `Dockerfile`
- Include `README.md` with:
  - Quick start: `npm install && npm start`
  - Render.com free tier deployment instructions (step by step)
  - Fly.io alternative instructions
  - Local network instructions (for cases where internet is not reliable in classroom — run on laptop, students connect via local IP)
- Default port: 3000, configurable via `PORT` env variable
- Single `package.json` with minimal dependencies: express, socket.io, (optionally) chart.js served from CDN

## Project Structure
```
wspolne-pastwisko/
├── server.js              # Express + Socket.io server, ALL game logic
├── package.json
├── Dockerfile
├── README.md
├── public/
│   ├── index.html         # Landing page (join or dashboard)
│   ├── play.html          # Student game view
│   ├── dashboard.html     # Instructor dashboard
│   ├── css/
│   │   ├── common.css     # Shared variables, reset, typography
│   │   ├── play.css       # Student view styles
│   │   └── dashboard.css  # Dashboard styles
│   └── js/
│       ├── play.js        # Student Socket.io logic + UI
│       └── dashboard.js   # Instructor Socket.io logic + UI + charts
```

## Language
ALL user-facing text in **Polish**. Code comments and README in English.

Key strings (use these exactly):
- Game title: "Wspólne Pastwisko"
- Subtitle: "Gra o tragedii wspólnego pastwiska"
- "Dołącz do gry" / "Panel prowadzącego"
- "Kod pokoju" / "Twoja nazwa" / "Dołącz"
- "Runda X z 5" / "Faza A: Dobranie zwierząt" / "Faza B: Klęska głodu" / "Faza C: Danina" / "Faza D: Porachunki"
- "Twoje stado" / "Wartość stada: X"
- "Pojemność pastwiska: X" / "Zajętość: X / Y"
- "Dostępne w puli" / "Twój limit: X jednostek"
- "Zatwierdź" / "Oczekiwanie na innych graczy..."
- "KLĘSKA GŁODU!" / "Straciłeś:" / "Pozostaje ci:"
- "Oddaj jedno zwierzę na wspólne pastwisko"
- "Zatwierdź daninę" / "Jesteś zwolniony z daniny"
- "Porachunki — czy chcesz ukarać innego gracza?"
- "Kara kosztuje! Ty i wybrany gracz tracicie po jednym zwierzęciu."
- "Karuję: [imię]" / "Nie karuję nikogo"
- "Nie możesz karać — masz tylko jedno zwierzę"
- "Nikt cię nie ukarał" / "Ukarało cię X graczy. Straciłeś:"
- "X graczy ukarało kogoś. Y osób było karanych."
- "Gra zakończona!" / "Tabela wyników" / "Twój wynik: X punktów"
- "Gra 1: Bez komunikacji" / "Gra 2: Z komunikacją"
- "Rozpocznij grę" / "Pauza" / "Wznów" / "Zakończ grę"
- "Reset — Rozpocznij Grę 2"
- Animals: "Królik (1)" / "Owca (2)" / "Świnia (4)" / "Krowa (8)"
- "Połączonych graczy:" / "Decyzje:" / "Daniny:" / "Porachunki:"

## What NOT to Build
- No user auth or accounts
- No database or persistence
- No in-app chat (communication happens face-to-face)
- No complex 3D graphics
- No admin panel beyond dashboard controls

## Automated Testing Before Delivery

Simulate a 6-player game for 5 rounds with these behaviors:
- 2 "greedy" players: always acquire max, always return cheapest animal (rabbit), never punish anyone
- 2 "moderate" players: acquire 2 units per round, return sheep, punish the player with the largest herd
- 2 "cooperative" players: acquire 1 unit per round, return most valuable animal they have, punish greedy players

Verify:
1. Pasture capacity starts at 24 (4 × 6 players)
2. All players start with 2 rabbits (value 2 each, total 12)
3. Phase A: acquisition limits are correct (greedy players with growing herds get bigger limits)
4. Phase B: famine triggers correctly when total value > capacity
5. Phase B: culling removes half value starting from most expensive animals
6. Phase C: tribute increases pasture by correct amount
7. Phase D: punishment correctly removes one animal from both punisher and target
8. Phase D: player with 1 animal cannot punish or be punished further
9. Phase D: multiple punishers targeting same player each remove one animal
10. Game ends after 5 rounds or 2 famines
11. Scoreboard is correct
12. Pool depletion works (animals run out over time)
13. Game 2 reset preserves Game 1 scores

Also test edge cases:
- Player with only 1 animal is exempt from tribute
- Player with only 1 animal cannot initiate punishment
- Player with only 1 animal cannot be punished (would lose last animal)
- Player with 0 animals is eliminated
- Pool runs out of a specific animal type mid-round
- Famine requires multiple culling passes
- Player targeted by 3 punishers loses 3 animals (but never last one)

## Final Checklist
- [ ] `npm install && npm start` works
- [ ] Student joins via phone, enters room code + name
- [ ] Instructor sees all players, starts game
- [ ] Phase A: students select animals, timer works, conflicts resolved
- [ ] Phase B: famine triggers correctly, culling is automatic, results shown
- [ ] Phase C: students choose tribute, pasture grows
- [ ] Phase D: students can punish or skip, both lose animals, dashboard shows summary
- [ ] Dashboard shows pasture chart, leaderboard, phase progress
- [ ] Game ends correctly (5 rounds or 2 famines)
- [ ] Game 2 reset works, comparison stats shown
- [ ] Gini coefficient calculated for final comparison
- [ ] All UI in Polish
- [ ] Handles 30 concurrent WebSocket connections
- [ ] Dockerfile and README with deployment instructions included
