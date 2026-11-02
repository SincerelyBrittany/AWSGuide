// Rebuilds the built-in deck from your spreadsheet.
// Also merges every .xlsx in data/questions/ into src/data/questions.json for the Quiz.
// Usage: npm run sync            (reads data/AWS CLF-C02 Study Guide.xlsx)
//        npm run sync -- path/to/other.xlsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorkbook } from '../src/lib/parseWorkbook.js';
import { parseQuestionFile, mergeQuestions } from '../src/lib/parseQuestions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2]
  ? path.resolve(process.argv[2])
  : (() => {
      const dir = path.join(root, 'data');
      const file = fs.readdirSync(dir).find((f) => f.endsWith('.xlsx') && !f.startsWith('~$'));
      if (!file) throw new Error('Put your study guide .xlsx in the data/ folder.');
      return path.join(dir, file);
    })();

const deck = parseWorkbook(fs.readFileSync(input), 'buffer');
const out = path.join(root, 'src', 'data', 'studyGuide.json');
fs.writeFileSync(out, JSON.stringify(deck, null, 2));

const low = deck.cards.filter((c) => c.lowPriority).length;
console.log(`✓ ${deck.cards.length} concepts (${low} low priority) from "${path.basename(input)}" → src/data/studyGuide.json`);
console.log(`  Domains: ${deck.domains.map((d) => `${d.name} ${d.weight}%`).join(' · ')}`);
console.log(`  Cheat-sheet prompts: ${deck.cheats.length}`);

// Practice questions: every .xlsx in data/questions/ (same question in two files counts once).
const qDir = path.join(root, 'data', 'questions');
const qFiles = fs.existsSync(qDir) ? fs.readdirSync(qDir).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$')).sort() : [];
const lists = [];
for (const f of qFiles) {
  const { questions, skipped } = parseQuestionFile(fs.readFileSync(path.join(qDir, f)), 'buffer', f.replace(/\.xlsx$/, ''));
  lists.push(questions);
  console.log(`  ${f}: ${questions.length} questions`);
  for (const s of skipped) console.log(`    ⚠ skipped ${s}`);
}
const bank = mergeQuestions(...lists);
fs.writeFileSync(path.join(root, 'src', 'data', 'questions.json'), JSON.stringify({ questions: bank }, null, 2));
console.log(`✓ ${bank.length} practice questions → src/data/questions.json`);

// Private questions (data/private/*.xlsx): your own study material that stays out of the public repo.
// They go to src/data/privateQuestions.json, which is git-ignored; builds without it simply skip them.
const pDir = path.join(root, 'data', 'private');
const pOut = path.join(root, 'src', 'data', 'privateQuestions.json');
const pFiles = fs.existsSync(pDir) ? fs.readdirSync(pDir).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$')).sort() : [];
if (pFiles.length) {
  const pLists = pFiles.map((f) => {
    const { questions, skipped } = parseQuestionFile(fs.readFileSync(path.join(pDir, f)), 'buffer', f.replace(/\.xlsx$/, ''));
    console.log(`  (private) ${f}: ${questions.length} questions`);
    for (const s of skipped) console.log(`    ⚠ skipped ${s}`);
    return questions.map((q) => ({ ...q, private: true }));
  });
  const pBank = mergeQuestions(...pLists);
  fs.writeFileSync(pOut, JSON.stringify({ questions: pBank }, null, 2));
  console.log(`✓ ${pBank.length} private questions → src/data/privateQuestions.json (not committed)`);
} else if (fs.existsSync(pOut)) fs.unlinkSync(pOut);

// Focus deck (data/focus/*.xlsx, same columns as the study guide): a temporary, separate deck.
// Delete the file and run `npm run sync` to remove it; the "Focus" option disappears when it's empty.
const fDir = path.join(root, 'data', 'focus');
const fFiles = fs.existsSync(fDir) ? fs.readdirSync(fDir).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$')).sort() : [];
const focusCards = [];
let focusName = '';
for (const f of fFiles) {
  const d = parseWorkbook(fs.readFileSync(path.join(fDir, f)), 'buffer');
  focusName = focusName || f.replace(/\.xlsx$/, '').replace(/^Focus Deck\s*[-–]\s*/i, '');
  for (const c of d.cards) focusCards.push({ ...c, id: `fx-${c.id}`, source: 'focus' });
}
fs.writeFileSync(path.join(root, 'src', 'data', 'focus.json'), JSON.stringify({ name: focusName, cards: focusCards }, null, 2));
console.log(`✓ ${focusCards.length} focus cards${focusName ? ` ("${focusName}")` : ''} → src/data/focus.json`);
