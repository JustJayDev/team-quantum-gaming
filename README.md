# Team Quantum Gaming (TQG) — Competitive Command Center

Free Fire MAX esports team dashboard. Public pages + protected admin console.

## Stack
- Static frontend (plain HTML/CSS/JS, no framework) → GitHub Pages
- **Public reads:** Google Sheet published to the web, fetched as CSV (no auth)
- **Admin writes:** Cloudflare Worker validates a token and appends rows to the sheet

## Structure
```
index.html          Dashboard (public)
roadmap.html        Roadmap timeline (public)
roster.html         Player profiles (public)
matches.html        Match history (public)
stats.html          Statistics (public)
recruitment.html    Recruitment — public view (approved only)
admin.html          Admin console (token-gated)
css/style.css       Design tokens (bg #06070D, lime #C6FF3D, cyan #3DE8FF)
js/api.js           Data layer (Google Sheets CSV fetch)
js/config.js        Sheet id + Worker URL (fill in)
js/dashboard.js     Dashboard logic
js/nav.js          Shared nav/mobile menu
worker/index.js     Cloudflare Worker (admin writes, token + service account)
supabase/schema.sql Supabase reference schema (no longer used for this deployment)
```

## Setup

### 1. Google Sheet (public read)
1. Create a Google Sheet with one tab per collection: `settings`, `players`,
   `phases`, `tasks`, `practice`, `matches`, `announcements`, `recruitment`.
2. Row 1 of each tab must be exactly the headers listed in `js/config.js`
   comments (e.g. `players`: `id, ign, display_name, role_primary, role_secondary, roster_status, join_date, avatar_url`).
3. Publish: **File → Share → Publish to web** → choose the sheet tab, format **CSV**. Copy the sheet id from the URL into `js/config.js` → `SHEET_ID`.
4. The `recruitment` tab must contain **only** the public columns
   (`id, ign, target_role, trial_status, trial_date, decision`). Private
   evaluation notes must live in a separate, never-published tab.

### 2. Cloudflare Worker (admin writes)
1. `wrangler init`, then copy `worker/index.js` in.
2. Set the encrypted env vars:
   - `ADMIN_TOKEN` — a long random string you choose
   - `SPREADSHEET_ID` — same as `SHEET_ID`
   - `SERVICE_ACCOUNT` — full JSON of a Google service account
3. Share the sheet with the service account email (Editor).
4. Deploy `wrangler deploy`. Copy the workers.dev URL into `js/config.js` → `WORKER_URL`.
5. Tell the admin the token; they type it on the admin console. It is never stored in code.

### 3. Frontend
Fill `js/config.js` with real `SHEET_ID` and `WORKER_URL`, then host on GitHub Pages.

## Security notes
- No write secret ships in the frontend. The admin token is sent only to the Worker.
- The Worker validates the token (`ADMIN_TOKEN`) on every request. Private recruitment fields are written to a separate never-published tab, never to the public sheet.
- Public read requires no auth, but only ever reads the published tabs.

## Run locally
Serve the folder statically, e.g. `python3 -m http.server 8000` and open http://localhost:8000. (Sheet fetches need the sheet to be published to the web; CORS is allowed by Google's `gviz/tq` endpoint.)