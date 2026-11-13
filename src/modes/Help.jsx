import { ModeHeader } from './ui.jsx';

/** One page that explains how the app fits together. */
export default function Help({ modes, onImportClick }) {
  const games = modes.filter((m) => m.group === 'practice');
  return (
    <div className="help">
      <ModeHeader eyebrow="How Study Arcade works" title="Help" />

      <section className="help-section">
        <h2 className="section-title">The five tabs</h2>
        <dl className="help-list">
          <dt><a href="#practice">Practice</a></dt>
          <dd>All the games in one place. Pick a deck, then a game.</dd>
          <dt><a href="#quiz">Quiz</a></dt>
          <dd>Exam-style multiple-choice questions with explanations. Practice at your own pace, or run a timed exam simulation.</dd>
          <dt><a href="#guide">Guides</a></dt>
          <dd>Reading material. The <strong>Study Guide</strong> lists every concept from the spreadsheet. The <strong>Questions Guide</strong> turns each quiz answer and its explanation into a card.</dd>
          <dt><a href="#progress">Progress</a></dt>
          <dd>Right and wrong history for every concept, your sessions, and backup and restore.</dd>
          <dt>Help</dt>
          <dd>This page.</dd>
        </dl>
      </section>

      <section className="help-section">
        <h2 className="section-title">The games</h2>
        <dl className="help-list">
          {games.map((m) => (
            <div key={m.id} className="help-row">
              <dt><a href={`#${m.id}`}>{m.label}</a></dt>
              <dd>{m.blurb}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="help-section">
        <h2 className="section-title">Decks</h2>
        <p>Flashcards, the games and Progress use whichever deck you switch on. Your choice is remembered.</p>
        <dl className="help-list">
          <dt>Study Guide</dt>
          <dd>Every concept from the study-guide spreadsheet: memory hint, definition, exam triggers and look-alikes.</dd>
          <dt>Questions Guide</dt>
          <dd>One card per quiz answer, defined by why that answer is right.</dd>
          <dt>Vocab</dt>
          <dd>The vocabulary sheet. Also powers the Vocab Guess game.</dd>
          <dt>★ Focus</dt>
          <dd>A short, temporary deck aimed at practice-test mistakes.</dd>
        </dl>
      </section>

      <section className="help-section">
        <h2 className="section-title">Ratings</h2>
        <p>
          After a flashcard flips, rate it <span className="pill pill-red">Study It</span>{' '}
          <span className="pill pill-yellow">Kinda Know It</span> or <span className="pill pill-green">Know It</span>. Study It cards come back more often in every game, and a miss in most games drops a card one level. Exam readiness on the home page is weighted by each domain's share of the exam.
        </p>
      </section>

      <section className="help-section">
        <h2 className="section-title">Keyboard shortcuts</h2>
        <ul className="help-keys">
          <li><kbd>Space</kbd> or <kbd>Enter</kbd> flips a flashcard</li>
          <li><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> rate a flipped card</li>
          <li><kbd>1</kbd>–<kbd>4</kbd> pick an answer in the games</li>
          <li><kbd>Enter</kbd> continues</li>
          <li><kbd>S</kbd> skips and <kbd>F</kbd> flags in Vocab Guess</li>
        </ul>
      </section>

      <section className="help-section">
        <h2 className="section-title">Adding your own material</h2>
        <p>
          Import an updated study-guide spreadsheet, or a quiz question sheet (Question, Answer A–D, Correct Answer). The app tells which one it is. Keep the same column headers.
        </p>
        <button className="btn btn-primary" onClick={onImportClick}>Import a spreadsheet</button>
      </section>

      <section className="help-section">
        <h2 className="section-title">Where your data lives</h2>
        <p>
          Ratings, answer history and imports are saved in this browser only. To move them to another browser or device, download a backup from <a href="#progress">Progress</a> and restore it there.
        </p>
      </section>
    </div>
  );
}
