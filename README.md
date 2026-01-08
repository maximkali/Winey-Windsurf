# Winey

Game is live on www.blindsipper.com

Winey is a lightweight web app for running a **blind wine tasting game**:
players taste a set of wines each round and rank them from **most** to **least** expensive. After everyone submits, the app reveals the correct order (without revealing labels/prices) and updates a live leaderboard.

## How the game works

### Host flow

1. **Host Tasting** (`/host/setup`): pick players/bottles/rounds, then create a game.
2. **Wine List** (`/host/wine-list`): enter each wine’s (blinded) label, nickname, and actual price.
3. **Organize Rounds** (`/host/organize-rounds`): assign wines to each round (randomize or manually choose).
4. **Lobby** (`/host/lobby`): share the player join link, then start the game.

### Player flow

1. **Join Tasting** (`/player/join`): enter the game code + your name.
2. **Lobby** (`/player/lobby`): wait for the host to start.
3. **Round** (`/game/round/[id]`): take notes + submit a ranking.
4. **Leaderboard** (`/game/leaderboard`): see totals after each round and at the end.

## Scoring (tie-aware)

Scoring is **1 point per correctly-ranked position**.

If multiple wines have the **same price**, they’re treated as interchangeable for the tied slots. Example:

- Prices: A=10, B=4, C=4, D=2
- Both `A B C D` and `A C B D` score **4**
- `A D B C` scores **2** (A is correct, B is correct in the 3rd slot; C does **not** get a point)

You can sanity check scoring with:

```bash
npm run test:scoring
```

## Admin return link (host key)

On the host lobby, “Copy Admin Return Link” generates a private URL containing the host `uid`.
Anyone with that link can act as the host for that game—treat it like a password.

## Tech

- Next.js (App Router)
- React
- Supabase (Postgres) via server-side API routes (`src/app/api/**`)
- Tailwind CSS

## Local development

### Prerequisites

- Node.js
- A Supabase project (hosted or local)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create `.env.local` in the project root:

```bash
# Supabase project URL (either one works)
SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
# or: NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"

# REQUIRED: server-side key used by API routes
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
```

Important:
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only**. Do **not** put it in a `NEXT_PUBLIC_*` variable.
- This app uses server-side API routes exclusively (no client-side Supabase calls), so the anon key is not needed.

### 3) Create the database tables

Run the SQL in `supabase/schema.sql` in your Supabase project (SQL Editor). This creates:
`games`, `players`, `rounds`, `wines`, `round_wines`, `round_submissions`.

#### Dev reset (recommended during development)

If you want a clean slate (delete all game data + ensure the schema exactly matches this repo):

1) In Supabase SQL Editor, run:

```sql
drop table if exists public.round_wines cascade;
drop table if exists public.round_submissions cascade;
drop table if exists public.rounds cascade;
drop table if exists public.wines cascade;
drop table if exists public.players cascade;
drop table if exists public.games cascade;
```

2) Then run the full contents of `supabase/schema.sql`.

Notes:
- `wines.price` is stored as `numeric(10,2)` for exact cents (no float rounding).
- Re-running `supabase/schema.sql` is safe; it includes an idempotent step to keep `wines.price` aligned.

### 4) Run the dev server

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Scripts

- `npm run dev`: start dev server
- `npm run build`: production build
- `npm run start`: run production server
- `npm run lint`: lint
- `npm run test:scoring`: run scoring self-check
