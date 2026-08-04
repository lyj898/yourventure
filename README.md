# Indonesia Campus Directory

Internal reference directory of student organizations (BEM, HIMA, sports/running clubs)
across Indonesian university campuses — built to support YOUR Venture (a Y Ventures Group
program) outreach, the Nalar "design your own venture" flow, campus brand-ambassador
recruiting, and the Future Series student running circuit.

This is a **pure reference directory** — campuses and their student orgs only. No outreach
status tracking, no priority/tier ranking.

## Stack

- **Astro** with the dashboard as a single `client:only` React island (`src/pages/index.astro`).
- **Supabase** (Postgres + Auth). Magic-link email sign-in, no public signup.
- **xlsx** (SheetJS) for client-side Excel export.

## Local setup

Requires Node 18+ and npm.

```bash
npm install
```

### 1. Supabase project

Log in and link (or create) a project — run these yourself; they're interactive:

```bash
npx supabase login
```

Then either link an existing project…

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

…or create a new one:

```bash
npx supabase projects create yourventure
```

### 2. Apply the schema + seed

```bash
npm run db:push
```

This runs the migrations in `supabase/migrations/`:

- `..._init.sql` — enums, `campuses` + `student_orgs` tables, indexes, `updated_at`
  trigger, and RLS (full access for any authenticated user, no anon access).
- `..._seed_universitas_indonesia.sql` — seeds **one** campus (Universitas Indonesia)
  with two verified student orgs.

(If you'd rather not use the CLI, paste those two SQL files into the Supabase dashboard
SQL editor in order.)

### 3. Environment

Copy the example and fill in values from **Supabase → Project Settings → API**:

```bash
cp .env.example .env.local
```

```
PUBLIC_SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="YOUR-ANON-PUBLIC-KEY"
```

`.env.local` is gitignored — never commit it.

### 4. Auth allow-list + redirect URLs (Supabase dashboard)

- **Authentication → URL Configuration → Redirect URLs:** add `http://localhost:4321`
  (and later `https://yourventure.yvjobs.online` when you deploy).
- **Authentication → Users:** add teammates' emails manually. There's no public signup —
  only allow-listed emails can sign in.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:4321>, sign in with an allow-listed email via the magic link.

## Deployment

Out of scope for now — local dev only. No host is wired up.
