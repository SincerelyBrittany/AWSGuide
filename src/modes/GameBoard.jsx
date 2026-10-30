import { useEffect, useState } from 'react';
import { distractors, redact, shuffle, LEVELS, domainTone, shortDomain } from '../lib/deck.js';
import { Choice, ModeHeader, Triggers } from './ui.jsx';

// Each row asks a different (harder) kind of question.
const ROWS = [
  { level: 1, name: 'Name → definition', ask: (c) => ({ label: 'What does this do?', text: c.term, answerBy: 'definition' }) },
  { level: 2, name: 'Plain English', ask: (c) => ({ label: 'Explain like I’m 12. Which service?', text: redact(c.eli12 || c.definition, c) }) },
  { level: 3, name: 'Exam keywords', ask: (c) => (c.triggers.length ? { label: 'The question mentions…', triggers: c.triggers } : { label: 'Which service?', text: redact(c.definition, c) }) },
  { level: 4, name: 'Exam definition', ask: (c) => ({ label: 'Which service matches this definition?', text: redact(c.definition, c) }) },
  { level: 5, name: 'Look-alikes', ask: (c) => ({ label: 'Careful, look-alikes ahead. Which service?', text: redact(c.definition, c), hard: true }) },
];

const PLAYER_COLORS = ['p1', 'p2', 'p3', 'p4'];

function dealBoard(cards, domains) {
  const board = {};
  for (const d of domains) {
    // Harder rows get the cards you're weaker on.
    const list = shuffle(cards.filter((c) => c.domain === d.name)).sort((a, b) => LEVELS[a.level].weight - LEVELS[b.level].weight);
    board[d.name] = ROWS.map((_, r) => list[r % list.length]?.id);
  }
  return board;
}

export default function GameBoard({ cards, index, domains, missed }) {
  const [names, setNames] = useState(['Player 1']);
  const [phase, setPhase] = useState('setup');
  const [scores, setScores] = useState([]);
  const [turn, setTurn] = useState(0);
  const [board, setBoard] = useState({});
  const [used, setUsed] = useState({});
  const [open, setOpen] = useState(null); // { domain, row, card, question, options, value }
  const [picked, setPicked] = useState(null);

  const columns = domains.slice(0, 6);
  const value = (d, r) => (r + 1) * d.weight * 10;

  const start = () => {
    const clean = names.map((n, i) => n.trim() || `Player ${i + 1}`);
    setNames(clean);
    setScores(clean.map(() => 0));
    setTurn(0);
    setBoard(dealBoard(cards, columns));
    setUsed({});
    setOpen(null);
    setPhase('play');
  };

  const openTile = (d, r) => {
    const card = cards.find((c) => c.id === board[d.name][r]);
    if (!card) return;
    const row = ROWS[r];
    const question = row.ask(card);
    const others = distractors(card, cards, index, 3);
    setOpen({ domain: d.name, row: r, card, question, options: shuffle([card, ...others]), value: value(d, r) });
    setPicked(null);
  };

  const choose = (opt) => {
    if (picked || !open) return;
    setPicked(opt.id);
    const right = opt.id === open.card.id;
    setScores((s) => s.map((v, i) => (i === turn ? v + (right ? open.value : -Math.round(open.value / 2)) : v)));
    if (!right) missed(open.card);
  };

  const close = () => {
    const key = `${open.domain}|${open.row}`;
    const nextUsed = { ...used, [key]: true };
    setUsed(nextUsed);
    setOpen(null);
    setTurn((t) => (t + 1) % names.length);
    if (Object.keys(nextUsed).length >= columns.length * ROWS.length) setPhase('done');
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!open || e.target.closest('input')) return;
      if (!picked && ['1', '2', '3', '4'].includes(e.key)) choose(open.options[Number(e.key) - 1]);
      else if (picked && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (phase === 'setup') {
    return (
      <div className="mode">
        <ModeHeader eyebrow="Solo or pass-and-play" title="Game Board" />
        <div className="results setup">
          <p className="lede">
            One column per exam domain. Tiles are worth more in the domains that carry more of the exam, and lower rows ask harder questions. A miss costs half the tile.
          </p>
          <div className="players">
            {names.map((n, i) => (
              <div className="player-row" key={i}>
                <span className={`player-dot ${PLAYER_COLORS[i]}`} aria-hidden="true" />
                <label className="sr-only" htmlFor={`player-${i}`}>Player {i + 1} name</label>
                <input id={`player-${i}`} value={n} maxLength={20} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                {names.length > 1 && (
                  <button className="btn btn-link" onClick={() => setNames(names.filter((_, j) => j !== i))}>Remove</button>
                )}
              </div>
            ))}
            {names.length < 4 && (
              <button className="btn btn-ghost" onClick={() => setNames([...names, `Player ${names.length + 1}`])}>Add a player</button>
            )}
          </div>
          <button className="btn btn-primary btn-lg" onClick={start}>Deal the board</button>
        </div>
      </div>
    );
  }

  const leader = Math.max(...scores);

  return (
    <div className="mode">
      <ModeHeader eyebrow={phase === 'done' ? 'Final scores' : `${names[turn]}’s turn`} title="Game Board">
        <button className="btn btn-ghost" onClick={() => setPhase('setup')}>New game</button>
      </ModeHeader>

      <div className="scoreboard">
        {names.map((n, i) => (
          <div key={i} className={`score-chip ${PLAYER_COLORS[i]} ${phase === 'play' && i === turn ? 'is-turn' : ''} ${phase === 'done' && scores[i] === leader ? 'is-winner' : ''}`}>
            <span className="score-name">{n}</span>
            <span className="score-val">{scores[i]}</span>
          </div>
        ))}
      </div>

      {phase === 'done' && (
        <p className="lede center">
          {names.length > 1 ? `${names.filter((_, i) => scores[i] === leader).join(' & ')} wins.` : `Final score: ${scores[0]}.`} Missed cards were moved down a level so they show up more in flashcards.
        </p>
      )}

      <div className="board-wrap">
        <div className="board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(96px, 1fr))` }}>
          {columns.map((d) => (
            <div key={d.name} className={`board-head tone-${domainTone(d.name)}`}>
              <span>{shortDomain(d.name)}</span>
              <small>{d.weight}% of exam</small>
            </div>
          ))}
          {ROWS.map((row, r) =>
            columns.map((d) => {
              const isUsed = used[`${d.name}|${r}`];
              return (
                <button key={`${d.name}${r}`} className={`tile tone-${domainTone(d.name)} ${isUsed ? 'is-used' : ''}`} disabled={isUsed || phase === 'done'} onClick={() => openTile(d, r)} title={row.name}>
                  {isUsed ? '' : value(d, r)}
                </button>
              );
            })
          )}
        </div>
      </div>
      <p className="muted center small">Rows: {ROWS.map((r) => r.name).join(' · ')}</p>

      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Question">
          <div className="modal">
            <div className="face-top">
              <span className={`chip tone-${domainTone(open.domain)}`}>{shortDomain(open.domain)}</span>
              <span className="category">{ROWS[open.row].name} · {open.value} pts · {names[turn]}</span>
            </div>
            <p className="category">{open.question.label}</p>
            {open.question.triggers ? (
              <Triggers items={open.question.triggers} />
            ) : (
              <p className={open.question.answerBy ? 'card-term' : 'clue-text'}>{open.question.text}</p>
            )}
            <div className="choices">
              {open.options.map((o, k) => {
                const state = picked ? (o.id === open.card.id ? 'right' : o.id === picked ? 'wrong' : 'dim') : null;
                return (
                  <Choice
                    key={o.id}
                    index={k}
                    label={open.question.answerBy ? o.definition : o.term}
                    sub={picked && !open.question.answerBy ? o.hint : null}
                    state={state}
                    disabled={!!picked}
                    onClick={() => choose(o)}
                  />
                );
              })}
            </div>
            {picked && (
              <div className="reveal">
                <p className={picked === open.card.id ? 'verdict verdict-right' : 'verdict verdict-wrong'}>
                  {picked === open.card.id ? `+${open.value} for ${names[turn]}` : `−${Math.round(open.value / 2)}. It was ${open.card.term}.`}
                </p>
                <p className="note">{open.card.term}: {open.card.hint}</p>
                <button className="btn btn-primary" onClick={close}>Back to the board <kbd>↵</kbd></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
