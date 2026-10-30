// Turns the study-guide workbook into the deck the app uses.
// Columns are found by header name, so you can reorder or add columns freely —
// just keep these header names (case and emoji don't matter).
import * as XLSX from 'xlsx';

const COLUMNS = {
  term: ['aws product / concept', 'product / concept', 'term', 'concept'],
  category: ['category'],
  hint: ['memory hint'],
  eli12: ["explain like i'm 12", 'explain like im 12', 'eli12'],
  definition: ['exam definition', 'definition'],
  triggers: ['key exam words / trigger', 'key exam words', 'trigger'],
  confuse: ["don't confuse with", 'dont confuse with'],
  domain: ['clf-c02 domain', 'domain'],
  confidence: ['confidence'],
  notes: ['my notes', 'notes'],
  coverage: ['official exam guide coverage', 'exam guide coverage', 'coverage'],
  official: ['official aws definition', 'aws definition'],
  officialSource: ['official source', 'source'],
};

const DEFAULT_DOMAINS = [
  { name: 'Cloud Concepts', weight: 24 },
  { name: 'Security & Compliance', weight: 30 },
  { name: 'Cloud Technology & Services', weight: 34 },
  { name: 'Billing, Pricing & Support', weight: 12 },
];

const norm = (v) =>
  String(v ?? '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}/' &-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const splitList = (v) => clean(v).split(/[;\n]/).map((s) => s.trim()).filter(Boolean);

export function parseConfidence(v) {
  const s = String(v ?? '');
  if (s.includes('🟢') || /know it/i.test(s) && !/kinda/i.test(s)) return 'green';
  if (s.includes('🟡') || /kinda/i.test(s)) return 'yellow';
  if (s.includes('⚪') || /low priority|out of scope/i.test(s)) return 'low';
  return 'red';
}

function findHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cells = rows[r].map(norm);
    const termIdx = cells.findIndex((c) => COLUMNS.term.includes(c));
    const defIdx = cells.findIndex((c) => COLUMNS.definition.includes(c));
    if (termIdx >= 0 && defIdx >= 0) {
      const map = {};
      for (const [key, names] of Object.entries(COLUMNS)) {
        let idx = cells.findIndex((c) => names.includes(c));
        if (idx < 0) idx = cells.findIndex((c) => names.some((n) => c.includes(n)));
        map[key] = idx;
      }
      return { row: r, map };
    }
  }
  return null;
}

const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

export function parseWorkbook(data, type = 'array') {
  const wb = XLSX.read(data, { type });
  const sheetRows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });

  // 1) Master sheet: prefer the one named "Master Study Guide", else the first sheet with the right headers.
  const ordered = [...wb.SheetNames].sort((a, b) => (/master/i.test(b) ? 1 : 0) - (/master/i.test(a) ? 1 : 0));
  let master = null;
  for (const name of ordered) {
    const rows = sheetRows(name);
    const header = findHeader(rows);
    if (header) { master = { name, rows, header }; break; }
  }
  if (!master) {
    throw new Error('Couldn’t find a sheet with "AWS Product / Concept" and "Exam Definition" columns.');
  }

  const { rows, header } = master;
  const get = (row, key) => (header.map[key] >= 0 ? row[header.map[key]] : '');
  const ids = new Set();
  const cards = [];
  for (const row of rows.slice(header.row + 1)) {
    const term = clean(get(row, 'term'));
    if (!term) continue;
    const confidence = parseConfidence(get(row, 'confidence'));
    const coverage = clean(get(row, 'coverage'));
    const outOfScope = /low priority|out of scope|⚪/i.test(coverage);
    let id = slug(term);
    for (let n = 2; ids.has(id); n++) id = `${slug(term)}-${n}`;
    ids.add(id);
    cards.push({
      id,
      term,
      category: clean(get(row, 'category')) || 'Other',
      hint: clean(get(row, 'hint')),
      eli12: clean(get(row, 'eli12')),
      definition: clean(get(row, 'definition')),
      triggers: splitList(get(row, 'triggers')),
      confuse: splitList(get(row, 'confuse')),
      domain: clean(get(row, 'domain')) || 'Other',
      confidence: confidence === 'low' ? 'red' : confidence,
      lowPriority: confidence === 'low' || outOfScope,
      coverage,
      official: clean(get(row, 'official')),
      officialSource: /^https?:\/\//.test(clean(get(row, 'officialSource'))) ? clean(get(row, 'officialSource')) : '',
      notes: clean(get(row, 'notes')),
    });
  }

  // 2) Exam weights (optional "Exam Info" sheet).
  let domains = [];
  const infoName = wb.SheetNames.find((n) => /exam info/i.test(n));
  if (infoName) {
    for (const row of sheetRows(infoName)) {
      const m = String(row[1] ?? '').match(/(\d+(?:\.\d+)?)/);
      const raw = typeof row[1] === 'number' ? (row[1] <= 1 ? row[1] * 100 : row[1]) : m ? Number(m[1]) : NaN;
      if (clean(row[0]) && Number.isFinite(raw) && raw > 0) domains.push({ name: clean(row[0]), weight: Math.round(raw) });
    }
  }
  if (!domains.length) domains = DEFAULT_DOMAINS;
  // Any domain used by a card but missing from the weights table still gets a column.
  for (const c of cards) {
    if (!domains.some((d) => d.name === c.domain)) domains.push({ name: c.domain, weight: 10 });
  }

  // 3) Cheat sheet prompts (optional): "If the question says..." -> "Think..."
  const cheats = [];
  const cheatName = wb.SheetNames.find((n) => /cheat/i.test(n));
  if (cheatName) {
    const cRows = sheetRows(cheatName);
    const h = cRows.findIndex((r) => /question says/i.test(String(r[0])));
    for (const row of cRows.slice(h + 1)) {
      if (clean(row[0]) && clean(row[1])) cheats.push({ prompt: clean(row[0]), answer: clean(row[1]), reminder: clean(row[2]) });
    }
  }

  return { cards, domains, cheats, source: master.name, importedAt: new Date().toISOString() };
}
