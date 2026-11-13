import { ModeHeader } from './ui.jsx';
import { ModeGlyph } from './Home.jsx';

/** Hub for every game. The deck switch here applies to Flashcards, the games and Progress. */
export default function Practice({ modes, deckSwitch }) {
  const games = modes.filter((m) => m.group === 'practice');
  return (
    <div className="practice">
      <ModeHeader eyebrow={`${games.length} games`} title="Practice" />
      <div className="practice-deck">
        {deckSwitch}
        <p className="muted small">Pick the deck first, then a game. Vocab Guess always uses the vocabulary sheet.</p>
      </div>
      <div className="mode-grid">
        {games.map((m) => (
          <a key={m.id} href={`#${m.id}`} className={`mode-card mode-${m.id}`}>
            <ModeGlyph id={m.id} />
            <span className="mode-card-title">{m.label}</span>
            <span className="mode-card-blurb">{m.blurb}</span>
          </a>
        ))}
      </div>
      <p className="muted small practice-foot">
        Want exam-style questions instead? Try the <a href="#quiz">Quiz</a>. New here? Read <a href="#help">Help</a>.
      </p>
    </div>
  );
}
