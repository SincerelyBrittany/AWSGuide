import { useEffect, useMemo, useState } from 'react';
import { confusedWith, redact, shuffle, LEVELS } from '../lib/deck.js';
import { DomainChip, DomainFilter, ModeHeader, Triggers, Empty } from './ui.jsx';

const ROUND = 10;

function buildRound(cards, index, domain) {
  const pairs = [];
  for (const c of cards) {
    if (domain !== 'all' && c.domain !== domain) continue;
    for (const other of confusedWith(c, index)) pairs.push({ answer: c, decoy: other });
  }
  // Favor cards you're weaker on, then shuffle and keep one question per answer card.
  const weighted = shuffle(pairs).sort((a, b) => LEVELS[b.answer.level].weight - LEVELS[a.answer.level].weight + (Math.random() - 0.5) * 3);
  const seen = new Set();
  const round = [];
  for (const p of weighted) {
    if (seen.has(p.answer.id)) continue;
    seen.add(p.answer.id);
    round.push({ ...p, options: shuffle([p.answer, p.decoy]), clue: Math.random() < 0.5 && p.answer.triggers.length ? 'triggers' : 'definition' });
    if (round.length === ROUND) break;
  }
  return round;
}

export default function Showdown({ cards, index, domains, missed, record }) {
  const [domain, setDomain] = useState('all');
  const [round, setRound] = useState(() => buildRound(cards, index, 'all'));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState([]);

  const restart = (d = domain) => {
    setRound(buildRound(cards, index, d));
    setI(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setMisses([]);
  };

  const q = round[i];
  const done = i >= round.length;

  const choose = (card) => {
    if (picked || !q) return;
    setPicked(card.id);
    record(q.answer, card.id === q.answer.id ? 'right' : 'wrong');
    if (card.id === q.answer.id) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      setMisses((m) => [...m, q]);
      missed(q.answer);
    }
  };

  const nextQ = () => {
    setPicked(null);
    setI((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select')) return;
      if (!q) return;
      if (!picked && (e.key === '1' || e.key === '2')) choose(q.options[Number(e.key) - 1]);
      else if (picked && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        nextQ();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const total = useMemo(() => cards.filter((c) => confusedWith(c, index).length).length, [cards, index]);

  return (
    <div className="mode">
      <ModeHeader eyebrow={`${total} services have a look-alike in your sheet`} title="Don’t Confuse Me">
        <DomainFilter domains={domains} value={domain} onChange={(v) => { setDomain(v); restart(v); }} id="sd-domain" />
      </ModeHeader>

      {!round.length ? (
        <Empty>No look-alike pairs in this domain yet. Fill in the “Don’t Confuse With” column to add some.</Empty>
      ) : done ? (
        <div className="results">
          <p className="eyebrow">Round complete</p>
          <p className="big-score">
            {score}<small>/{round.length}</small>
          </p>
          {misses.length ? (
            <>
              <h2 className="section-title">Pairs to review</h2>
              <ul className="miss-list">
                {misses.map((m) => (
                  <li key={m.answer.id}>
                    <strong>{m.answer.term}</strong> <span className="muted">vs</span> {m.decoy.term}
                    <span className="muted"> · {m.answer.hint}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">Missed cards moved down one confidence level, so they’ll come up more.</p>
            </>
          ) : (
            <p className="lede">Clean sweep. None of the look-alikes got you.</p>
          )}
          <button className="btn btn-primary" onClick={() => restart()}>Play another round</button>
        </div>
      ) : (
        <>
          <div className="round-bar">
            <span>Question {i + 1} of {round.length}</span>
            <span className="progress-track" aria-hidden="true"><span style={{ width: `${(i / round.length) * 100}%` }} /></span>
            <span>Score {score}{streak > 1 && <span className="streak"> · {streak} in a row</span>}</span>
          </div>

          <div className="clue-card">
            <div className="face-top">
              <DomainChip name={q.answer.domain} />
              <span className="category">{q.clue === 'triggers' ? 'The question mentions…' : 'Which service is this?'}</span>
            </div>
            {q.clue === 'triggers' ? (
              <div className="clue-triggers">
                <Triggers items={q.answer.triggers} />
                <p className="muted">{redact(q.answer.eli12 || q.answer.definition, q.answer)}</p>
              </div>
            ) : (
              <p className="clue-text">{redact(q.answer.definition, q.answer)}</p>
            )}
          </div>

          <div className="versus">
            {q.options.map((opt, k) => {
              const state = picked ? (opt.id === q.answer.id ? 'right' : opt.id === picked ? 'wrong' : 'dim') : null;
              return (
                <button key={opt.id} className={`versus-card ${state ? `is-${state}` : ''}`} onClick={() => choose(opt)} disabled={!!picked}>
                  <kbd className="choice-key">{k + 1}</kbd>
                  <span className="versus-term">{opt.term}</span>
                  {picked && <span className="versus-hint">{opt.hint}</span>}
                  {picked && <span className="versus-def">{opt.definition}</span>}
                </button>
              );
            })}
            <span className="vs-badge" aria-hidden="true">vs</span>
          </div>

          {picked && (
            <div className="reveal" aria-live="polite">
              <p className={picked === q.answer.id ? 'verdict verdict-right' : 'verdict verdict-wrong'}>
                {picked === q.answer.id ? 'Right.' : `It was ${q.answer.term}.`}
              </p>
              {q.answer.notes && <p className="note">Your note: {q.answer.notes}</p>}
              <button className="btn btn-primary" onClick={nextQ}>
                {i + 1 === round.length ? 'See results' : 'Next pair'} <kbd>↵</kbd>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
