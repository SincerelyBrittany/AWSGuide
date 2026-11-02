// Answer history: per-concept right/wrong counts plus a log of study sessions.
// Pure functions; App.jsx keeps the state and saves it to localStorage.

export const STATS_VERSION = 2;
const RECENT = 12; // outcomes kept per concept
const MAX_SESSIONS = 300;
export const SESSION_GAP_MS = 30 * 60 * 1000; // 30 idle minutes starts a new session

export const emptyStats = () => ({ version: STATS_VERSION, concepts: {}, sessions: [] });

/** Which deck a card belongs to: the study guide, the Questions Guide ("qg-" ids) or the Focus deck ("fx-" ids). */
export const deckOf = (cardOrId) => {
  const id = typeof cardOrId === 'string' ? cardOrId : cardOrId.id;
  return id.startsWith('qg-') ? 'questions' : id.startsWith('fx-') ? 'focus' : 'guide';
};
const emptyTally = () => ({ right: 0, wrong: 0, kinda: 0, missed: [] });

function credit(concepts, card, outcome, mode, now) {
  const prev = concepts[card.id] || { term: card.term, right: 0, wrong: 0, kinda: 0, recent: [] };
  concepts[card.id] = {
    ...prev,
    term: card.term,
    [outcome]: (prev[outcome] || 0) + 1,
    lastSeen: now,
    lastResult: outcome,
    recent: [...prev.recent, { o: outcome[0], m: mode, t: now }].slice(-RECENT),
  };
}

/**
 * One answer. `cards` is every card it counts toward: one card in the games,
 * or a Questions Guide entry plus its study-guide concept in the Quiz.
 * The session counts the answer once per deck, so each deck's Progress view adds up.
 * outcome: 'right' | 'wrong' | 'kinda' (flashcard self-rating in the middle).
 */
export function recordAnswer(stats, { cards, card, outcome, mode, sessionId, now = Date.now() }) {
  const list = (cards || [card]).filter(Boolean);
  const concepts = { ...stats.concepts };
  list.forEach((c) => credit(concepts, c, outcome, mode, now));

  const sessions = [...stats.sessions];
  let s = sessions.length ? sessions[sessions.length - 1] : null;
  if (!s || s.id !== sessionId) {
    s = { id: sessionId, mode, startedAt: now, endedAt: now, right: 0, wrong: 0, kinda: 0, missed: [], decks: {} };
    sessions.push(s);
  } else {
    s = { ...s, missed: [...s.missed], decks: { ...s.decks } };
    sessions[sessions.length - 1] = s;
  }
  s[outcome] += 1;
  s.endedAt = now;
  for (const d of new Set(list.map(deckOf))) {
    const t = { ...(s.decks[d] || emptyTally()) };
    t[outcome] += 1;
    if (outcome === 'wrong') t.missed = [...new Set([...t.missed, ...list.filter((c) => deckOf(c) === d).map((c) => c.id)])];
    s.decks[d] = t;
  }
  if (outcome === 'wrong') for (const c of list) if (!s.missed.includes(c.id)) s.missed.push(c.id);
  return { ...stats, concepts, sessions: sessions.slice(-MAX_SESSIONS) };
}

/** A session's numbers for one deck (zeros if it never touched that deck). */
export function sessionFor(s, deck) {
  const t = s.decks?.[deck];
  if (!t) return null;
  const n = t.right + t.wrong + t.kinda;
  return n ? { ...t, n } : null;
}

/** Totals for one deck, read from the same sessions the Recent sessions table shows. */
export function deckTotals(stats, deck) {
  let right = 0, wrong = 0, kinda = 0, count = 0, last = 0;
  for (const s of stats.sessions) {
    const t = sessionFor(s, deck);
    if (!t) continue;
    right += t.right; wrong += t.wrong; kinda += t.kinda; count++;
    last = Math.max(last, s.endedAt);
  }
  const total = right + wrong + kinda;
  return { right, wrong, kinda, total, sessions: count, last, accuracy: total ? (right + 0.5 * kinda) / total : null };
}

/**
 * One-time upgrade of history saved before answers were tagged by deck.
 * - Splits each old session between the two decks using the per-concept answer log.
 * - Credits past Quiz answers to their Questions Guide entries (the Quiz used to credit only the study guide).
 * qCardOf maps a quiz question id to its Questions Guide card.
 */
export function upgradeStats(stats, quizHistory, qCardOf) {
  if ((stats.version || 1) >= STATS_VERSION) return stats;
  const sessions = stats.sessions.map((s) => ({ ...s, decks: {} }));
  const find = (t, mode) =>
    sessions.find((s) => (!mode || s.mode === mode) && t >= s.startedAt - 1000 && t <= s.endedAt + 1000);

  // 1) Old sessions: rebuild per-deck numbers from each concept's recent answers.
  for (const [id, c] of Object.entries(stats.concepts)) {
    for (const r of c.recent || []) {
      const s = find(r.t, r.m);
      if (!s) continue;
      const d = deckOf(id);
      const t = s.decks[d] || (s.decks[d] = emptyTally());
      const outcome = r.o === 'r' ? 'right' : r.o === 'w' ? 'wrong' : 'kinda';
      t[outcome] += 1;
      if (outcome === 'wrong' && !t.missed.includes(id)) t.missed.push(id);
    }
  }
  // Answers older than the per-concept log stay with the study guide, where they were recorded.
  for (const s of sessions) {
    const seen = Object.values(s.decks).reduce((n, t) => n + t.right + t.wrong + t.kinda, 0);
    const total = s.right + s.wrong + s.kinda;
    if (s.mode === 'quiz') {
      // Quiz sessions only ever credited the study guide, so its numbers are the session's own.
      s.decks.guide = { right: s.right, wrong: s.wrong, kinda: s.kinda, missed: s.missed.filter((id) => deckOf(id) === 'guide') };
    } else if (seen < total) {
      const g = s.decks.guide || (s.decks.guide = emptyTally());
      const left = { right: s.right, wrong: s.wrong, kinda: s.kinda };
      for (const t of Object.values(s.decks)) for (const k of Object.keys(left)) left[k] -= t[k];
      for (const k of Object.keys(left)) g[k] += Math.max(0, left[k]);
    }
  }

  // 2) Past Quiz answers → Questions Guide entries, placed in the quiz session they happened in.
  const concepts = { ...stats.concepts };
  const quizSessions = sessions.filter((s) => s.mode === 'quiz');
  for (const [qid, h] of Object.entries(quizHistory?.questions || {})) {
    const card = qCardOf[qid];
    if (!card) continue;
    const prev = concepts[card.id] || { term: card.term, right: 0, wrong: 0, kinda: 0, recent: [] };
    const recent = [...prev.recent];
    for (let i = 0; i < h.right; i++) recent.push({ o: 'r', m: 'quiz', t: h.lastSeen });
    for (let i = 0; i < h.wrong; i++) recent.push({ o: 'w', m: 'quiz', t: h.lastSeen });
    concepts[card.id] = {
      ...prev,
      term: card.term,
      right: prev.right + h.right,
      wrong: prev.wrong + h.wrong,
      lastSeen: Math.max(prev.lastSeen || 0, h.lastSeen || 0),
      lastResult: prev.lastSeen > h.lastSeen ? prev.lastResult : h.lastResult,
      recent: recent.sort((a, b) => a.t - b.t).slice(-RECENT),
    };
    let s = find(h.lastSeen, 'quiz') || quizSessions[quizSessions.length - 1];
    if (!s) {
      s = { id: `s${h.lastSeen}`, mode: 'quiz', startedAt: h.lastSeen, endedAt: h.lastSeen, right: 0, wrong: 0, kinda: 0, missed: [], decks: {} };
      sessions.push(s);
      quizSessions.push(s);
    }
    const t = s.decks.questions || (s.decks.questions = emptyTally());
    t.right += h.right;
    t.wrong += h.wrong;
    if (h.wrong && !t.missed.includes(card.id)) t.missed.push(card.id);
  }
  sessions.sort((a, b) => a.startedAt - b.startedAt);
  return { ...stats, version: STATS_VERSION, concepts, sessions };
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
