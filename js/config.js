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
  players:        "players",        // see PLAYER_COLUMNS in worker/validate.js
  phases:         "phases",         // id, phase_no, title, description, status, start_date, end_date, completion_date
  tasks:          "tasks",          // id, phase_id, title, done, completed_at
  practice:       "practice",       // id, session_date, practice_type, objectives, participants, attendance, results
  matches:        "matches",        // id, match_date, match_type, opponent, roster, placement, kills, points, notes, replay_url
  announcements:  "announcements",  // id, title, body, published_at, archived
  journey:        "journey",        // id, date, date_provisional, category, title, description, verified
  recruitment:    "recruitment",    // PUBLIC: id, ign, target_role, trial_status, trial_date, decision
  recruitmentPrivate: "recruitment_private", // PRIVATE — never published. id, ign, eval_notes, practice_attendance, teamwork_assessment
};

// Role vocabulary (enforced server-side in worker/validate.js).
export const ROLES = [
  'IGL', 'Rusher', 'Supporter', 'Sniper', 'Fragger', 'Secondary',
];
// Roster statuses (enforced server-side).
export const ROSTER_STATUSES = [
  'active', 'substitute', 'trial', 'former', 'inactive',
];
// Journey event categories.
export const JOURNEY_CATEGORIES = [
  'formation', 'roster', 'recruitment', 'role', 'practice',
  'roadmap', 'scrim', 'achievement',
];
// Admin write endpoints on the Worker.
export const WORKER_URL = "https://tqg-admin.YOUR_SUBDOMAIN.workers.dev"; // TODO(owner)
export const WORKER_PATH_WRITE = "/write";   // create
export const WORKER_PATH_UPDATE = "/update";  // update by id
export const WORKER_PATH_DELETE = "/delete";  // soft-delete by id