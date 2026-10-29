// ============================================================
// TQG — data layer config (Google Sheets + Cloudflare Worker)
// PUBLIC READ: the Google Sheet is published to the web. Each
// tab below is fetched as CSV (gviz/tq) with no auth.
// ADMIN WRITES: go through the Cloudflare Worker, which holds the
// write secret in its environment. The secret NEVER ships here.
// ============================================================
export const SHEET_ID = "YOUR_GOOGLE_SHEET_ID"; // TODO(owner): sheet id
export const SHEET_TABS = {
  settings:       "settings",       // team_name, roadmap_start_date, scoring_config
  players:        "players",        // id, ign, display_name, role_primary, role_secondary, roster_status, join_date, avatar_url
  phases:         "phases",         // id, phase_no, title, description, status, start_date, end_date, completion_date
  tasks:          "tasks",          // id, phase_id, title, done, completed_at
  practice:       "practice",       // id, session_date, practice_type, objectives, participants, attendance, results
  matches:        "matches",        // id, match_date, match_type, opponent, roster, placement, kills, points, notes, replay_url
  announcements:  "announcements",  // id, title, body, published_at
  recruitment:    "recruitment",    // id, ign, target_role, trial_status, trial_date, decision
};
// Admin write endpoint — Cloudflare Worker (deploy worker/index.js).
// The token below is NOT stored here; the admin types it at sign-in
// and it is sent to the Worker, which compares it to its env secret.
export const WORKER_URL = "https://tqg-admin.YOUR_SUBDOMAIN.workers.dev"; // TODO(owner)
export const WORKER_PATH = "/write";