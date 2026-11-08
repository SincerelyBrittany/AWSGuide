// Reads the vocabulary sheet for Vocab Guess.
// Columns (matched by name): TERM | DEFINITION | CATEGORY | THINK — MEMORY CLUE | STUDY PRIORITY | EXAMPLE QUESTION (optional)
import * as XLSX from 'xlsx';

const norm = (v) => String(v ?? '').toLowerCase().replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim();
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const COLS = {
  term: ['term', 'word', 'aws product / concept'],
  definition: ['definition', 'exam definition'],
  category: ['category'],
  think: ['think memory clue', 'think', 'memory clue', 'hint', 'think of'],
  priority: ['study priority', 'priority'],
  example: ['example question', 'example'],
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Map vocabulary categories onto the four exam domains (used by the domain filters and Game Board).
export function domainFor(category) {
  const c = norm(category);
  if (c.startsWith('cloud concepts')) return 'Cloud Concepts';
  if (c.startsWith('security')) return 'Security & Compliance';
  if (c.startsWith('billing')) return 'Billing, Pricing & Support';
  return 'Cloud Technology & Services';
}

export function parseVocab(data, type = 'array') {
  const wb = XLSX.read(data, { type });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    for (let h = 0; h < Math.min(rows.length, 10); h++) {
      const cells = rows[h].map(norm);
      const at = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, cells.findIndex((c) => names.includes(c))]));
      if (at.term < 0 || at.definition < 0) continue;
      const seen = new Set();
      const cards = [];
      for (const row of rows.slice(h + 1)) {
        const term = clean(row[at.term]);
        const definition = clean(row[at.definition]);
        if (!term || !definition) continue;
        let id = `vx-${slug(term)}`;
        while (seen.has(id)) id += '-2';
        seen.add(id);
        const category = at.category >= 0 ? clean(row[at.category]) || 'General' : 'General';
        cards.push({
          id,
          term,
          definition,
          category,
          think: at.think >= 0 ? clean(row[at.think]) : '',
          priority: at.priority >= 0 ? clean(row[at.priority]) || 'Medium' : 'Medium',
          example: at.example >= 0 ? clean(row[at.example]) : '',
          domain: domainFor(category),
        });
      }
      if (cards.length) return { sheet: name, cards };
    }
  }
  return { sheet: '', cards: [] };
}
