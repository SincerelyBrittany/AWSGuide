// Answer history: per-concept right/wrong counts plus a log of study sessions.
// Pure functions; App.jsx keeps the state and saves it to localStorage.

export const STATS_VERSION = 1;
const RECENT = 12; // outcomes kept per concept
const MAX_SESSIONS = 300;
export const SESSION_GAP_MS = 30 * 60 * 1000; // 30 idle minutes starts a new session

export const emptyStats = () => ({ version: STATS_VERSION, concepts: {}, sessions: [] });

/** outcome: 'right' | 'wrong' | 'kinda' (flashcard self-rating in the middle). */
export function recordAnswer(stats, { card, outcome, mode, sessionId, now = Date.now() }) {
  const prev = stats.concepts[card.id] || { term: card.term, right: 0, wrong: 0, kinda: 0, recent: [] };
  const concept = {
    ...prev,
    term: card.term,
    [outcome]: (prev[outcome] || 0) + 1,
    lastSeen: now,
    lastResult: outcome,
    recent: [...prev.recent, { o: outcome[0], m: mode, t: now }].slice(-RECENT),
  };

  const sessions = [...stats.sessions];
  let s = sessions.length ? sessions[sessions.length - 1] : null;
  if (!s || s.id !== sessionId) {
    s = { id: sessionId, mode, startedAt: now, endedAt: now, right: 0, wrong: 0, kinda: 0, missed: [] };
    sessions.push(s);
  } else {
    s = { ...s, missed: [...s.missed] };
    sessions[sessions.length - 1] = s;
  }
  s[outcome] += 1;
  s.endedAt = now;
  if (outcome === 'wrong' && !s.missed.includes(card.id)) s.missed.push(card.id);

  return { ...stats, concepts: { ...stats.concepts, [card.id]: concept }, sessions: sessions.slice(-MAX_SESSIONS) };
}

export const attempts = (c) => (c ? c.right + c.wrong + (c.kinda || 0) : 0);

/** Accuracy counting a "kinda" as half right. null when never answered. */
export function accuracy(c) {
  const n = attempts(c);
  return n ? (c.right + 0.5 * (c.kinda || 0)) / n : null;
}

/**
 * Higher = needs more study. Blends low accuracy, raw misses and recent misses,
 * so a card missed 4 of 5 times ranks above one missed once.
 */
export function weakness(c) {
  if (!attempts(c)) return 0;
  const recentMiss = c.recent.slice(-4).filter((r) => r.o === 'w').length;
  return (1 - accuracy(c)) * 3 + c.wrong * 0.6 + recentMiss * 0.8;
}

export function status(c) {
  const n = attempts(c);
  if (!n) return 'new';
  const acc = accuracy(c);
  const lastTwoRight = c.recent.slice(-2).every((r) => r.o === 'r');
  if (n >= 3 && acc >= 0.85 && lastTwoRight) return 'mastered';
  if (acc < 0.6 || c.lastResult === 'wrong') return 'struggling';
  return 'learning';
}

export function summary(stats, cards) {
  let right = 0, wrong = 0, kinda = 0, practiced = 0;
  for (const card of cards) {
    const c = stats.concepts[card.id];
    if (!attempts(c)) continue;
    practiced++;
    right += c.right; wrong += c.wrong; kinda += c.kinda || 0;
  }
  const total = right + wrong + kinda;
  return { right, wrong, kinda, total, practiced, accuracy: total ? (right + 0.5 * kinda) / total : null, sessions: stats.sessions.length };
}

/** Validate a backup file before replacing current stats. */
export function parseBackup(text) {
  const data = JSON.parse(text);
  const stats = data.stats || data;
  if (!stats || typeof stats.concepts !== 'object' || !Array.isArray(stats.sessions)) {
    throw new Error('This file isn’t a Study Arcade backup.');
  }
  return { stats: { ...emptyStats(), ...stats }, progress: data.progress || null, quiz: data.quiz || null, questions: Array.isArray(data.questions) ? data.questions : null };
}
