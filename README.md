# ♟ Chess Academy

> A full-featured chess learning app with an AI tutor, puzzle trainer, interactive lessons, and a ranked leaderboard — built with React, powered by Gemini AI and Supabase.

![Chess Academy](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?style=flat-square&logo=supabase)
![Gemini](https://img.shields.io/badge/Gemini-AI%20Tutor-4285F4?style=flat-square&logo=google)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [Supabase Setup](#supabase-setup)
- [Google OAuth Setup](#google-oauth-setup)
- [Gemini AI Setup](#gemini-ai-setup)
- [Deployment](#deployment)
  - [Vercel](#vercel-recommended)
  - [Docker](#docker)
- [How It Works](#how-it-works)
  - [Chess Engine](#chess-engine)
  - [AI Tutor](#ai-tutor)
  - [Auth & Progress Sync](#auth--progress-sync)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Chess Academy is a browser-based chess learning platform designed for players of all levels — from absolute beginners who don't know how the pieces move, to intermediate players looking to sharpen their tactics.

The app has three core modes:

- **Play** — challenge a built-in AI at 5 difficulty levels, from random moves to full engine strength
- **Learn** — work through 17 structured lessons across Beginner, Intermediate, and Advanced tracks with an interactive board
- **Puzzles** — solve 20 curated tactical puzzles across 7 categories with streak tracking

An AI tutor powered by Google Gemini is available in all three modes — ask it anything about the position, the lesson, or chess in general and it responds with clear, encouraging advice.

---

## Features

### ♟ Play Mode
- **5 difficulty levels** — Beginner (random), Casual (~800 ELO), Intermediate (~1200 ELO), Advanced (~1600 ELO), Master (full engine)
- **Custom chess AI** — Minimax algorithm with Alpha-Beta pruning, piece-square tables, and positional evaluation
- **Move validation** — full chess rules via chess.js (castling, en passant, promotion, check, stalemate, draws)
- **Pawn promotion dialog** — choose Queen, Rook, Bishop, or Knight
- **Hint system** — highlights the best piece to move without giving away the exact move
- **Undo** — take back your last move (and the AI's response)
- **Resign** — concede a lost game
- **Eval bar** — vertical evaluation bar shows who's winning in real time
- **Opening detection** — recognizes 12+ named openings (Italian Game, Sicilian Defense, Ruy López, etc.)
- **Captured pieces display** — shows material balance with point advantage
- **Move list** — scrollable algebraic notation history
- **Time controls** — 3, 5, 10, or 15 minute clocks (optional)
- **Board flip** — play from either side

### 🎓 Learn Mode
- **17 interactive lessons** across 3 tracks:
  - **Beginner (8 lessons):** Board setup, pawn moves, knight, bishop, rook, queen, check/checkmate, opening rules
  - **Intermediate (5 lessons):** Center control, forks, pins, castling, discovered attacks
  - **Advanced (4 lessons):** Pawn structure, skewers, king & pawn endgames, opening systems
- **Interactive board** — move pieces freely to experiment with each concept
- **Lesson tips** — pro-tips with each lesson
- **Progress tracking** — completed lessons marked with ✓, saved to Supabase
- **"Practice → Play"** button — launches a game at the right difficulty for the lesson track

### 🧩 Puzzle Trainer
- **20 tactical puzzles** across 7 categories: Mate in 1, Mate in 2, Fork, Pin, Skewer, Back rank, Discovery, Endgame
- **Difficulty ratings** — 1–3 stars per puzzle
- **Streak tracking** — consecutive correct solves tracked and saved
- **Hint system** — reveals a contextual clue without giving the solution
- **Category filter** — browse puzzles by tactic type
- **Progress bar** — shows how many puzzles you've solved
- **Auto-advance** — plays the opponent's response move automatically in multi-move puzzles

### ✨ AI Tutor
- **Powered by Google Gemini** — available in all three modes
- **Context-aware** — knows the current board position (FEN), recent moves, and current lesson/puzzle
- **Quick prompts** — one-click suggestions like "Best move?", "Explain this tactic", "What's my plan?"
- **Conversation history** — maintains the chat thread within a session
- **Rate limit handling** — automatic retry with backoff, 3-second cooldown between messages
- **Model fallback chain** — tries multiple Gemini models in order

### 👤 Authentication & Profiles
- **Email/password signup and login**
- **Google OAuth** — one-click sign in with Google
- **Guest mode** — play without an account (progress saves to browser)
- **Password reset** — via email link
- **Profile screen** — view your stats, game history, and the global leaderboard
- **Cross-device sync** — all progress saved to Supabase for logged-in users

### 🎨 UI & Polish
- **5 board themes** — Walnut, Slate, Jade, Midnight, Rose
- **Auto light/dark mode** — follows OS preference via CSS variables
- **Sound effects** — move, capture, check, castle, win, loss via Web Audio API (toggleable)
- **Smooth animations** — configurable speed (fast/normal/slow)
- **Coordinate labels** — toggleable file/rank labels on the board
- **Win/Loss/Draw stats** — tracked and displayed on the home screen
- **Persistent storage** — all progress saved automatically

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI framework | React 18 | Component tree, state management |
| Build tool | Vite 5 | Dev server, HMR, production bundling |
| Chess logic | chess.js 1.x | Move generation, validation, FEN parsing |
| AI engine | Custom Minimax + Alpha-Beta | Chess AI opponent |
| AI tutor | Google Gemini API | Natural language chess coaching |
| Auth + database | Supabase | User accounts, progress sync, game history |
| Styling | CSS-in-JS + CSS variables | Theming, light/dark mode |
| Sound | Web Audio API | Sound effects (no library needed) |
| Deployment | Vercel | Hosting + serverless functions |

---

## Project Structure

```
chess-academy/
│
├── src/
│   ├── chess-academy.jsx        # Main app — all screens, game logic, AI engine
│   ├── main.jsx                 # React entry point + auth session wrapper
│   ├── AuthScreen.jsx           # Login, signup, forgot password UI
│   ├── ProfileScreen.jsx        # Profile, game history, leaderboard
│   ├── supabase.js              # Supabase client (singleton)
│   ├── useSupabaseProgress.js   # Hook: load/save progress to Supabase
│   └── index.css                # Global styles + CSS variables (light/dark)
│
├── api/
│   └── anthropic.js             # Vercel Edge Function (optional Anthropic proxy)
│
├── public/                      # Static assets
│
├── supabase-schema.sql          # Run this once in Supabase SQL Editor
│
├── index.html                   # HTML shell — loads Inter font
├── package.json                 # Dependencies and npm scripts
├── vite.config.js               # Vite configuration
├── vercel.json                  # Vercel deploy settings + SPA rewrites
├── Dockerfile                   # Two-stage Docker build (Node → Nginx)
├── nginx.conf                   # Nginx config for Docker deployments
├── .env.example                 # Environment variable template
├── .gitignore                   # Ignores .env, node_modules, dist
└── README.md                    # This file
```

### Key file: `chess-academy.jsx`

The entire application lives in one file for simplicity. It's organized into clearly commented sections:

```
Section 1  — Chess AI (Minimax + Alpha-Beta + piece-square tables)
Section 2  — Sound engine (Web Audio API)
Section 3  — Data (PUZZLES array, LESSONS array, THEMES, opening book)
Section 4  — Main React component
  ├── State declarations
  ├── Game logic (move handling, AI, timers, undo, resign)
  ├── Learn logic (lesson loading, FEN setup)
  ├── Puzzle logic (move validation, solution checking, streak)
  ├── AI Tutor (Gemini API call with fallback chain)
  ├── Board renderer (JSX, themes, highlights)
  ├── Sub-components (TutorChat, PromoDlg, Captured, Toggle)
  └── Screen renders (menu, play_setup, play, puzzles, learn, settings, profile)
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** — comes with Node
- **Git** — [git-scm.com](https://git-scm.com)
- A free **Supabase** account — [supabase.com](https://supabase.com)
- A free **Google Gemini** API key — [aistudio.google.com](https://aistudio.google.com)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/chess-academy.git
cd chess-academy

# 2. Install dependencies
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and add your keys:

```env
# Google Gemini — free at aistudio.google.com/apikey
VITE_GEMINI_KEY=AIzaSy-your-key-here

# Supabase — free at supabase.com (Settings → API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```


### Running Locally

```bash
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**

The full app works locally including auth, progress sync, and the AI tutor.

---

## Supabase Setup

Supabase provides the database (PostgreSQL), authentication, and real-time features — all free up to 500MB and 50,000 monthly active users.

### Step 1 — Create a project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **"New Project"** — choose any region close to your users
3. Wait ~2 minutes for the project to provision

### Step 2 — Run the database schema

1. In your Supabase dashboard, go to **SQL Editor → New Query**
2. Open `supabase-schema.sql` from this repository
3. Paste the entire contents and click **Run**

This creates:
- `profiles` table — one row per user, auto-created on signup
- `game_sessions` table — every completed game with moves, result, opening, duration
- `progress` table — lessons completed, puzzles solved, streak, W/L/D record
- `leaderboard` view — public rankings by wins and win rate
- Row Level Security policies — users can only access their own data
- Triggers — auto-create profile and progress rows on signup

### Step 3 — Get your API keys

1. In Supabase dashboard go to **Settings → API**
2. Copy **Project URL** → `VITE_SUPABASE_URL`
3. Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

## Google OAuth Setup

Allow users to sign in with their Google account in one click.

### Step 1 — Create Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one named "Chess Academy")
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External** → Create
   - Fill in App name: `Chess Academy`, support email, developer email
   - Click through the remaining steps (no scopes needed)
4. Go to **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Chess Academy Web`
   - **Authorized JavaScript origins:**
     ```
     https://your-project-id.supabase.co
     ```
   - **Authorized redirect URIs:**
     ```
     https://your-project-id.supabase.co/auth/v1/callback
     ```
5. Click **Create** — copy the **Client ID** and **Client Secret**

### Step 2 — Enable Google in Supabase

1. Supabase dashboard → **Authentication → Providers → Google**
2. Toggle **Enabled** on
3. Paste in **Client ID** and **Client Secret**
4. Click **Save**

### Step 3 — Add your site URL

1. Supabase → **Authentication → URL Configuration**
2. **Site URL:** `https://your-app.vercel.app`
3. **Redirect URLs** — add both:
   ```
   https://your-app.vercel.app
   http://localhost:5173
   ```
4. Click **Save**

---

## Gemini AI Setup

The AI tutor uses Google's Gemini API — the free tier gives 30 requests/minute and 1,500 requests/day with no credit card required.

### Get an API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **"Create API key" → "Create API key in new project"**
3. Copy the key (starts with `AIzaSy`)

### Verify the key works

Paste this URL into your browser (replace `YOUR_KEY`):

```
https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
```

You should see a JSON list of model names. If you see `API_KEY_INVALID`, the key is wrong.

### Enable the API in Google Cloud

1. Go to [console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)
2. Make sure you're in the same project as your API key
3. Search **"Generative Language API"** → click **Enable**

### Free tier limits

| Limit | Value |
|---|---|
| Requests per minute | 30 |
| Requests per day | 1,500 |
| Tokens per minute | 1,000,000 |
| Cost | Free |

The app enforces a 3-second cooldown between tutor messages to stay within limits.

---

## Deployment

### Vercel (recommended)

Vercel gives free hosting for personal projects with automatic deploys on every Git push.

#### First deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow the prompts)
vercel

# Or connect via GitHub:
# vercel.com → Add New Project → Import your GitHub repo
```

#### Set environment variables

In Vercel dashboard → **Settings → Environment Variables**, add all three:

```
VITE_GEMINI_KEY        = AIzaSy-your-key
VITE_SUPABASE_URL      = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGc...
```

Select **Production**, **Preview**, and **Development** for each.

#### Redeploy after adding variables

```
Vercel dashboard → Deployments → ··· → Redeploy
```

#### Automatic deploys

After the initial setup, every `git push` to `main` triggers an automatic redeploy:

```bash
git add .
git commit -m "Your changes"
git push
# → Vercel deploys automatically in ~30 seconds
```

### Docker

For self-hosted deployments on any VPS or cloud provider.

```bash
# Build the image
docker build -t chess-academy .

# Run it
docker run -p 8080:80 \
  -e VITE_GEMINI_KEY=AIzaSy-your-key \
  -e VITE_SUPABASE_URL=https://your-project.supabase.co \
  -e VITE_SUPABASE_ANON_KEY=eyJhbGc... \
  chess-academy
```

Open [http://localhost:8080](http://localhost:8080)

> Note: With Docker, Vite bakes environment variables into the build at compile time. Pass them as `--build-arg` during `docker build` instead of `-e` at runtime if your Dockerfile uses a multi-stage build.

---

## How It Works

### Chess Engine

The AI opponent uses a classic **Minimax algorithm with Alpha-Beta pruning** — no external engine or WASM required.

```
Depth 1 (Beginner)  → looks 1 move ahead + 90% random moves
Depth 1 (Casual)    → looks 1 move ahead + 42% random moves
Depth 2 (Intermediate) → looks 2 moves ahead + 14% random
Depth 3 (Advanced)  → looks 3 moves ahead + 4% random
Depth 4 (Master)    → looks 4 moves ahead, fully deterministic
```

Position evaluation uses:
- **Material values** — pawn=100, knight=320, bishop=330, rook=500, queen=900
- **Piece-square tables** — rewards pieces on strong squares (e.g. knights in the center)
- **Checkmate/draw detection** — returns ±99999 for terminal positions

### AI Tutor

Each tutor message includes:
- The **current board position** as a FEN string
- The **last 8 moves** in algebraic notation
- **Context** about the current screen (lesson name, puzzle category)
- A **system prompt** instructing the model to be a warm, concise chess coach

The code tries models in order until one responds successfully:
```
gemini-2.0-flash-lite → gemini-2.0-flash-lite-001 → gemini-flash-latest → gemini-2.5-flash-lite → gemini-2.0-flash
```

### Auth & Progress Sync

```
User signs up → Supabase trigger auto-creates profile + progress rows
User plays game → on game over, saveGame() inserts a game_sessions row
User completes lesson → progress row upserted with 1.5s debounce
User closes app → all state already persisted in Supabase
User opens app on new device → useSupabaseProgress hook loads everything back
```

Guest users get the same experience but progress is stored in the browser via the Artifact Storage API instead of Supabase.

---

## Contributing

Pull requests are welcome! Here's how to get started:

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/chess-academy.git
cd chess-academy
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

A few things to know:
- The entire app is in `src/chess-academy.jsx` — it's long but clearly sectioned with comments
- Each screen is a separate `if(screen==="...")` block at the bottom of the component
- CSS uses inline styles with CSS variables from `index.css` for theming
- New puzzles go in the `PUZZLES` array; new lessons in `LESSONS`

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">
  <p>Built with React, chess.js, Supabase, and Google Gemini</p>
  <p>♟ <strong>Chess Academy</strong> — Play, learn, and master the game of kings</p>
</div>
