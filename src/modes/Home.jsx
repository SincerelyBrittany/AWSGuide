import { useState } from 'react';
import { readiness, domainTone } from '../lib/deck.js';

export default function Home({ deckSwitch, focusCount = 0, cards, deck, domains, modes, settings, setSettings, isImported, onImportClick, onUseBuiltIn, onResetProgress }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { rows, overall } = readiness(cards, domains);
  const totals = { red: 0, yellow: 0, green: 0 };
  cards.forEach((c) => totals[c.level]++);
  const lowCount = deck.cards.filter((c) => c.lowPriority).length;
  const pct = Math.round(overall * 100);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AWS Certified Cloud Practitioner · CLF-C02</p>
          <h1 className="hero-title">
            {cards.length} concepts.
            <br />
            Seven ways to drill them.
          </h1>
          <p className="lede">
            Everything here comes from your study guide spreadsheet. Rate cards as you go, and the cards you mark <em>Study It</em> show up more often in every game.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#flashcards">Start with flashcards</a>
            <a className="btn btn-ghost" href="#rapid">Play a 60-second round</a>
            <a className="btn btn-ghost" href="#guide">Read the study guide</a>
            {focusCount > 0 && (
              <button className="btn btn-focus" onClick={() => { setSettings({ ...settings, source: 'focus' }); window.location.hash = 'flashcards'; }}>
                ★ Drill my focus deck ({focusCount})
              </button>
            )}
          </div>
        </div>

        <div className="readiness" aria-label="Exam readiness">
          <div className="readiness-head">
            <span className="readiness-label">Exam readiness</span>
            <span className="readiness-num">
              {pct}
              <small>%</small>
            </span>
          </div>
          <p className="readiness-note">Weighted by each domain’s share of the exam. Know It counts fully, Kinda Know It counts half.</p>

          <ul className="domain-bars">
            {rows.map((d) => (
              <li key={d.name}>
                <div className="domain-bar-top">
                  <span className={`dot tone-${domainTone(d.name)}`} aria-hidden="true" />
                  <span className="domain-name">{d.name}</span>
                  <span className="domain-weight">{d.weight}% of exam</span>
                </div>
                <div className="stack" role="img" aria-label={`${d.counts.green} know it, ${d.counts.yellow} kinda, ${d.counts.red} study it, of ${d.total}`}>
                  <span className="seg seg-green" style={{ flexGrow: d.counts.green }} />
                  <span className="seg seg-yellow" style={{ flexGrow: d.counts.yellow }} />
                  <span className="seg seg-red" style={{ flexGrow: d.counts.red }} />
                </div>
                <div className="domain-counts">
                  <span>{d.counts.green} know</span>
                  <span>{d.counts.yellow} kinda</span>
                  <span>{d.counts.red} study</span>
                </div>
              </li>
            ))}
          </ul>
          <a className="readiness-link" href="#progress">See right/wrong history for every concept →</a>
        </div>
      </section>

      <section aria-labelledby="modes-h">
        <h2 id="modes-h" className="section-title">Pick a mode</h2>
        <div className="mode-grid">
          {modes.map((m) => (
            <a key={m.id} href={`#${m.id}`} className={`mode-card mode-${m.id}`}>
              <ModeGlyph id={m.id} />
              <span className="mode-card-title">{m.label}</span>
              <span className="mode-card-blurb">{m.blurb}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="deck-panel" aria-labelledby="deck-h">
        <div className="deck-panel-main">
          <h2 id="deck-h" className="section-title">Your deck</h2>
          <p>
            {isImported ? 'Imported' : 'Built in from'} <strong>{deck.source}</strong>
            {isImported && <> on {new Date(deck.importedAt).toLocaleDateString()}</>}: {deck.cards.length} concepts
            {lowCount > 0 && !settings.includeLow && <> ({cards.length} in play, {lowCount} low priority hidden)</>}. {totals.green} know it · {totals.yellow} kinda · {totals.red} to study.
          </p>
          <div className="home-deck-switch">
            {deckSwitch}
            <p className="muted">Flashcards, the games and Progress use this deck. <strong>Questions Guide</strong> turns each quiz answer and its explanation into a card. <strong>★ Focus</strong> is a temporary deck aimed at your practice-test mistakes.</p>
          </div>
          <p className="muted">
            Added rows to your spreadsheet? Import it here and the new concepts appear in every mode. Keep the same column headers. Imports and ratings are saved in this browser only, so import again if you switch browsers or devices.
          </p>
        </div>
        <div className="deck-actions">
          <button className="btn btn-primary" onClick={onImportClick}>Import updated spreadsheet</button>
          {isImported && (
            <button className="btn btn-ghost" onClick={onUseBuiltIn}>Use built-in deck</button>
          )}
          <label className="toggle" htmlFor="include-low">
            <input id="include-low" type="checkbox" checked={settings.includeLow} onChange={(e) => setSettings({ ...settings, includeLow: e.target.checked })} />
            <span>Include low-priority / out-of-scope cards ({lowCount})</span>
          </label>
          {confirmReset ? (
            <div className="confirm">
              <span>Clear all your ratings?</span>
              <button className="btn btn-danger" onClick={() => { onResetProgress(); setConfirmReset(false); }}>Reset</button>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-link" onClick={() => setConfirmReset(true)}>Reset my ratings</button>
          )}
        </div>
      </section>
    </div>
  );
}

function ModeGlyph({ id }) {
  const common = { width: 44, height: 44, viewBox: '0 0 44 44', 'aria-hidden': true, className: 'mode-glyph' };
  switch (id) {
    case 'flashcards':
      return (
        <svg {...common}>
          <rect x="9" y="7" width="24" height="30" rx="3" fill="var(--glyph-2)" transform="rotate(-8 21 22)" />
          <rect x="12" y="8" width="24" height="30" rx="3" fill="var(--glyph-1)" />
          <rect x="16" y="15" width="16" height="3" rx="1.5" fill="var(--surface)" />
          <rect x="16" y="21" width="11" height="3" rx="1.5" fill="var(--surface)" />
        </svg>
      );
    case 'showdown':
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="24" rx="3" fill="var(--glyph-1)" />
          <rect x="24" y="10" width="16" height="24" rx="3" fill="var(--glyph-2)" />
          <path d="M22 6v32" stroke="var(--fg)" strokeWidth="2" strokeDasharray="3 3" />
        </svg>
      );
    case 'rapid':
      return (
        <svg {...common}>
          <circle cx="22" cy="24" r="15" fill="var(--glyph-2)" />
          <path d="M22 24V14" stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" />
          <path d="M22 24l7 4" stroke="var(--glyph-1)" strokeWidth="3" strokeLinecap="round" />
          <rect x="18" y="4" width="8" height="4" rx="1" fill="var(--fg)" />
        </svg>
      );
    case 'board':
      return (
        <svg {...common}>
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={5 + c * 12} y={5 + r * 12} width="10" height="10" rx="2" fill={(r + c) % 2 ? 'var(--glyph-2)' : 'var(--glyph-1)'} />
          )))}
        </svg>
      );
    case 'quiz':
      return (
        <svg {...common}>
          <rect x="7" y="5" width="30" height="34" rx="4" fill="var(--glyph-2)" />
          <circle cx="14" cy="15" r="3" fill="var(--glyph-1)" />
          <rect x="20" y="13.5" width="12" height="3" rx="1.5" fill="var(--fg)" />
          <circle cx="14" cy="24" r="3" fill="none" stroke="var(--fg)" strokeWidth="1.6" />
          <rect x="20" y="22.5" width="10" height="3" rx="1.5" fill="var(--fg)" opacity="0.5" />
          <circle cx="14" cy="33" r="3" fill="none" stroke="var(--fg)" strokeWidth="1.6" />
          <rect x="20" y="31.5" width="8" height="3" rx="1.5" fill="var(--fg)" opacity="0.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="15" height="15" rx="3" fill="var(--glyph-1)" />
          <rect x="24" y="5" width="15" height="15" rx="3" fill="var(--glyph-2)" />
          <rect x="5" y="24" width="15" height="15" rx="3" fill="var(--glyph-2)" />
          <rect x="24" y="24" width="15" height="15" rx="3" fill="var(--glyph-1)" />
          <path d="M9 12.5l3 3 5-6" stroke="var(--surface)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M28 31.5l3 3 5-6" stroke="var(--surface)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      );
  }
}
