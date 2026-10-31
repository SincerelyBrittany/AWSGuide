// Quiz helpers: linking questions to study-guide concepts, building rounds, and per-question history.
import { core, lookup, shuffle } from './deck.js';

const wholeWord = (hay, needle) => new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(hay);

function longestAliasIn(text, index) {
  const hay = core(text);
  let best = null;
  for (const [alias, card] of index) {
    if (alias.length < 3 || !wholeWord(hay, alias)) continue;
    if (!best || alias.length > best.alias.length) best = { alias, card };
  }
  return best?.card || null;
}

/**
 * The concept a question tests: an explicit "Related Concept" column if the sheet has one,
 * otherwise the correct answer's name, otherwise the longest concept name inside the correct answer.
 */
export function linkConcept(q, index) {
  if (q.concept) {
    const hit = lookup(q.concept, index);
    if (hit) return { card: hit, strong: true };
  }
  const answer = q.options.find((o) => o.letter === q.correct[0])?.text || '';
  const exact = index.get(core(answer)) || index.get(`${core(answer)}s`);
  if (exact) return { card: exact, strong: true };
  for (const m of answer.matchAll(/\(([^)]+)\)/g)) {
    const hit = index.get(core(m[1]));
    if (hit) return { card: hit, strong: true };
  }
  const inside = longestAliasIn(answer, index);
  if (inside) return { card: inside, strong: true };
  const fuzzy = lookup(answer, index);
  if (fuzzy) return { card: fuzzy, strong: true };
  // Weak link from the question text: only used to file the question under an exam domain.
  const fromQuestion = longestAliasIn(q.text, index);
  return fromQuestion ? { card: fromQuestion, strong: false } : null;
}

export const isCorrect = (q, picked) => picked.length === q.correct.length && q.correct.every((l) => picked.includes(l));

/** Shuffle answer order but keep the original letters so the explanation still makes sense. */
export function prepare(q, shuffleAnswers) {
  return { ...q, shown: shuffleAnswers ? shuffle(q.options) : q.options };
}

export function buildRound(pool, { count, history, only }) {
  let list = pool;
  if (only === 'missed') list = pool.filter((q) => history[q.id]?.lastResult === 'wrong' || (history[q.id]?.wrong || 0) > (history[q.id]?.right || 0));
  if (only === 'new') list = pool.filter((q) => !history[q.id]);
  return shuffle(list).slice(0, count === 'all' ? list.length : count);
}

export const emptyQuizHistory = () => ({ questions: {}, attempts: [] });

export function recordQuestion(history, id, result, at = Date.now()) {
  const prev = history.questions[id] || { right: 0, wrong: 0 };
  const ok = result === 'right';
  const next = { right: prev.right + (ok ? 1 : 0), wrong: prev.wrong + (ok ? 0 : 1), lastResult: result, lastSeen: at };
  return { ...history, questions: { ...history.questions, [id]: next } };
}

export function addAttempt(history, attempt) {
  return { ...history, attempts: [...history.attempts, attempt].slice(-200) };
}

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
