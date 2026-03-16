# Wspólne Pastwisko

A browser-based multiplayer game demonstrating the "Tragedy of the Commons" for university classroom use. Based on Jarosław Flis's board game "Wspólne Pastwisko" (Common Pasture).

Players are farmers sharing a common pasture. They raise animals (rabbits, sheep, pigs, cows) that require different amounts of pasture. If the total herd exceeds pasture capacity, famine strikes. The goal is to build the largest herd — but greed destroys the commons.

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

- **Students** open the URL on their phones and tap "Dołącz do gry"
- **Instructor** opens the dashboard on a projector and clicks "Panel prowadzącego"

## Game Structure

The game runs two sequential sessions:

1. **Game 1 — Without Communication:** Students play in silence. Demonstrates the tragedy of the commons.
2. **Game 2 — With Communication:** Students can talk freely. Demonstrates Ostrom's insight about commons governance.

## Deployment

### Render.com (Free Tier)

1. Push your code to a GitHub repository
2. Go to [render.com](https://render.com) and sign in
3. Click **New** → **Web Service**
4. Connect your GitHub repo
5. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
6. Click **Create Web Service**
7. Your app will be available at `https://your-app.onrender.com`

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (from project directory)
fly launch

# Deploy
fly deploy
```

### Docker

```bash
docker build -t wspolne-pastwisko .
docker run -p 3000:3000 wspolne-pastwisko
```

### Local Network (Classroom without Internet)

1. Connect your laptop and students' phones to the same Wi-Fi network
2. Find your local IP address:
   - **macOS:** `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - **Windows:** `ipconfig`
   - **Linux:** `hostname -I`
3. Run the server: `npm start`
4. Students open `http://<your-ip>:3000` on their phones
5. The room code is displayed on the dashboard projected from your laptop

## Environment Variables

- `PORT` — Server port (default: 3000)

## Tech Stack

- Node.js + Express + Socket.io
- Vanilla HTML/CSS/JS (no frameworks)
- Chart.js (CDN) for dashboard charts
- All state in memory (no database)

## Testing

```bash
npm test
```

Runs an automated simulation of a 6-player game verifying all core mechanics.
