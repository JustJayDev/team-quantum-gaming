// ============================================================
// TQG — data layer (Supabase client)
// Public reads go through *_public views (anon key).
// Admin writes go through the client with the authenticated JWT.
// ============================================================
import { SB_URL, SB_ANON } from './config.js';

const headers = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };

async function get(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

// Public views
export const api = {
  settings: () => get('settings_public?select=*'),
  players:  () => get('players_public?select=*'),
  phases:   () => get('roadmap_phases_public?select=*&order=phase_no.asc'),
  tasks:    () => get('roadmap_tasks_public?select=*'),
  practice: () => get('practice_sessions_public?select=*&order=session_date.desc'),
  matches:  () => get('matches_public?select=*&order=match_date.desc'),
  announcements: () => get('announcements_public?select=*&order=published_at.desc'),
  recruitment: () => get('recruitment_public?select=*'),
};

// Progress calc: completed tasks / total tasks
export function phaseProgress(tasks, phaseId) {
  const list = tasks.filter(t => t.phase_id === phaseId);
  if (!list.length) return 0;
  const undone = list.filter(t => t.done).length;
  return Math.round((undone / list.length) * 100);
}

export function overallProgress(tasks, phases) {
  if (!phases.length) return 0;
  const data = phases.reduce((a, p) => a + phaseProgress(tasks, p.id), 0);
  return Math.round(data / phases.length);
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}