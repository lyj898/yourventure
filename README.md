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

### 2. Apply the schema

```bash
npm run db:push
```

This runs `supabase/migrations/..._init.sql` — enums, `campuses` + `student_orgs` tables,
indexes, `updated_at` trigger, and RLS (full access for any authenticated user, no anon
access). Migrations are **schema only**; seed data is handled by the seed script (below).

(No CLI? Paste `..._init.sql` into the Supabase dashboard SQL editor and run it.)

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

## Populating data (seed)

Campus data lives as one JSON file per campus in **`data/campuses/`** (source of truth,
version-controlled). To load or update the database, run:

```bash
npm run seed
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see step 3). The script
(`scripts/seed.mjs`) upserts through the Supabase API:

- **campuses** — upserted by `slug` (re-running updates fields from the JSON).
- **orgs** — inserted only when no org with the same `name` already exists for that
  campus, so edits you make in the app UI are never overwritten.

It's idempotent — safe to run as often as you like.

### Adding a campus

1. Create `data/campuses/<slug>.json` (copy an existing one as a template). Shape:
   ```json
   {
     "slug": "institut-teknologi-bandung",
     "name": "Institut Teknologi Bandung",
     "type": "Institut",
     "ownership": "Negeri",
     "city": "Bandung",
     "province": "Jawa Barat",
     "future_series_city": "Bandung",
     "website": "https://www.itb.ac.id",
     "orgs": [
       { "name": "…", "org_type": "BEM Universitas", "contact_type": "Instagram",
         "contact_value": "@…", "follower_count": null, "notes": "…" }
     ]
   }
   ```
   Enum fields must match the DB: `type` (Universitas/Institut/Politeknik/Sekolah
   Tinggi/Akademi), `ownership` (Negeri/Swasta), `future_series_city`
   (Jakarta/Bandung/Yogyakarta/Surabaya/Makassar, or omit/null), `org_type`
   (BEM Universitas/BEM Fakultas/DPM/HIMA/UKM Olahraga/Lari/Other), `contact_type`
   (Instagram/Email/WhatsApp/LinkedIn/Website/Other).
2. `npm run seed`.

## Deployment

Deployed as a static site to **GitHub Pages** at `yourventure.yvjobs.online`. Every push
to `main` triggers `.github/workflows/deploy.yml` (build → Pages). The public build is
safe: the browser only ever holds the publishable key, and all data is gated by RLS + the
auth allow-list.
