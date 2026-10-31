// Turns practice questions into study cards for the Questions Guide, Flashcards and the games.
// One card per correct answer: the answer is the title, "why it's the right answer" is the definition,
// and "Concept Covered" is the category. Questions with the same answer share a card.
import { core } from './deck.js';

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with']);

/**
 * Service and feature names are Title Case ("Rapid Elasticity and Scalability", "Memory Optimized (R family)").
 * Answers like "Test recovery procedures" are phrases; those get the concept's name as their title instead.
 */
export function isPhrase(text) {
  const words = text.replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => /^[a-z]/i.test(w) && !SMALL.has(w.toLowerCase()));
  return words.filter((w) => /^[a-z]/.test(w)).length >= 2;
}

const firstSentence = (s) => (s.match(/^.*?[.!?](\s|$)/)?.[0] || s).trim();

function titleFor(q, link) {
  const answers = q.correct.map((l) => q.options.find((o) => o.letter === l)?.text).filter(Boolean);
  const concept = link?.strong ? link.card.term : q.concept;
  if (answers.length !== 1) return concept || answers.join(' + ');
  return isPhrase(answers[0]) && concept ? concept : answers[0];
}

export function buildQuestionCards(questions, links, fallbackDomain = 'Cloud Technology & Services') {
  const byKey = new Map();
  for (const q of questions) {
    const link = links[q.id];
    const term = titleFor(q, link);
    const key = core(term) || q.id;
    const wrong = q.options.filter((o) => !q.correct.includes(o.letter)).map((o) => o.text);
    let card = byKey.get(key);
    if (!card) {
      card = {
        id: `qg-${key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        term,
        category: q.topic || 'General',
        topics: [],
        hint: '',
        eli12: '',
        whys: [],
        definition: '',
        short: '',
        triggers: [],
        confuse: [],
        domain: link?.domain || fallbackDomain,
        confidence: 'red',
        lowPriority: false,
        official: '',
        officialSource: '',
        notes: '',
        related: link?.strong ? link.card : null,
        questions: [],
        source: 'questions',
      };
      byKey.set(key, card);
    }
    if (q.why && !card.whys.includes(q.why)) card.whys.push(q.why);
    if (q.topic && !card.topics.includes(q.topic)) card.topics.push(q.topic);
    for (const w of wrong) if (!card.confuse.includes(w) && core(w) !== key) card.confuse.push(w);
    card.questions.push(q);
  }
  return [...byKey.values()].map((c) => {
    const definition = c.whys.join(' ') || c.questions[0].text;
    return { ...c, definition, short: firstSentence(c.whys[0] || definition) };
  });
}
