import { useEffect, useMemo, useState } from 'react';
import { weightedPick, confusedWith, redact } from '../lib/deck.js';
import { DomainChip, DomainFilter, LevelPill, ModeHeader, Triggers, Empty } from './ui.jsx';

const LEVEL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'red', label: 'Study It' },
  { id: 'yellow', label: 'Kinda' },
  { id: 'green', label: 'Know It' },
];

export default function Flashcards({ cards, domains, index, setLevel, record }) {
  const [domain, setDomain] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [direction, setDirection] = useState('term'); // 'term' = name on front, 'def' = definition on front
  const [currentId, setCurrentId] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [history, setHistory] = useState([]);
  const [reviewed, setReviewed] = useState(0);

  const categories = useMemo(() => [...new Set(cards.filter((c) => domain === 'all' || c.domain === domain).map((c) => c.category))].sort(), [cards, domain]);
  const basePool = useMemo(
    () => cards.filter((c) => (domain === 'all' || c.domain === domain) && (category === 'all' || c.category === category)),
    [cards, domain, category]
  );
  const pool = useMemo(() => basePool.filter((c) => levelFilter === 'all' || c.level === levelFilter), [basePool, levelFilter]);

  const current = pool.find((c) => c.id === currentId) || null;

  const next = () => {
    if (!pool.length) return;
    const recent = history.slice(-Math.min(8, pool.length - 1));
    const pick = weightedPick(pool, (c) => c.level, recent);
    setHistory((h) => [...h.slice(-20), pick.id]);
    setCurrentId(pick.id);
    setFlipped(false);
  };

  // Deal a card whenever filters change or the current card leaves the pool.
  useEffect(() => {
    if (!current) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const rate = (level) => {
    if (!current) return;
    setLevel(current.id, level);
    record(current, level === 'green' ? 'right' : level === 'red' ? 'wrong' : 'kinda');
    setReviewed((n) => n + 1);
    next();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === '1') rate('red');
      else if (flipped && e.key === '2') rate('yellow');
      else if (flipped && e.key === '3') rate('green');
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const counts = { red: 0, yellow: 0, green: 0 };
  basePool.forEach((c) => counts[c.level]++);
  const lookalikes = current ? confusedWith(current, index) : [];

  return (
    <div className="mode">
      <ModeHeader eyebrow={`${pool.length} cards in this stack · ${reviewed} rated this session`} title="Flashcards">
        <DomainFilter domains={domains} value={domain} onChange={(v) => { setDomain(v); setCategory('all'); }} id="fc-domain" />
        <label className="field" htmlFor="fc-category">
          <span className="field-label">Category</span>
          <select id="fc-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">Front shows</span>
          <div className="segmented" role="group" aria-label="Front of card shows">
            <button className={direction === 'term' ? 'is-on' : ''} onClick={() => { setDirection('term'); setFlipped(false); }}>Service</button>
            <button className={direction === 'def' ? 'is-on' : ''} onClick={() => { setDirection('def'); setFlipped(false); }}>Definition</button>
          </div>
        </div>
      </ModeHeader>

      <div className="segmented level-filter" role="group" aria-label="Filter by confidence">
        {LEVEL_FILTERS.map((f) => (
          <button key={f.id} className={`${levelFilter === f.id ? 'is-on' : ''} lf-${f.id}`} onClick={() => setLevelFilter(f.id)}>
            {f.label}
            <span className="count">{f.id === 'all' ? basePool.length : counts[f.id]}</span>
          </button>
        ))}
      </div>

      {!current ? (
        <Empty>No cards match these filters. Try another confidence level or domain.</Empty>
      ) : (
        <>
          <div className={`flashcard ${flipped ? 'is-flipped' : ''}`}>
            <button className="flashcard-inner" onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Show front of card' : 'Flip card'}>
              <div className="face face-front" aria-hidden={flipped}>
                <div className="face-top">
                  <DomainChip name={current.domain} />
                  <span className="category">{current.category}</span>
                  <LevelPill level={current.level} />
                </div>
                {direction === 'term' ? (
                  <div className="face-center">
                    <p className="card-term">{current.term}</p>
                  </div>
                ) : (
                  <div className="face-center">
                    <p className="card-definition">{redact(current.definition, current)}</p>
                    <Triggers items={current.triggers} />
                  </div>
                )}
                <p className="flip-hint">Tap or press space to flip</p>
              </div>

              <div className="face face-back" aria-hidden={!flipped}>
                <div className="face-top">
                  {direction === 'def' ? <p className="back-term">{current.term}</p> : <p className="back-term small">{current.term}</p>}
                </div>
                {current.hint && (
                  <p className="memory-hint">
                    <span className="label">Memory hint</span>
                    {current.hint}
                  </p>
                )}
                <dl className="back-details">
                  {current.eli12 && (
                    <div>
                      <dt>Like I’m 12</dt>
                      <dd>{current.eli12}</dd>
                    </div>
                  )}
                  {direction === 'term' && (
                    <div>
                      <dt>{current.source === 'questions' ? 'Why it’s the answer' : 'Exam definition'}</dt>
                      <dd>{current.definition}</dd>
                    </div>
                  )}
                  {current.official && (
                    <div className="official">
                      <dt>Official AWS definition</dt>
                      <dd>
                        {current.official}
                        {current.officialSource && (
                          <a className="source-link" href={current.officialSource} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            Source ↗
                          </a>
                        )}
                      </dd>
                    </div>
                  )}
                  {direction === 'term' && current.triggers.length > 0 && (
                    <div>
                      <dt>Exam triggers</dt>
                      <dd><Triggers items={current.triggers} /></dd>
                    </div>
                  )}
                  {current.confuse.length > 0 && (
                    <div>
                      <dt>{current.source === 'questions' ? 'Wrong choices in the quiz' : 'Don’t confuse with'}</dt>
                      <dd>
                        {current.confuse.join(', ')}
                        {lookalikes[0]?.hint && <span className="muted"> · {lookalikes[0].term}: {lookalikes[0].hint}</span>}
                      </dd>
                    </div>
                  )}
                  {current.related && current.related.term !== current.term && (
                    <div>
                      <dt>Study guide</dt>
                      <dd>{current.related.term}{current.related.hint && <span className="muted"> · {current.related.hint}</span>}</dd>
                    </div>
                  )}
                  {current.questions?.length > 0 && (
                    <div>
                      <dt>Asked as</dt>
                      <dd className="muted">{current.questions[0].text}</dd>
                    </div>
                  )}
                  {current.notes && (
                    <div>
                      <dt>My notes</dt>
                      <dd>{current.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </button>
          </div>

          <div className="rate-row" aria-live="polite">
            {flipped ? (
              <>
                <span className="rate-q">How well did you know it?</span>
                <button className="rate rate-red" onClick={() => rate('red')}><kbd>1</kbd> Study It</button>
                <button className="rate rate-yellow" onClick={() => rate('yellow')}><kbd>2</kbd> Kinda</button>
                <button className="rate rate-green" onClick={() => rate('green')}><kbd>3</kbd> Know It</button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => setFlipped(true)}>Flip card</button>
                <button className="btn btn-ghost" onClick={next}>Skip <kbd>→</kbd></button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
