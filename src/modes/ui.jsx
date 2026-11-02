import { useEffect, useId, useRef, useState } from 'react';
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
export function DeckSwitch({ value, onChange, counts, focusName }) {
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
        {counts.focus > 0 && (
          <button className={`deck-focus ${value === 'focus' ? 'is-on' : ''}`} onClick={() => onChange('focus')} aria-pressed={value === 'focus'} title={focusName ? `Focus deck: ${focusName}` : 'Focus deck'}>
            ★ Focus <span className="count">{counts.focus}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Searchable dropdown for jumping to a section of a long page.
 * items: [{ key, label, count }]. Type to filter, ↑/↓ to move, Enter to jump, Esc to close.
 */
export function JumpMenu({ items, onJump, label = 'Jump to section' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const wrap = useRef(null);
  const input = useRef(null);
  const listId = useId();

  const t = text.trim().toLowerCase();
  const shown = t ? items.filter((i) => i.label.toLowerCase().includes(t)) : items;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    input.current?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => setActive(0), [text]);
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const choose = (item) => {
    if (!item) return;
    setOpen(false);
    setText('');
    onJump(item.key);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="jump-menu" ref={wrap}>
      <button className="jump-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{label}</span>
        <span className="count">{items.length}</span>
        <span className="jump-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="jump-pop">
          <input
            ref={input}
            type="search"
            placeholder={`Search ${items.length} sections…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
            aria-label="Search sections"
          />
          <ul id={listId} role="listbox" className="jump-list">
            {shown.map((i, k) => (
              <li
                key={i.key}
                id={`${listId}-${k}`}
                role="option"
                aria-selected={k === active}
                className={k === active ? 'is-active' : ''}
                onMouseEnter={() => setActive(k)}
                onMouseDown={(e) => { e.preventDefault(); choose(i); }}
              >
                <span>{i.label}</span>
                <span className="count">{i.count}</span>
              </li>
            ))}
            {!shown.length && <li className="jump-empty">No section matches “{text}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Scroll a section into view below the sticky top bar and (when it's sticky) the filter bar. */
export function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const bar = document.querySelector('.topbar')?.getBoundingClientRect().height || 0;
  const tools = document.querySelector('.guide-tools');
  const sticky = tools && getComputedStyle(tools).position === 'sticky' ? tools.getBoundingClientRect().height + 8 : 0;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - bar - sticky - 12, behavior: 'smooth' });
}
