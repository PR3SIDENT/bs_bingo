# Bull$hit Bingo

Collaborative bingo card app — predict the rants, mark the squares, win bragging rights.

## Stack

- **Frontend**: Vanilla JS (ES modules), CSS, static HTML
- **Backend**: Vercel serverless functions
- **Database**: Supabase (Postgres + RLS + Realtime)
- **Auth**: Supabase Auth (Google OAuth + Magic Link)
- **Hosting**: Vercel

## Project Structure

```
bs_bingo/
  api/
    generate-card.js      serverless: shuffle + create card
    mark-cell.js          serverless: toggle mark + bingo check
  lib/
    bingo-logic.js        shared: grid tiers, shuffle, bingo check
    supabase-admin.js     server-side Supabase client (service role)
  public/
    index.html            home page with auth UI
    board.html            board page
    css/style.css         all styles
    js/
      supabase-client.js  frontend Supabase client (anon key)
      auth.js             Google OAuth + Magic Link helpers
      home.js             home page logic
      board.js            board page logic + Realtime subscriptions
      confetti.js         bingo celebration animation
  supabase/
    migrations/
      001_initial_schema.sql
  tests/
    bingo-logic.test.js   unit tests for shared logic
    generate-card.test.js API function tests
    mark-cell.test.js     API function tests
  vercel.json
```

## How It Works

1. Sign in with Google or email magic link
2. Create a board or join one via link/code
3. Pick a display name and color
4. Add topic predictions (things you think will come up)
5. Once there are enough topics (8+), shuffle and play
6. Mark cells as topics happen — everyone sees marks in real-time
7. Complete a row, column, or diagonal to win BINGO

### Grid Sizes

| Topics | Grid |
|--------|------|
| 8+     | 3x3  |
| 15+    | 4x4  |
| 24+    | 5x5  |

Center cell is always FREE (auto-marked).

## Architecture

### Data Flow

- **Reads** (topics, players, card summaries) go directly from frontend → Supabase (RLS-protected)
- **Writes** (card generation, cell marking) go through serverless functions using the service role key
- **Real-time** updates via Supabase Realtime (Postgres changes) replace the old SSE approach

### Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Auto-created on signup (name, avatar from OAuth) |
| `boards` | Game boards with short UUID IDs |
| `topics` | Predictions added by players |
| `players` | User-board join (name + color) |
| `player_cards` | Generated bingo card cells |
| `bingo_events` | Win records with winning line |

### Key Triggers

- **Auto-create profile** on auth signup
- **Auto-invalidate cards** when topics are added/removed (forces reshuffle)

## Local Development

### Prerequisites

- Node.js 18+
- Vercel CLI: `npm i -g vercel`
- Supabase CLI: `npm i -g supabase`
- A Supabase project with the migration applied

### Setup

```bash
git clone git@github.com:PR3SIDENT/bs_bingo.git
cd bs_bingo
npm install
```

Create `.env` for local dev (Vercel CLI reads this):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Update `public/js/supabase-client.js` with your project URL and anon key.

### Run

```bash
vercel dev
```

Opens at `http://localhost:3000`.

### Tests

```bash
npm test
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | Vercel (server) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server, secret) | Bypasses RLS for serverless functions |
| Anon key + URL | `supabase-client.js` (frontend) | Safe to expose, scoped by RLS |

## Supabase Setup

1. Create project at [app.supabase.com](https://app.supabase.com)
2. Run migration: `supabase db push`
3. Enable Google OAuth in Auth → Providers (needs Google Cloud OAuth credentials)
4. Add redirect URLs in Auth → URL Configuration:
   - `https://bsbingo.app`
   - `http://localhost:3000`

## Deployment

Pushes to `main` auto-deploy via Vercel GitHub integration.

Manual deploy:

```bash
vercel --prod
```
