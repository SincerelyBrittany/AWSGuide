import { useEffect, useMemo, useRef, useState } from 'react';
import { shuffle, weightedPick, redact } from '../lib/deck.js';
import { loadBest, saveBest } from '../lib/storage.js';
import { ModeHeader } from './ui.jsx';

// Points for a right answer, by how many clues you used: definition only, + hint, + example question.
const POINTS = [3, 2, 1];
const COUNTS = [10, 20, 'all'];

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^(aws|amazon)\s+/, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Every way of writing the term that should count: full name, without the parenthetical, the abbreviation, without AWS/Amazon. */
function acceptedAnswers(term) {
  const out = new Set([norm(term)]);
  const bare = term.replace(/\s*\(.*?\)/g, '').trim();
  if (bare) out.add(norm(bare));
  for (const m of term.matchAll(/\(([^)]+)\)/g)) out.add(norm(m[1]));
  for (const x of [...out]) out.add(x.replace(/^(aws|amazon) /, ''));
  return [...out].filter(Boolean);
}

export function typedMatches(guess, term) {
  const g = norm(guess);
  if (!g) return false;
  return acceptedAnswers(term).some((a) => a === g || (a.length >= 6 && distance(a, g) <= (a.length >= 12 ? 2 : 1)));
}

/** Three believable wrong options: same category first, then anything. */
function optionsFor(card, pool) {
  const same = shuffle(pool.filter((c) => c.id !== card.id && c.category === card.category));
  const rest = shuffle(pool.filter((c) => c.id !== card.id && c.category !== card.category));
  return shuffle([card, ...[...same, ...rest].slice(0, 3)]);
}

function FlagButton({ on, onClick, small }) {
  return (
    <button
      type="button"
      className={`btn ${small ? 'btn-link vocab-flag-sm' : 'btn-ghost'} vocab-flag ${on ? 'is-on' : ''}`}
      onClick={onClick}
      aria-pressed={on}
      title={on ? 'Flagged for review: click to unflag' : 'Flag for review'}
    >
      {on ? '⚑' : '⚐'}{small ? '' : on ? ' Flagged' : ' Flag'}{!small && <kbd>F</kbd>}
    </button>
  );
}

export default function VocabGuess({ vocab, examples, record, missed, levelOf, skips = {}, setSkips = () => {}, flags = {}, setFlags = () => {}, stats = { concepts: {} } }) {
  const [category, setCategory] = useState('all');
  const [priority, setPriority] = useState('all');
  const [style, setStyle] = useState('choice'); // 'choice' | 'type'
  const [count, setCount] = useState(10);
  const [groups, setGroups] = useState([]); // Which terms: empty = all; otherwise any mix of new / skipped / missed / passed / flagged

  const [phase, setPhase] = useState('setup');
  const [round, setRound] = useState([]);
  const [pos, setPos] = useState(0);
  const [clues, setClues] = useState(0); // 0 = definition, 1 = + hint, 2 = + example
  const [options, setOptions] = useState([]);
  const [typed, setTyped] = useState('');
  const [answer, setAnswer] = useState(null); // { ok, picked, points }
  const [results, setResults] = useState([]);
  const [best, setBest] = useState(() => loadBest());
  const [newBest, setNewBest] = useState(false);
  const inputRef = useRef(null);

  const categories = useMemo(() => [...new Set(vocab.map((v) => v.category))].sort(), [vocab]);
  // Which terms. Pick any mix of groups; a term is in the round if it's in ANY picked group. Nothing picked = all terms.
  const isSkipped = (v) => !!skips[v.id];
  const isMissed = (v) => stats.concepts[v.id]?.lastResult === 'wrong';
  const isPassed = (v) => stats.concepts[v.id]?.lastResult === 'right'; // last answer was right
  // Not tried yet: never answered (in Vocab Guess or on the Vocab deck anywhere) and never skipped.
  const isNew = (v) => !stats.concepts[v.id] && !skips[v.id];
  const isFlagged = (v) => !!flags[v.id];
  const TEST = { new: isNew, skipped: isSkipped, missed: isMissed, passed: isPassed, flagged: isFlagged };
  const inSet = (v) => !groups.length || groups.some((g) => TEST[g](v));
  const toggleGroup = (g) => setGroups((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));
  const pool = useMemo(
    () =>
      vocab.filter(
        (v) => (category === 'all' || v.category === category) && (priority === 'all' || v.priority === priority) && inSet(v)
      ),
    [vocab, category, priority, groups, skips, stats, flags]
  );
  const bestKey = `vocab:${style}:${category}:${priority}`;
  // Missed: terms whose most recent answer was wrong (in Vocab Guess, or on the Vocab deck in any game).
  // Getting one right takes it off the list.
  const missedCards = useMemo(
    () => vocab.filter((v) => stats.concepts[v.id]?.lastResult === 'wrong').sort((a, b) => stats.concepts[b.id].lastSeen - stats.concepts[a.id].lastSeen),
    [vocab, stats]
  );
  const flaggedCards = useMemo(() => vocab.filter((v) => flags[v.id]).sort((a, b) => flags[b.id].at - flags[a.id].at), [vocab, flags]);
  const toggleFlag = (c) =>
    setFlags((f) => {
      if (f[c.id]) { const { [c.id]: _, ...rest } = f; return rest; }
      return { ...f, [c.id]: { at: Date.now() } };
    });
  const newCards = useMemo(() => vocab.filter((v) => !stats.concepts[v.id] && !skips[v.id]), [vocab, skips, stats]);
  const passedCards = useMemo(
    () => vocab.filter((v) => stats.concepts[v.id]?.lastResult === 'right').sort((a, b) => stats.concepts[b.id].lastSeen - stats.concepts[a.id].lastSeen),
    [vocab, stats]
  );
  const skippedCards = useMemo(() => vocab.filter((v) => skips[v.id]).sort((a, b) => skips[b.id].at - skips[a.id].at), [vocab, skips]);

  const card = round[pos];
  const example = card ? card.example || examples[card.id] || '' : '';

  const deal = (list) => {
    setRound(list);
    setPos(0);
    setResults([]);
    setNewBest(false);
    setPhase('playing');
  };

  // Weak cards (ones you've missed) come up more often.
  const start = () => {
    const n = count === 'all' ? pool.length : Math.min(count, pool.length);
    const picked = [];
    while (picked.length < n) picked.push(weightedPick(pool, levelOf, picked.map((c) => c.id)));
    deal(picked);
  };

  // New card: reset clues and build the options.
  useEffect(() => {
    if (phase !== 'playing' || !card) return;
    setClues(0);
    setTyped('');
    setAnswer(null);
    setOptions(optionsFor(card, vocab.filter((v) => category === 'all' || v.category === category).length >= 4 ? vocab.filter((v) => category === 'all' || v.category === category) : vocab));
    if (style === 'type') setTimeout(() => inputRef.current?.focus(), 30);
  }, [phase, pos, round]);

  const submit = (pickedTerm) => {
    if (answer || !card) return;
    const ok = style === 'type' ? typedMatches(pickedTerm, card.term) : pickedTerm === card.term;
    const points = ok ? POINTS[clues] : 0;
    setAnswer({ ok, picked: pickedTerm, points });
    setResults((r) => [...r, { card, ok, points, clues, picked: pickedTerm }]);
    record(card, ok ? 'right' : 'wrong');
    if (!ok) missed(card);
    // Getting a skipped term right takes it off your Skipped list.
    if (ok && skips[card.id]) setSkips((s) => { const { [card.id]: _, ...rest } = s; return rest; });
  };

  // Skip: no points, not counted right or wrong, saved to your Skipped list to come back to.
  const skip = () => {
    if (answer || !card) return;
    setSkips((s) => ({ ...s, [card.id]: { at: Date.now(), count: (s[card.id]?.count || 0) + 1 } }));
    setResults((r) => [...r, { card, ok: false, skipped: true, points: 0, clues, picked: '' }]);
    if (pos < round.length - 1) setPos(pos + 1);
    else setTimeout(finish, 0);
  };

  const next = () => {
    if (pos < round.length - 1) setPos(pos + 1);
    else finish();
  };

  const finish = () => {
    const score = results.reduce((s, r) => s + r.points, 0);
    if (score > (best[bestKey] || 0)) {
      const b = { ...best, [bestKey]: score };
      setBest(b);
      saveBest(b);
      setNewBest(true);
    }
    setPhase('done');
    window.scrollTo({ top: 0 });
  };

  const reveal = () => setClues((c) => Math.min(c + 1, example ? 2 : 1));

  // Keys: H = next clue, 1–4 = pick, Enter = submit typed answer / next card.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === 'setup' && e.key === 'Enter' && !e.target.closest('select')) return start();
      if (phase !== 'playing') return;
      const inInput = e.target.closest('input');
      if (answer && e.key === 'Enter') { e.preventDefault(); return next(); }
      if (inInput) return;
      if (!answer && (e.key === 'h' || e.key === 'H')) return reveal();
      if (!answer && (e.key === 's' || e.key === 'S')) return skip();
      if (card && (e.key === 'f' || e.key === 'F')) return toggleFlag(card);
      if (!answer && style === 'choice' && '1234'.includes(e.key) && options[+e.key - 1]) return submit(options[+e.key - 1].term);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---------- Setup ---------- */
  if (phase === 'setup') {
    const withExamples = pool.filter((v) => v.example || examples[v.id]).length;
    return (
      <div className="mode">
        <ModeHeader eyebrow={`${vocab.length} vocabulary terms · best ${best[bestKey] || 0} pts${missedCards.length ? ` · ${missedCards.length} missed` : ''}${skippedCards.length ? ` · ${skippedCards.length} skipped` : ''}${passedCards.length ? ` · ${passedCards.length} passed` : ''}${flaggedCards.length ? ` · ${flaggedCards.length} flagged` : ''}`} title="Vocab Guess" />
        <div className="results quiz-setup vocab-setup">
          <p className="lede">
            Read the definition and name the term. Stuck? Reveal the <strong>Think of…</strong> clue, then an <strong>example exam question</strong>.
            Fewer clues, more points: <strong>3</strong> with just the definition, <strong>2</strong> after the hint, <strong>1</strong> after the example.
          </p>
          <div className="quiz-options">
            <div className="field">
              <span className="field-label">How you guess</span>
              <div className="segmented" role="group" aria-label="Guess style">
                <button className={style === 'choice' ? 'is-on' : ''} onClick={() => setStyle('choice')}>Pick from 4</button>
                <button className={style === 'type' ? 'is-on' : ''} onClick={() => setStyle('type')}>Type it</button>
              </div>
              <span className="quiz-help">
                {style === 'choice' ? 'Wrong options come from the same category, so they look alike.' : 'Close spellings and abbreviations count (e.g. "AZ", "RPO", "S3 Standard IA").'}
              </span>
            </div>
            <div className="field">
              <span className="field-label">Cards</span>
              <div className="segmented" role="group" aria-label="Number of cards">
                {COUNTS.map((c) => (
                  <button key={c} className={count === c ? 'is-on' : ''} onClick={() => setCount(c)}>{c === 'all' ? 'All' : c}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">Study priority</span>
              <div className="segmented" role="group" aria-label="Study priority">
                {['all', 'High', 'Medium'].map((p) => (
                  <button key={p} className={priority === p ? 'is-on' : ''} onClick={() => setPriority(p)}>
                    {p === 'all' ? 'All' : p} <span className="count">{vocab.filter((v) => p === 'all' || v.priority === p).filter((v) => category === 'all' || v.category === category).length}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">Which terms <span className="field-note">pick one or more</span></span>
              <div className="segmented vocab-groups" role="group" aria-label="Which terms">
                <button className={!groups.length ? 'is-on' : ''} onClick={() => setGroups([])} aria-pressed={!groups.length}>
                  All <span className="count">{vocab.length}</span>
                </button>
                {[
                  ['new', 'Not tried yet', newCards.length],
                  ['skipped', 'Skipped', skippedCards.length],
                  ['missed', 'Missed', missedCards.length],
                  ['passed', 'Passed', passedCards.length],
                  ['flagged', '⚑ Flagged', flaggedCards.length],
                ].map(([key, label, n]) => (
                  <button
                    key={key}
                    className={groups.includes(key) ? 'is-on' : ''}
                    onClick={() => toggleGroup(key)}
                    aria-pressed={groups.includes(key)}
                    disabled={!n && !groups.includes(key)}
                  >
                    {groups.includes(key) && <span className="vocab-check" aria-hidden="true">✓ </span>}
                    {label} <span className="count">{n}</span>
                  </button>
                ))}
              </div>
              <span className="quiz-help">
                {groups.length
                  ? `Playing terms that are ${groups.map((g) => ({ new: 'not tried yet', skipped: 'skipped', missed: 'missed', passed: 'passed', flagged: 'flagged' })[g]).join(' or ')}${groups.length > 1 ? ' (each term counted once)' : ''}.`
                  : 'Playing from all terms. Tap groups to combine them, e.g. Skipped + Passed.'}
              </span>
            </div>
            <label className="field" htmlFor="vg-cat">
              <span className="field-label">Category</span>
              <select id="vg-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c} ({vocab.filter((v) => v.category === c).length})</option>)}
              </select>
            </label>
          </div>
          <button className="btn btn-primary btn-lg" onClick={start} disabled={pool.length < 1}>
            Start {count === 'all' ? pool.length : Math.min(count, pool.length)} cards <kbd>↵</kbd>
          </button>
          <p className="muted">{withExamples} of {pool.length} terms in this selection have an example question.</p>

          {flaggedCards.length > 0 && (
            <div className="vocab-skips vocab-flagged">
              <div className="table-head">
                <h2 className="section-title">⚑ Flagged for review <span className="count">{flaggedCards.length}</span></h2>
                <div className="quiz-actions">
                  <button className="btn btn-primary" onClick={() => deal(shuffle(flaggedCards))}>Play my flagged terms</button>
                  <button className="btn btn-link" onClick={() => setFlags({})}>Unflag all</button>
                </div>
              </div>
              <p className="muted">Terms you flagged, right or wrong. They stay here until you unflag them.</p>
              <ul>
                {flaggedCards.map((v) => {
                  const c = stats.concepts[v.id];
                  return (
                    <li key={v.id}>
                      <span className="vocab-skip-def">{v.definition}</span>
                      <span className="muted vocab-skip-meta">{v.category}{c ? ` · right ${c.right}× · missed ${c.wrong}×` : ' · not answered yet'}</span>
                      <span className="vocab-flag-actions">
                        <details className="vocab-reveal">
                          <summary>Show term</summary>
                          <strong>{v.term}</strong>
                        </details>
                        <button className="btn btn-link" aria-label={`Unflag: ${v.definition}`} onClick={() => toggleFlag(v)}>Unflag</button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {missedCards.length > 0 && (
            <div className="vocab-skips vocab-missed">
              <div className="table-head">
                <h2 className="section-title">Missed, still to get right <span className="count">{missedCards.length}</span></h2>
                <div className="quiz-actions">
                  <button className="btn btn-primary" onClick={() => deal(shuffle(missedCards))}>Play my missed terms</button>
                </div>
              </div>
              <p className="muted">Terms you got wrong the last time you saw them. Answer one correctly and it comes off this list. Full right/wrong history is on the Progress page under the Vocab deck.</p>
              <ul>
                {missedCards.map((v) => {
                  const c = stats.concepts[v.id];
                  return (
                    <li key={v.id}>
                      <span className="vocab-skip-def">{v.definition}</span>
                      <span className="muted vocab-skip-meta">{v.category} · missed {c.wrong}×{c.right ? ` · right ${c.right}×` : ''}</span>
                      <details className="vocab-reveal">
                        <summary>Show term</summary>
                        <strong>{v.term}</strong>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {passedCards.length > 0 && (
            <details className="vocab-skips vocab-passed">
              <summary className="table-head">
                <h2 className="section-title">✓ Passed <span className="count">{passedCards.length}</span></h2>
                <span className="muted vocab-passed-toggle">Show list</span>
              </summary>
              <div className="quiz-actions">
                <button className="btn btn-primary" onClick={() => deal(shuffle(passedCards))}>Replay my passed terms</button>
              </div>
              <p className="muted">Terms you got right the last time you saw them. Miss one later and it moves to Missed.</p>
              <ul>
                {passedCards.map((v) => {
                  const c = stats.concepts[v.id];
                  return (
                    <li key={v.id}>
                      <span className="vocab-skip-def">{v.definition}</span>
                      <span className="muted vocab-skip-meta">{v.category} · right {c.right}×{c.wrong ? ` · missed ${c.wrong}×` : ''}</span>
                      <details className="vocab-reveal">
                        <summary>Show term</summary>
                        <strong>{v.term}</strong>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          {skippedCards.length > 0 && (
            <div className="vocab-skips">
              <div className="table-head">
                <h2 className="section-title">Skipped to come back to <span className="count">{skippedCards.length}</span></h2>
                <div className="quiz-actions">
                  <button className="btn btn-primary" onClick={() => deal(shuffle(skippedCards))}>Play my skipped terms</button>
                  <button className="btn btn-link" onClick={() => setSkips({})}>Clear list</button>
                </div>
              </div>
              <p className="muted">Answer one correctly and it comes off this list. Your list is saved in this browser and included in Export backup.</p>
              <ul>
                {skippedCards.map((v) => (
                  <li key={v.id}>
                    <span className="vocab-skip-def">{v.definition}</span>
                    <span className="muted vocab-skip-meta">{v.category}{skips[v.id].count > 1 ? ` · skipped ${skips[v.id].count}×` : ''}</span>
                    <button className="btn btn-link" aria-label={`Remove from skipped: ${v.definition}`} onClick={() => setSkips((s) => { const { [v.id]: _, ...rest } = s; return rest; })}>Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Results ---------- */
  if (phase === 'done') {
    const score = results.reduce((s, r) => s + r.points, 0);
    const right = results.filter((r) => r.ok).length;
    const clean = results.filter((r) => r.ok && r.clues === 0).length;
    const misses = results.filter((r) => !r.ok && !r.skipped);
    const skipped = results.filter((r) => r.skipped);
    return (
      <div className="mode">
        <ModeHeader eyebrow={style === 'choice' ? 'Pick from 4' : 'Type it'} title="Vocab Guess results" />
        <div className="results">
          <p className="eyebrow">{newBest ? 'New best score' : `Best: ${best[bestKey] || 0} pts`}</p>
          <p className="big-score">{score}<small> / {results.length * 3} pts</small></p>
          <p className="lede">{right} of {results.length} right · {clean} with no clues{skipped.length ? ` · ${skipped.length} skipped` : ''}.</p>
          <div className="quiz-actions">
            {misses.length > 0 && <button className="btn btn-primary" onClick={() => deal(misses.map((m) => m.card))}>Retry the {misses.length} I missed</button>}
            {skipped.length > 0 && <button className="btn btn-primary" onClick={() => deal(skipped.map((m) => m.card))}>Try the {skipped.length} I skipped</button>}
            {flaggedCards.length > 0 && <button className="btn btn-ghost" onClick={() => deal(shuffle(flaggedCards))}>Review my {flaggedCards.length} flagged</button>}
            <button className="btn btn-ghost" onClick={start}>Play again</button>
            <button className="btn btn-ghost" onClick={() => setPhase('setup')}>Change settings</button>
          </div>
        </div>
        {results.length > 0 && (
          <div className="quiz-review">
            <h2 className="section-title">Review</h2>
            <ol className="review-list">
              {results.map((r, i) => (
                <li key={i} className={r.ok ? 'is-right' : r.skipped ? 'is-skipped' : 'is-wrong'}>
                  <p className="review-q"><FlagButton small on={!!flags[r.card.id]} onClick={() => toggleFlag(r.card)} /> {r.card.term} <span className="muted">· {r.ok ? `+${r.points}` : r.skipped ? 'skipped (saved to your Skipped list)' : `you said "${r.picked || '—'}"`}</span></p>
                  <p className="review-why">{r.card.definition}</p>
                  {r.card.think && <p className="review-concept muted">Think: {r.card.think}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Playing ---------- */
  const total = results.reduce((s, r) => s + r.points, 0);
  const canMore = !answer && clues < (example ? 2 : 1);
  return (
    <div className="mode">
      <ModeHeader eyebrow={`${card.category} · ${card.priority} priority`} title="Vocab Guess">
        <button className="btn btn-ghost" onClick={finish}>End round</button>
      </ModeHeader>
      <div className="quiz vocab">
        <div className="round-bar">
          <span>{pos + 1}/{round.length}</span>
          <span className="progress-track" aria-hidden="true"><span style={{ width: `${(results.length / round.length) * 100}%` }} /></span>
          <span className="vocab-score" aria-label="Score">{total} pts</span>
        </div>

        <div className="clue-card vocab-card">
          <div className="vocab-step">
            <span className="field-label">1 · Definition</span>
            <p className="vocab-def">{card.definition}</p>
          </div>
          {clues >= 1 && card.think && (
            <div className="vocab-step vocab-hint">
              <span className="field-label">2 · Think of…</span>
              <p>{card.think}</p>
            </div>
          )}
          {clues >= 2 && example && (
            <div className="vocab-step vocab-example">
              <span className="field-label">3 · Example exam question</span>
              <p>{redact(example, card)}</p>
            </div>
          )}
          {!answer && (
            <div className="vocab-cluebar">
              <span className="muted">Worth <strong>{POINTS[clues]}</strong> {POINTS[clues] === 1 ? 'point' : 'points'}</span>
              <span className="vocab-cluebtns">
              {canMore && (
                <button className="btn btn-ghost" onClick={reveal}>
                  {clues === 0 ? 'Show hint' : 'Show example question'} (−1) <kbd>H</kbd>
                </button>
              )}
              <button className="btn btn-ghost vocab-skip" onClick={skip} title="Skip for now and save it to your Skipped list">Skip <kbd>S</kbd></button>
              <FlagButton on={!!flags[card.id]} onClick={() => toggleFlag(card)} />
              </span>
            </div>
          )}
        </div>

        {style === 'choice' ? (
          <div className="quiz-choices" role="radiogroup" aria-label="Which term is it?">
            {options.map((o, k) => {
              let state = '';
              if (answer) state = o.term === card.term ? 'right' : o.term === answer.picked ? 'wrong' : 'dim';
              return (
                <button key={o.id} className={`choice quiz-choice ${state ? `is-${state}` : ''}`} onClick={() => submit(o.term)} disabled={!!answer} role="radio" aria-checked={answer?.picked === o.term}>
                  <kbd className="choice-key">{k + 1}</kbd>
                  <span className="choice-body"><span className="choice-label">{o.term}</span></span>
                </button>
              );
            })}
          </div>
        ) : (
          <form className="vocab-type" onSubmit={(e) => { e.preventDefault(); if (!answer && typed.trim()) submit(typed); }}>
            <label className="sr-only" htmlFor="vg-input">Your answer</label>
            <input id="vg-input" ref={inputRef} type="text" autoComplete="off" spellCheck="false" placeholder="Type the term…" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!answer} />
            {!answer && <button className="btn btn-primary" type="submit" disabled={!typed.trim()}>Guess <kbd>↵</kbd></button>}
            {!answer && <button className="btn btn-ghost" type="button" onClick={() => submit('')}>I don’t know</button>}
          </form>
        )}

        {answer && (
          <div className={`quiz-why ${answer.ok ? 'is-right' : 'is-wrong'}`} aria-live="polite">
            <p className="quiz-verdict">{answer.ok ? `Correct! +${answer.points}` : 'Not quite.'} The answer is <span className="vocab-answer">{card.term}</span>.</p>
            {!answer.ok && (() => {
              const other = vocab.find((v) => v.term === answer.picked);
              return other ? <p className="muted"><span className="field-label">You picked</span> <strong>{other.term}</strong>: {other.definition}</p> : null;
            })()}
            {card.think && clues < 1 && <p><span className="field-label">Think of</span> {card.think}</p>}
            {example && clues < 2 && <p className="muted"><span className="field-label">Example question</span> {example}</p>}
            <div className="quiz-nav">
              <FlagButton on={!!flags[card.id]} onClick={() => toggleFlag(card)} />
              <button className="btn btn-primary" onClick={next}>{pos < round.length - 1 ? 'Next card' : 'See results'} <kbd>↵</kbd></button>
            </div>
          </div>
        )}
        <p className="muted quiz-keys">Keys: H for the next clue · S to skip · F to flag{style === 'type' ? ' (when not typing)' : ''} · {style === 'choice' ? '1–4 to pick' : 'type and press Enter'} · Enter to continue</p>
      </div>
    </div>
  );
}
