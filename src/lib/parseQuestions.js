// Reads practice-question spreadsheets.
// Expected headers (case doesn't matter, order doesn't matter):
//   Question | Answer A | Answer B | Answer C | Answer D | (Answer E, F…) | Correct Answer | Concept Covered | Description on why its the right answer
//   Optional: Priority ("⚪ Low Priority – reason" hides the question unless low priority is switched on)
//   Optional: Related Concept (a name from the study guide; otherwise the app works it out from the correct answer)
// "Correct Answer" can be one letter ("B") or several for multiple-response questions ("B, D" or "B and D").
import * as XLSX from 'xlsx';

const norm = (v) => String(v ?? '').replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const LETTERS = 'ABCDEFGH';

const QUESTION = ['question', 'questions', 'question text'];
const CORRECT = ['correct answer', 'correct answers', 'correct', 'answer key', 'correct option'];
const TOPIC = ['concept covered', 'concept', 'topic', 'category'];
const PRIORITY = ['priority', 'low priority', 'coverage', 'status', 'exam guide coverage'];
const RELATED = ['related concept', 'study guide concept', 'related concepts'];
const WHY = ['description on why its the right answer', "description on why it's the right answer", 'explanation', 'why', 'reason', 'rationale'];

/** Short stable id from the question text, so the same question in two files counts once. */
export function questionId(text) {
  let h = 5381;
  const s = norm(text).replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `q${h.toString(36)}`;
}

function findHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r].map(norm);
    const q = cells.findIndex((c) => QUESTION.includes(c));
    const correct = cells.findIndex((c) => CORRECT.includes(c));
    if (q < 0 || correct < 0) continue;
    const options = [];
    cells.forEach((c, i) => {
      const m = c.match(/^(?:answer|option|choice)\s*([a-h])$/);
      if (m) options.push({ letter: m[1].toUpperCase(), col: i });
    });
    if (options.length < 2) continue;
    options.sort((a, b) => a.letter.localeCompare(b.letter));
    const find = (names) => {
      let i = cells.findIndex((c) => names.includes(c));
      if (i < 0) i = cells.findIndex((c) => names.some((n) => c.startsWith(n)));
      return i;
    };
    return { row: r, q, correct, options, topic: find(TOPIC), why: find(WHY), concept: cells.findIndex((c) => RELATED.includes(c)), priority: cells.findIndex((c) => PRIORITY.includes(c)) };
  }
  return null;
}

/** "B" → ['B']; "B, D" / "B and D" / "BD" → ['B','D']; also accepts the full answer text. */
function parseCorrect(raw, options) {
  const s = clean(raw);
  if (!s) return [];
  const upper = s.toUpperCase();
  if (/^[A-H](\s*(,|&|AND|\/|;|\s)\s*[A-H])*$/.test(upper)) return [...new Set(upper.match(/[A-H]/g))];
  if (/^[A-H]{2,}$/.test(upper)) return [...new Set(upper.split(''))];
  const byText = options.filter((o) => norm(o.text) === norm(s));
  if (byText.length) return byText.map((o) => o.letter);
  const lead = upper.match(/^([A-H])[).:\s]/);
  return lead ? [lead[1]] : [];
}

export function looksLikeQuestionFile(wb) {
  return wb.SheetNames.some((n) => findHeader(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })));
}

/** Returns { questions, skipped } where skipped lists rows that couldn't be used and why. */
export function parseQuestionWorkbook(wb, source = '') {
  const questions = [];
  const skipped = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const h = findHeader(rows);
    if (!h) continue;
    rows.slice(h.row + 1).forEach((row, k) => {
      const text = clean(row[h.q]);
      if (!text) return;
      const options = h.options.map((o) => ({ letter: o.letter, text: clean(row[o.col]) })).filter((o) => o.text);
      const correct = parseCorrect(row[h.correct], options).filter((l) => options.some((o) => o.letter === l));
      const where = `${name} row ${h.row + k + 2}`;
      if (options.length < 2) return skipped.push(`${where}: fewer than 2 answers`);
      if (!correct.length) return skipped.push(`${where}: "Correct Answer" doesn't match a filled-in answer`);
      questions.push({
        id: questionId(text),
        text,
        options,
        correct,
        topic: h.topic >= 0 ? clean(row[h.topic]) || 'General' : 'General',
        why: h.why >= 0 ? clean(row[h.why]) : '',
        concept: h.concept >= 0 ? clean(row[h.concept]) : '',
        lowPriority: h.priority >= 0 && /low|out of scope|retired|⚪/i.test(clean(row[h.priority])),
        priorityNote: h.priority >= 0 ? clean(row[h.priority]).replace(/^⚪\s*/, '').replace(/^low priority\s*[–—:-]?\s*/i, '') : '',
        source,
      });
    });
  }
  return { questions, skipped };
}

export function parseQuestionFile(data, type = 'array', source = '') {
  return parseQuestionWorkbook(XLSX.read(data, { type }), source);
}

/** Merge question lists; later lists win when the same question appears twice. */
export function mergeQuestions(...lists) {
  const map = new Map();
  for (const list of lists) for (const q of list || []) map.set(q.id, q);
  return [...map.values()];
}

export { LETTERS };
