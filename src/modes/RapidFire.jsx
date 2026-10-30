import { useCallback, useEffect, useRef, useState } from 'react';
import { weightedPick, distractors, redact, shuffle, lookup } from '../lib/deck.js';
import { Choice, DomainFilter, ModeHeader, Triggers } from './ui.jsx';
import { loadBest, saveBest } from '../lib/storage.js';

const DURATION = 60;
const PENALTY = 3;

function makeQuestion(pool, all, index, cheats, lastId) {
  const card = weightedPick(pool, (c) => c.level, lastId ? [lastId] : []);
  const cheat = shuffle(cheats).find((ch) => lookup(ch.answer, index)?.id === card.id);
  const kinds = ['definition'];
  if (card.triggers.length) kinds.push('triggers', 'triggers');
  if (cheat) kinds.push('cheat', 'cheat');
  if (card.eli12) kinds.push('eli12');
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const options = shuffle([card, ...distractors(card, all, index, 3)]);
  let prompt;
  if (kind === 'triggers') prompt = { label: 'Exam keywords', triggers: card.triggers };
  else if (kind === 'cheat') prompt = { label: 'If the question says…', text: cheat.prompt };
  else if (kind === 'eli12') prompt = { label: 'Explain like I’m 12', text: redact(card.eli12, card) };
  else prompt = { label: 'Exam definition', text: redact(card.definition, card) };
  return { card, options, prompt };
}

export default function RapidFire({ cards, index, domains, deck, missed }) {
  const [domain, setDomain] = useState('all');
  const [phase, setPhase] = useState('ready');
  const [q, setQ] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState([]);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState(null);
  const [best, setBest] = useState(() => loadBest());
  const deadline = useRef(0);
  const [newBest, setNewBest] = useState(false);
  const [last, setLast] = useState(null);

  const pool = domain === 'all' ? cards : cards.filter((c) => c.domain === domain);
  const bestKey = `rapid:${domain}`;

  const next = useCallback((lastId) => setQ(makeQuestion(pool, cards, index, deck.cheats || [], lastId)), [pool, cards, index, deck]);

  const start = () => {
    setScore(0);
    setStreak(0);
    setCorrect(0);
    setMisses([]);
    setNewBest(false);
    setLast(null);
    deadline.current = Date.now() + DURATION * 1000;
    setLeft(DURATION);
    setPhase('playing');
    next();
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      const remaining = Math.max(0, (deadline.current - Date.now()) / 1000);
      setLeft(remaining);
      if (remaining <= 0) setPhase('done');
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'done') return;
    if (score > (best[bestKey] || 0)) {
      const b = { ...best, [bestKey]: score };
      setBest(b);
      saveBest(b);
      setNewBest(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const answer = (opt) => {
    if (phase !== 'playing' || !q) return;
    if (opt.id === q.card.id) {
      const mult = 1 + Math.floor(streak / 3);
      setScore((s) => s + 10 * mult);
      setStreak((s) => s + 1);
      setCorrect((n) => n + 1);
      setFlash('right');
      setLast({ ok: true, card: q.card });
    } else {
      setStreak(0);
      deadline.current -= PENALTY * 1000;
      setMisses((m) => [...m, { card: q.card, picked: opt, prompt: q.prompt }]);
      missed(q.card);
      setFlash('wrong');
      setLast({ ok: false, card: q.card });
    }
    setTimeout(() => setFlash(null), 250);
    next(q.card.id);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select')) return;
      if (phase === 'playing' && q && ['1', '2', '3', '4'].includes(e.key)) answer(q.options[Number(e.key) - 1]);
      else if (phase !== 'playing' && e.key === 'Enter') start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mult = 1 + Math.floor(streak / 3);

  return (
    <div className="mode">
      <ModeHeader eyebrow={`Best score: ${best[bestKey] || 0}`} title="Rapid-Fire">
        {phase !== 'playing' && <DomainFilter domains={domains} value={domain} onChange={setDomain} id="rf-domain" />}
      </ModeHeader>

      {phase === 'ready' && (
        <div className="results">
          <p className="lede">An exam clue appears. Pick the service from four options. Wrong answers come from the same category, so you can’t guess by elimination.</p>
          <ul className="rules">
            <li><strong>60 seconds</strong> on the clock</li>
            <li><strong>+10</strong> per right answer, multiplied by every 3 in a row</li>
            <li><strong>−3 seconds</strong> for a miss</li>
          </ul>
          <button className="btn btn-primary btn-lg" onClick={start}>Start round <kbd>↵</kbd></button>
        </div>
      )}

      {phase === 'playing' && q && (
        <div className={`rapid ${flash ? `flash-${flash}` : ''}`}>
          <div className="round-bar">
            <span className="timer" aria-live="off">{Math.ceil(left)}s</span>
            <span className="progress-track timer-track" aria-hidden="true"><span style={{ width: `${(left / DURATION) * 100}%` }} /></span>
            <span>
              {score} pts{mult > 1 && <span className="streak"> · ×{mult}</span>}
            </span>
          </div>
          <div className="clue-card">
            <span className="category">{q.prompt.label}</span>
            {q.prompt.triggers ? <Triggers items={q.prompt.triggers} /> : <p className="clue-text">{q.prompt.text}</p>}
          </div>
          <div className="choices">
            {q.options.map((o, k) => (
              <Choice key={o.id} index={k} label={o.term} onClick={() => answer(o)} />
            ))}
          </div>
          <p className={`last-answer ${last ? (last.ok ? 'is-right' : 'is-wrong') : ''}`} aria-live="polite">
            {last ? (last.ok ? `✓ ${last.card.term}` : `✗ That was ${last.card.term} · ${last.card.hint}`) : 'Press 1–4 or tap an answer.'}
          </p>
        </div>
      )}

      {phase === 'done' && (
        <div className="results">
          <p className="eyebrow">{newBest ? 'New best score' : 'Time’s up'}</p>
          <p className="big-score">{score}<small> pts</small></p>
          <p className="lede">{correct} right, {misses.length} missed.</p>
          {misses.length > 0 && (
            <>
              <h2 className="section-title">What got you</h2>
              <ul className="miss-list">
                {misses.map((m, k) => (
                  <li key={k}>
                    <span className="muted">{m.prompt.text || m.prompt.triggers.join('; ')}</span>
                    <br />
                    <strong>{m.card.term}</strong> <span className="muted">(you picked {m.picked.term})</span> · {m.card.hint}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="btn btn-primary btn-lg" onClick={start}>Play again <kbd>↵</kbd></button>
        </div>
      )}
    </div>
  );
}
