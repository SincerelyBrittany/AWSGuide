# CLF-C02 Study Arcade

Flashcards and four study games built from your AWS Cloud Practitioner study guide spreadsheet.

| Mode | What it does |
| --- | --- |
| **Flashcards** | Flip cards, rate yourself (Study It / Kinda / Know It). Weak cards come back more often. Flip direction: service → definition, or definition → service. Filter by domain, category, confidence. |
| **Don't Confuse Me** | One exam clue, two look-alike services from your "Don't Confuse With" column. Rounds of 10. |
| **Rapid-Fire** | 60 seconds, four options, wrong answers from the same category. Streak multiplier, −3s per miss. Uses your Exam Cheat Sheet prompts too. |
| **Game Board** | Jeopardy-style, one column per exam domain. Tile values = row × domain weight × 10. 1–4 players, pass-and-play. |
| **Memory Match** | Pair each service with its memory hint (or "Like I'm 12" line). 6, 8 or 10 pairs. |

Missing a question in any game moves that card down one confidence level, so it shows up more in flashcards.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Keyboard: `space` flips a card, `1`–`4` answer, `Enter` continues.

## Updating your study guide

Two ways. Both keep your ratings.

1. **In the app**: click **Import .xlsx** and pick your updated spreadsheet. The new deck is saved in your browser.
2. **Bake it in**: replace the file in `data/` and run:

   ```bash
   npm run sync
   ```

   This rewrites `src/data/studyGuide.json`, which is the deck the app ships with.

The parser finds columns by header name, so you can reorder columns or add new ones. Keep these headers:

`AWS Product / Concept` · `Category` · `Memory Hint` · `Explain Like I'm 12` · `Exam Definition` · `Key Exam Words / Trigger` · `Don't Confuse With` · `CLF-C02 Domain` · `Confidence` · `My Notes`

Tips:
- Separate multiple trigger words or look-alikes with `;`.
- "Don't Confuse With" entries are matched loosely (`CloudTrail`, `AWS CloudTrail` and `ELB` all work). A look-alike only appears in games if it also has its own row.
- Confidence: 🔴 Study It, 🟡 Kinda Know It, 🟢 Know It, ⚪ Low Priority (hidden unless you turn it on).
- Domain weights come from the **Exam Info** sheet; cheat-sheet prompts from **Exam Cheat Sheet**.

## Build

```bash
npm run build          # static site in dist/ (deploy anywhere: Netlify, Vercel, S3 + CloudFront)
npm run build:single   # one self-contained file: dist-single/index.html
```

## Project layout

```
data/                      your spreadsheet
scripts/sync-data.mjs      spreadsheet → src/data/studyGuide.json
src/lib/parseWorkbook.js   reads the .xlsx (shared by the app and the sync script)
src/lib/deck.js            look-alike matching, weighted picks, question building
src/lib/storage.js         saves ratings, imported deck and best scores in localStorage
src/modes/*.jsx            one file per mode
src/styles.css             theme tokens (light + dark) and all styles
```

Note: this uses the `xlsx` (SheetJS) 0.18.5 package from npm, which `npm audit` flags. It only ever parses your own files, so the risk is low. If you want the newer version: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
