# ♟ Chess Academy

A full-featured browser chess app — play vs AI, learn interactively, solve puzzles, and challenge friends online.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?style=flat-square&logo=supabase)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000?style=flat-square&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Features

**Play**
- 5 AI difficulty levels (Minimax + Alpha-Beta Pruning, depth 1–4)
- Pass-and-play local 2-player with auto-flip
- Move quality badges (Best / Inaccuracy / Mistake / Blunder)
- Eval bar, opening detection, captured pieces, hint system, undo, resign
- Optional time controls (1–10 min), pawn promotion dialog

**Online Multiplayer**
- Real-time via Supabase Realtime (Broadcast + Postgres Changes + Presence)
- Create or join games with a 6-character invite code
- Quick Match — auto-pairs with an open game or creates one
- Elo rating updated after every online result
- Draw offers, resign, abort, opponent online/offline indicator

**Learn**
- 17 interactive lessons across Beginner / Intermediate / Advanced tracks
- Free-play board for each lesson, pro tips, progress tracking

**Puzzles**
- 20 tactical puzzles — Mate in 1/2, Fork, Pin, Skewer, Discovery, Endgame
- Streak tracking, category filter, contextual hints, auto-advance opponent reply

**AI Tutor**
- Powered by Groq (proxied server-side — key never exposed to browser)
- Context-aware: knows current FEN, recent moves, lesson/puzzle
- Quick-prompt buttons, conversation history, rate-limit cooldown

**Profile & Leaderboard**
- Supabase auth (email/password + Google OAuth), guest mode
- Game history, W/L/D stats, Elo, lesson/puzzle progress
- Global leaderboard ranked by Elo

**UI**
- 8 board themes, light/dark mode (OS preference), sound effects
- Drag-and-drop + click-to-move on all boards

---

## Tech Stack

| Layer | Tech |
|---|---|
| UI | React 18 + Vite 5 |
| Chess logic | chess.js |
| AI opponent | Custom Minimax + Alpha-Beta |
| AI tutor | Groq API (server-side proxy) |
| Auth + DB + Realtime | Supabase |
| Hosting | Vercel |

---

## Project Structure

```
chess-academy/
├── src/
│   ├── chess-academy.jsx       # Main app (game logic, all screens, AI engine)
│   ├── OnlinePlayScreen.jsx    # Online game board + controls
│   ├── OnlineScreen.jsx        # Lobby — create, join, recent games
│   ├── AuthScreen.jsx          # Login / signup / forgot password
│   ├── ProfileScreen.jsx       # Stats, game history, leaderboard
│   ├── useOnlineGame.js        # Supabase Realtime hook
│   ├── useSupabaseProgress.js  # Progress load/save hook
│   ├── supabase.js             # Supabase client
│   └── index.css               # Global styles + CSS variables
├── api/
│   └── groq.js                 # Vercel Edge Function — Groq proxy
├── supabase-schema.sql         # profiles, game_sessions, progress, leaderboard
├── multiplayer-games-schema.sql # multiplayer_games table + RLS + trigger
├── add_elo_migration.sql       # Adds elo column to progress
├── leaderboard-elo-migration.sql # Adds elo to leaderboard view
├── index.html
├── vite.config.js
├── vercel.json
├── Dockerfile
└── nginx.conf
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com/keys) API key

### Install

```bash
git clone https://github.com/Aalaukik/chess-academy.git
cd chess-academy
npm install
cp env.example .env
```

### Environment Variables

`.env` (local dev):

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Groq — server-side only, NO VITE_ prefix
GROQ_API_KEY=gsk_your-key-here
```

> `GROQ_API_KEY` is never bundled into the client. It's used only by `api/groq.js` (Vercel Edge Function in prod, `proxy-server.js` in dev).

### Run locally

```bash
# Terminal 1 — Groq proxy
node proxy-server.js

# Terminal 2 — Vite dev server
npm run dev

# Or both at once
npm run dev:all
```

Open http://localhost:5173

---

## Supabase Setup

Run these SQL files **in order** in your Supabase SQL Editor:

1. `supabase-schema.sql` — base tables + RLS + triggers
2. `multiplayer-games-schema.sql` — multiplayer table + invite code trigger + RLS
3. `add_elo_migration.sql` — adds `elo` column to `progress`
4. `leaderboard-elo-migration.sql` — adds `elo` to leaderboard view

### Google OAuth (optional)

1. Create OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com)
   - Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
2. Supabase Dashboard → Authentication → Providers → Google → enable + paste credentials
3. Supabase → Authentication → URL Configuration → add your site URL + `http://localhost:5173`

---

## Deployment

### Vercel (recommended)

```bash
npm install -g vercel
vercel
```

Set these environment variables in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GROQ_API_KEY
```

Every `git push` to `main` auto-deploys.

### Docker

```bash
docker build -t chess-academy .
docker run -p 8080:80 chess-academy
```

> Pass `VITE_` env vars as `--build-arg` at build time (Vite bakes them in at compile time).

---

## How It Works

**Chess AI** — Minimax with Alpha-Beta pruning + piece-square tables. Randomness injected per difficulty level (90% random at Beginner → 0% at Master).

**Online Multiplayer** — Three-layer architecture:
- Broadcast: instant move delivery (~50–150 ms, fire-and-forget)
- Postgres Changes: reliable fallback + reconnect sync
- Presence: opponent online/offline detection

**AI Tutor proxy** — Frontend POSTs to `/api/groq` → Vercel Edge Function injects `GROQ_API_KEY` → forwards to Groq. Key never reaches the browser.

**Progress sync** — Debounced 1.5 s upsert to Supabase on every change. Guests use `localStorage`. Loaded on login via `useSupabaseProgress` hook.

---

## License

MIT
