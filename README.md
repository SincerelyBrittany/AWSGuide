<div align="center">

# ☁️ CLF-C02 Study Arcade

**Flashcards and study games for the AWS Certified Cloud Practitioner exam,<br>built straight from a study-guide spreadsheet.**

![React](https://img.shields.io/badge/React-18-149eca?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite&logoColor=white)
![Exam](https://img.shields.io/badge/AWS-CLF--C02-e2932f?style=flat-square)
![Concepts](https://img.shields.io/badge/concepts-248-23905f?style=flat-square)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/home-dark.png">
  <img src="docs/home-light.png" alt="Study Arcade home screen with an exam-readiness score broken down by exam domain" width="900">
</picture>

</div>

## Five ways to study

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/flashcards.png" alt="Flashcard showing the memory hint, definition, exam triggers and look-alike service">
      <h3>🃏 Flashcards</h3>
      Flip, then rate yourself <b>Study It · Kinda · Know It</b>. Cards you're weak on come back up to 4× as often. Flip direction, filter by domain or category.
    </td>
    <td width="50%" valign="top">
      <img src="docs/showdown.png" alt="Two look-alike services side by side with an exam clue">
      <h3>🥊 Don't Confuse Me</h3>
      One exam clue, two look-alikes from your <i>Don't Confuse With</i> column. CloudTrail or CloudWatch? SQS or SNS? Rounds of 10.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/rapid-fire.png" alt="Timed multiple-choice round">
      <h3>⏱️ Rapid-Fire</h3>
      60 seconds, four options, wrong answers pulled from the same category. Streaks multiply your score; misses cost 3 seconds.
    </td>
    <td width="50%" valign="top">
      <img src="docs/game-board.png" alt="Jeopardy-style board with one column per exam domain">
      <h3>🎯 Game Board</h3>
      Jeopardy-style, one column per exam domain. Tile values follow each domain's exam weight. Solo or pass-and-play for up to 4.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/memory-match.png" alt="Memory match grid pairing services with memory hints">
      <h3>🧩 Memory Match</h3>
      Pair each service with its memory hint or its “explain like I'm 12” line. A lighter review for tired brains.
    </td>
    <td width="50%" valign="top">
      <h3>🧠 It learns what you don't know</h3>
      Missing a question in any game moves that card down a confidence level, so it comes back more often everywhere.
      <br><br>
      The home screen turns your ratings into an <b>exam-readiness score</b>, weighted by how much each domain counts on the real exam.
      <br><br>
      Works offline, in light and dark mode, and on your phone.
    </td>
  </tr>
</table>

## 📈 Progress tracking

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/progress-dark.png">
  <img src="docs/progress-light.png" alt="Progress page with answer totals, accuracy, a study-next list and accuracy by exam domain" width="900">
</picture>

Every answer in Flashcards, Don't Confuse Me, Rapid-Fire and the Game Board is recorded. The **Progress** tab shows:

- **Totals:** questions answered, accuracy, concepts practiced and study sessions
- **Study these next:** the concepts you miss most, ranked by misses, accuracy and recent mistakes
- **By exam domain:** your accuracy in each domain next to its exam weight
- **Recent sessions:** when you studied, which mode, right/wrong and what you missed
- **All concepts:** a sortable, searchable table of all 248 concepts, with right/wrong counts, accuracy, your last 8 answers and a status (Not practiced → Struggling → Learning → Mastered)

A session is one stretch of play in one mode. Switching modes or 30 idle minutes starts a new one.

### Where your data lives

Everything is saved in your browser's `localStorage`. No account, no server, no cost, and nothing leaves your device. That also means history is per browser, so use **Export backup** on the Progress page to save a `.json` file, and **Restore backup** to load it on another device or after clearing your browser data.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. Keyboard: <kbd>Space</kbd> flips · <kbd>1</kbd>–<kbd>4</kbd> answer · <kbd>Enter</kbd> continues.

## Adding concepts

The whole app is driven by [`data/AWS CLF-C02 Study Guide.xlsx`](data/). Add rows, then either:

| | How | Good for |
| --- | --- | --- |
| **Import in the app** | Click **Import .xlsx** and pick the file | Quick updates. Saved in that browser |
| **Bake it in** | Replace the file in `data/` and run `npm run sync` | Making it the default for everyone |

Your ratings are kept either way.

<details>
<summary><b>Spreadsheet columns</b></summary>
<br>

Columns are matched by header name, so order doesn't matter and extra columns are ignored.

| Column | Used for |
| --- | --- |
| `AWS Product / Concept` | Card name *(required)* |
| `Exam Definition` | Card back and game clues *(required)* |
| `⭐ Memory Hint` | Flashcards, Memory Match |
| `Explain Like I'm 12` | Flashcards, Game Board, Memory Match |
| `Key Exam Words / Trigger` | Rapid-Fire and Game Board clues. Separate with `;` |
| `Don't Confuse With` | Look-alike pairs and wrong answers. Separate with `;` |
| `CLF-C02 Domain` | Filters and Game Board columns |
| `Category` | Filters, and picks believable wrong answers |
| `Confidence` | 🔴 Study It · 🟡 Kinda Know It · 🟢 Know It · ⚪ Low Priority |
| `Official Exam Guide Coverage` | ⚪ Out of Scope rows are hidden unless you turn them on |
| `My Notes` | Shown on the card back and after a miss |
| `Official AWS Definition` | Quoted from AWS documentation, shown on the card back |
| `Official Source` | Link to the AWS page each official definition came from |

The **Exam Info** sheet sets the domain weights and **Exam Cheat Sheet** adds extra Rapid-Fire prompts.
</details>

<details>
<summary><b>Project structure</b></summary>
<br>

```
data/                      the study guide spreadsheet
scripts/sync-data.mjs      spreadsheet → src/data/studyGuide.json
src/
  lib/parseWorkbook.js     reads the .xlsx (shared by the app and the sync script)
  lib/deck.js              look-alike matching, weighted picks, question building
  lib/stats.js             answer history, sessions, mastery rules
  lib/storage.js           ratings, history, imported deck and best scores (localStorage)
  modes/                   one file per study mode, plus Progress.jsx
  styles.css               light and dark theme tokens and all styles
```
</details>

## Deploy to GitHub Pages

A workflow in `.github/workflows/deploy.yml` builds and publishes the site on every push to `main`. One-time setup:

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the workflow from the **Actions** tab).

The site goes live at `https://<your-username>.github.io/AWSGuide/`.

> GitHub Pages is free for **public** repos. A private repo needs a paid GitHub plan, and the published site is public either way.

Other build options:

```bash
npm run build          # static site in dist/ (works on any static host)
npm run build:single   # one self-contained HTML file in dist-single/
```

---

<sub>A personal study tool. Not affiliated with or endorsed by Amazon Web Services.</sub>
