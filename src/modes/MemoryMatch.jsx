import { useEffect, useState } from 'react';
import { weightedPick, shuffle } from '../lib/deck.js';
import { DomainFilter, ModeHeader } from './ui.jsx';
import { loadBest, saveBest } from '../lib/storage.js';

const SIZES = { 6: '6 pairs', 8: '8 pairs', 10: '10 pairs' };
const PAIR_WITH = { hint: 'Memory hint', eli12: 'Like I’m 12' };

function deal(pool, pairs, pairWith) {
  const chosen = [];
  const usable = pool.filter((c) => c[pairWith]);
  while (chosen.length < Math.min(pairs, usable.length)) {
    const c = weightedPick(usable, (x) => x.level, chosen.map((x) => x.id));
    if (!chosen.some((x) => x.id === c.id)) chosen.push(c);
  }
  return shuffle(
    chosen.flatMap((c) => [
      { key: `${c.id}-t`, cardId: c.id, kind: 'term', text: c.term },
      { key: `${c.id}-h`, cardId: c.id, kind: 'clue', text: c[pairWith] },
    ])
  );
}

export default function MemoryMatch({ cards, domains }) {
  const [domain, setDomain] = useState('all');
  const [pairs, setPairs] = useState(6);
  const [pairWith, setPairWith] = useState('hint');
  const pool = domain === 'all' ? cards : cards.filter((c) => c.domain === domain);
  const [tiles, setTiles] = useState(() => deal(pool, pairs, pairWith));
  const [up, setUp] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState(() => loadBest());
  const bestKey = `match:${pairs}:${pairWith}`;
  const done = tiles.length > 0 && matched.length === tiles.length / 2;

  const reset = (opts = {}) => {
    const p = opts.pairs ?? pairs;
    const w = opts.pairWith ?? pairWith;
    const d = opts.domain ?? domain;
    setTiles(deal(d === 'all' ? cards : cards.filter((c) => c.domain === d), p, w));
    setUp([]);
    setMatched([]);
    setMoves(0);
    setStartedAt(null);
    setElapsed(0);
  };

  useEffect(() => {
    if (!startedAt || done) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [startedAt, done]);

  useEffect(() => {
    if (!done) return;
    if (!best[bestKey] || moves < best[bestKey]) {
      const b = { ...best, [bestKey]: moves };
      setBest(b);
      saveBest(b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const flip = (tile) => {
    if (up.length === 2 || up.includes(tile.key) || matched.includes(tile.cardId)) return;
    if (!startedAt) setStartedAt(Date.now());
    const nextUp = [...up, tile.key];
    setUp(nextUp);
    if (nextUp.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextUp.map((k) => tiles.find((t) => t.key === k));
      if (a.cardId === b.cardId) {
        setMatched((m) => [...m, a.cardId]);
        setUp([]);
      } else {
        setTimeout(() => setUp([]), 1100);
      }
    }
  };

  return (
    <div className="mode">
      <ModeHeader eyebrow={best[bestKey] ? `Best: ${best[bestKey]} moves` : 'Match each service to its clue'} title="Memory Match">
        <DomainFilter domains={domains} value={domain} onChange={(v) => { setDomain(v); reset({ domain: v }); }} id="mm-domain" />
        <label className="field" htmlFor="mm-size">
          <span className="field-label">Size</span>
          <select id="mm-size" value={pairs} onChange={(e) => { const p = Number(e.target.value); setPairs(p); reset({ pairs: p }); }}>
            {Object.entries(SIZES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="mm-with">
          <span className="field-label">Pair with</span>
          <select id="mm-with" value={pairWith} onChange={(e) => { setPairWith(e.target.value); reset({ pairWith: e.target.value }); }}>
            {Object.entries(PAIR_WITH).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </ModeHeader>

      <div className="round-bar">
        <span>{matched.length} of {tiles.length / 2} matched</span>
        <span className="progress-track" aria-hidden="true"><span style={{ width: `${(matched.length / (tiles.length / 2 || 1)) * 100}%` }} /></span>
        <span>{moves} moves · {elapsed}s</span>
      </div>

      {done && (
        <div className="reveal center">
          <p className="verdict verdict-right">All matched in {moves} moves and {elapsed}s.</p>
          <button className="btn btn-primary" onClick={() => reset()}>Deal again</button>
        </div>
      )}

      <div className={`match-grid pairs-${pairs}`}>
        {tiles.map((t) => {
          const isMatched = matched.includes(t.cardId);
          const isUp = up.includes(t.key) || isMatched;
          const mismatch = up.length === 2 && up.includes(t.key) && !isMatched;
          return (
            <button
              key={t.key}
              className={`match-tile ${isUp ? 'is-up' : ''} ${isMatched ? 'is-matched' : ''} ${mismatch ? 'is-miss' : ''} kind-${t.kind}`}
              onClick={() => flip(t)}
              aria-label={isUp ? t.text : 'Hidden tile'}
            >
              <span className="match-face match-back" aria-hidden="true" />
              <span className="match-face match-front">{t.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
