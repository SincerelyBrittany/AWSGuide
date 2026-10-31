// Shared helpers: matching "Don't Confuse With" names, picking cards, building questions.

export const LEVELS = {
  red: { label: 'Study It', short: 'Study', weight: 4, score: 0 },
  yellow: { label: 'Kinda Know It', short: 'Kinda', weight: 2, score: 0.5 },
  green: { label: 'Know It', short: 'Know', weight: 1, score: 1 },
};

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const core = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/^(aws|amazon)\s+/, '')
    .replace(/[^a-z0-9+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Every name a card can be referred to by: full name, name without AWS/Amazon, acronym in brackets. */
export function aliasesFor(card) {
  const out = new Set([core(card.term)]);
  for (const m of card.term.matchAll(/\(([^)]+)\)/g)) out.add(core(m[1]));
  const noSupport = core(card.term).replace(/ support$/, '');
  if (noSupport) out.add(noSupport);
  out.delete('');
  return [...out];
}

export function buildIndex(cards) {
  const index = new Map();
  for (const c of cards) for (const a of aliasesFor(c)) if (!index.has(a)) index.set(a, c);
  index.cards = cards;
  return index;
}

// Loose match for short names like "SageMaker", "Align", "Spot" or "Regions".
function fuzzyFind(name, index) {
  const n = core(name).replace(/s$/, '');
  if (n.length < 3) return null;
  const re = new RegExp(`(^| )${escapeRe(n)}s?( |$)`);
  return (index.cards || []).find((c) => aliasesFor(c).some((a) => re.test(a))) || null;
}

/** Find a card by any of its names ("CloudTrail", "AWS CloudTrail", "ELB"). */
export function lookup(name, index) {
  return index.get(core(name)) || index.get(core(name).replace(/ support$/, '')) || fuzzyFind(name, index);
}

/** Cards named in this card's "Don't Confuse With" column that exist in the deck. */
export function confusedWith(card, index) {
  const found = [];
  for (const name of card.confuse) {
    const hit = index.get(core(name)) || index.get(core(name).replace(/ support$/, '')) || fuzzyFind(name, index);
    if (hit && hit.id !== card.id && !found.includes(hit)) found.push(hit);
  }
  return found;
}

/** Weighted random pick: Study It cards come up 4x as often as Know It cards. */
export function weightedPick(cards, levelOf, excludeIds = []) {
  const pool = cards.filter((c) => !excludeIds.includes(c.id));
  const list = pool.length ? pool : cards;
  const total = list.reduce((s, c) => s + LEVELS[levelOf(c)].weight, 0);
  let r = Math.random() * total;
  for (const c of list) {
    r -= LEVELS[levelOf(c)].weight;
    if (r <= 0) return c;
  }
  return list[list.length - 1];
}

/** Wrong answers that are actually tempting: look-alikes first, then same category, then same domain. */
export function distractors(card, cards, index, n = 3) {
  const picked = [];
  const add = (c) => {
    if (c && c.id !== card.id && !picked.some((p) => p.id === c.id || p.term === c.term) && picked.length < n) picked.push(c);
  };
  confusedWith(card, index).forEach(add);
  shuffle(cards.filter((c) => c.category === card.category)).forEach(add);
  shuffle(cards.filter((c) => c.domain === card.domain)).forEach(add);
  shuffle(cards).forEach(add);
  return picked;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Hide the answer's own name inside a clue. */
export function redact(text, card) {
  let out = text;
  const names = [card.term, card.term.replace(/^(AWS|Amazon)\s+/, '').replace(/\s*\(.*?\)/g, ''), ...[...card.term.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])]
    .filter((n) => n && n.length > 2)
    .sort((a, b) => b.length - a.length);
  for (const n of names) out = out.replace(new RegExp(escapeRe(n), 'gi'), '▢▢▢');
  return out;
}

/** One level down after a miss: Know It → Kinda, Kinda → Study It. */
export const demote = (level) => (level === 'green' ? 'yellow' : 'red');

/** Exam readiness: Know It = 100%, Kinda = 50%, Study It = 0%, each domain weighted by its exam %. */
export function readiness(cards, domains) {
  const rows = domains
    .map((d) => {
      const list = cards.filter((c) => c.domain === d.name);
      const counts = { red: 0, yellow: 0, green: 0 };
      list.forEach((c) => counts[c.level]++);
      const score = list.length ? list.reduce((s, c) => s + LEVELS[c.level].score, 0) / list.length : 0;
      return { ...d, total: list.length, counts, score };
    })
    .filter((d) => d.total > 0);
  const wsum = rows.reduce((s, d) => s + d.weight, 0) || 1;
  const overall = rows.reduce((s, d) => s + d.weight * d.score, 0) / wsum;
  return { rows, overall };
}

export const DOMAIN_TONES = ['concepts', 'security', 'tech', 'billing', 'other'];
export function domainTone(name) {
  const n = name.toLowerCase();
  if (n.includes('concept')) return 'concepts';
  if (n.includes('security')) return 'security';
  if (n.includes('technology') || n.includes('services')) return 'tech';
  if (n.includes('billing') || n.includes('pricing')) return 'billing';
  return 'other';
}

export const shortDomain = (name) =>
  ({ 'Cloud Concepts': 'Concepts', 'Security & Compliance': 'Security', 'Cloud Technology & Services': 'Tech & Services', 'Billing, Pricing & Support': 'Billing & Support' })[name] || name;
