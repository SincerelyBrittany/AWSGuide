import { LEVELS, domainTone, shortDomain } from '../lib/deck.js';

export function LevelPill({ level }) {
  return <span className={`pill pill-${level}`}>{LEVELS[level].label}</span>;
}

export function DomainChip({ name, short = true }) {
  return <span className={`chip tone-${domainTone(name)}`}>{short ? shortDomain(name) : name}</span>;
}

export function DomainFilter({ domains, value, onChange, id = 'domain-filter' }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">Domain</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All domains</option>
        {domains.map((d) => (
          <option key={d.name} value={d.name}>
            {d.name} ({d.weight}%)
          </option>
        ))}
      </select>
    </label>
  );
}

/** Multiple-choice answer button that shows right/wrong after answering. */
export function Choice({ index, label, sub, state, onClick, disabled }) {
  return (
    <button className={`choice ${state ? `is-${state}` : ''}`} onClick={onClick} disabled={disabled}>
      {index != null && <kbd className="choice-key">{index + 1}</kbd>}
      <span className="choice-body">
        <span className="choice-label">{label}</span>
        {sub && <span className="choice-sub">{sub}</span>}
      </span>
    </button>
  );
}

export function Triggers({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="triggers" aria-label="Key exam words">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function ModeHeader({ title, children, eyebrow }) {
  return (
    <div className="mode-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mode-title">{title}</h1>
      </div>
      {children && <div className="mode-controls">{children}</div>}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

/** Which deck Flashcards, the games and Progress use. */
export function DeckSwitch({ value, onChange, counts }) {
  return (
    <div className="deck-switch">
      <span className="field-label">Studying</span>
      <div className="segmented" role="group" aria-label="Deck to study">
        <button className={value === 'guide' ? 'is-on' : ''} onClick={() => onChange('guide')} aria-pressed={value === 'guide'}>
          Study Guide <span className="count">{counts.guide}</span>
        </button>
        <button className={value === 'questions' ? 'is-on' : ''} onClick={() => onChange('questions')} aria-pressed={value === 'questions'} disabled={!counts.questions}>
          Questions Guide <span className="count">{counts.questions}</span>
        </button>
      </div>
    </div>
  );
}
