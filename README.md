# ♟ Chess Academy

A beautiful, full-featured chess learning app built with React. Play against an AI at 5 difficulty levels, work through 17 interactive lessons, solve 20 tactical puzzles, and get real-time coaching from an AI tutor powered by Claude.

---

## Features

- **Play mode** — 5 difficulty levels (Beginner → Master) via Minimax + Alpha-Beta Pruning
- **Learn mode** — 17 lessons across Beginner, Intermediate, and Advanced tracks
- **Puzzle trainer** — 20 tactical puzzles: Mate, Fork, Pin, Skewer, Discovery, Endgame
- **AI tutor** — Live chat powered by Claude (Anthropic API)
- **Beautiful UI** — 5 board themes, move animations, eval bar, captured pieces
- **Sound effects** — Move, capture, check, castle, win/lose via Web Audio API
- **Timers** — 3 / 5 / 10 / 15 min time controls
- **Pawn promotion dialog**, opening detection, hint system, undo
- **Progress tracking** — lessons completed, puzzle streak, W/L/D record (persisted)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set your Anthropic API key
cp .env.example .env
# Edit .env → ANTHROPIC_API_KEY=sk-ant-your-key-here

# 3. Start (proxy + dev server together)
npm run dev
```

Open **http://localhost:5173**

---

## Project Structure

```
chess-academy/
├── src/
│   ├── chess-academy.jsx   ← entire app (AI engine, all screens)
│   ├── main.jsx            ← React entry point
│   └── index.css           ← global styles + CSS variables
├── api/
│   └── anthropic.js        ← Vercel/Netlify serverless proxy
├── public/                 ← static assets
├── proxy-server.js         ← local dev API proxy (Express)
├── vite.config.js
├── vercel.json
├── Dockerfile
├── nginx.conf
├── .env.example
└── package.json
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start proxy + Vite dev server together |
| `npm run dev:app` | Vite only (if proxy is already running) |
| `npm run dev:proxy` | Proxy server only |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |

---

## Deployment

### Vercel (recommended)
```bash
npm i -g vercel
vercel
# Set ANTHROPIC_API_KEY in Vercel dashboard → Environment Variables
```

### Docker
```bash
docker build -t chess-academy .
docker run -p 8080:80 chess-academy
```

### Manual
```bash
npm run build
# Deploy the dist/ folder to any static host (Netlify, S3, Cloudflare Pages…)
# Deploy proxy-server.js to Railway, Render, or Fly.io
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 |
| Chess logic | chess.js |
| AI engine | Custom Minimax + Alpha-Beta (depth 1–4) |
| AI tutor | Anthropic Claude API (claude-sonnet-4) |
| Build | Vite 5 |
| Styling | CSS-in-JS (inline styles + CSS variables) |
| Sounds | Web Audio API |
| Storage | Artifact Persistent Storage API |

---

## License

MIT
