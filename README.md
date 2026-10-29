# Team Quantum Gaming (TQG) — Competitive Command Center

Free Fire MAX esports team dashboard. Public pages + protected admin console.

## Stack
- Static frontend (plain HTML/CSS/JS, no framework) → GitHub Pages
- Supabase: Postgres + RLS + public views

## Structure
```
index.html          Dashboard (public)
roadmap.html        Roadmap timeline (public)
roster.html         Player profiles (public)
matches.html        Match history (public)
stats.html          Statistics (public)
recruitment.html    Recruitment — public view (approved only)
admin.html          Admin console (auth required)
css/style.css       Design tokens (bg #06070D, lime #C6FF3D, cyan #3DE8FF)
js/api.js           Data layer (Supabase client, public views)
js/config.js        Supabase URL + anon key (fill in)
js/dashboard.js     Dashboard logic
js/nav.js          Shared nav/mobile menu
supabase/schema.sql Schema: tables + RLS + public views
```

## Setup
1. Create a Supabase project (free tier).
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Auth (email/password) and create the admin user.
4. Fill `JS/config.js` with `SB_URL` and `SB_ANON` (anon public key only — never a service-role key).
5. Host the static files on GitHub Pages.

## Security notes
- anon role can only SELECT from `*_public` views. Private fields (e.g. recruitment `eval_notes`) never appear in any public view.
- `authenticated` (admin) role has CRUD on base tables only — never expose service-role credentials client-side.
- All writes are gated by RLS policies; the frontend does not enforce permissions.

## Run locally
Serve the folder statically, e.g. `python3 -m http.server 8000` and open http://localhost:8000.