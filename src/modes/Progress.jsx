import { useMemo, useRef, useState } from 'react';
import { accuracy, attempts, weakness, status, summary, parseBackup, deckTotals, sessionFor } from '../lib/stats.js';
import { domainTone, shortDomain } from '../lib/deck.js';
import { DomainChip, ModeHeader } from './ui.jsx';

const STATUS = {
  struggling: { label: 'Struggling', cls: 'pill-red' },
  learning: { label: 'Learning', cls: 'pill-yellow' },
  mastered: { label: 'Mastered', cls: 'pill-green' },
  new: { label: 'Not practiced', cls: 'pill-new' },
};
const FILTERS = ['all', 'struggling', 'learning', 'mastered', 'new'];

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

function ago(t) {
  if (!t) return '—';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RecentDots({ recent = [] }) {
  if (!recent.length) return <span className="muted">—</span>;
  return (
    <span className="dots" aria-label={`Last ${recent.length}: ${recent.map((r) => ({ r: 'right', w: 'wrong', k: 'kinda' })[r.o]).join(', ')}`}>
      {recent.slice(-8).map((r, i) => (
        <span key={i} className={`hdot hdot-${r.o}`} />
      ))}
    </span>
  );
}

function AccBar({ value }) {
  if (value == null) return <span className="muted">—</span>;
  const tone = value >= 0.85 ? 'green' : value >= 0.6 ? 'yellow' : 'red';
  return (
    <span className="accbar">
      <span className="accbar-track"><span className={`accbar-fill fill-${tone}`} style={{ width: `${Math.max(4, value * 100)}%` }} /></span>
      <span className="accbar-num">{pct(value)}</span>
    </span>
  );
}

export default function Progress({ deckSwitch, source = 'guide', cards, domains, stats, modes, progress, extraBackup, onRestore, onClearHistory, onError }) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('all');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'weakness', dir: -1 });
  const [confirmClear, setConfirmClear] = useState(false);
  const [allSessions, setAllSessions] = useState(false);
  const fileRef = useRef(null);

  const rows = useMemo(
    () =>
      cards.map((card) => {
        const c = stats.concepts[card.id];
        return { card, c, n: attempts(c), right: c?.right || 0, wrong: c?.wrong || 0, acc: accuracy(c), weak: weakness(c), status: status(c), last: c?.lastSeen || 0 };
      }),
    [cards, stats]
  );
  // Answer totals come from the same per-deck session numbers as the Recent sessions table, so they always match.
  const sum = useMemo(() => ({ ...deckTotals(stats, source), practiced: summary(stats, cards).practiced }), [stats, cards, source]);
  const counts = useMemo(() => {
    const o = { all: rows.length, struggling: 0, learning: 0, mastered: 0, new: 0 };
    rows.forEach((r) => o[r.status]++);
    return o;
  }, [rows]);

  const needsWork = useMemo(() => rows.filter((r) => r.n && r.status !== 'mastered').sort((a, b) => b.weak - a.weak).slice(0, 8), [rows]);

  const byDomain = useMemo(
    () =>
      domains.map((d) => {
        const list = rows.filter((r) => r.card.domain === d.name);
        let right = 0, wrong = 0, kinda = 0;
        list.forEach((r) => { if (r.c) { right += r.c.right; wrong += r.c.wrong; kinda += r.c.kinda || 0; } });
        const total = right + wrong + kinda;
        return { ...d, total: list.length, practiced: list.filter((r) => r.n).length, acc: total ? (right + 0.5 * kinda) / total : null, answers: total };
      }),
    [rows, domains]
  );

  const table = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (domain === 'all' || r.card.domain === domain) &&
        (filter === 'all' || r.status === filter) &&
        (!q || r.card.term.toLowerCase().includes(q) || r.card.category.toLowerCase().includes(q))
    );
    const val = {
      term: (r) => r.card.term.toLowerCase(),
      right: (r) => r.right,
      wrong: (r) => r.wrong,
      acc: (r) => (r.acc == null ? -1 : r.acc),
      last: (r) => r.last,
      weakness: (r) => (r.n ? r.weak : -1),
    }[sort.key];
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : a.card.term.localeCompare(b.card.term)) * sort.dir;
    });
  }, [rows, query, domain, filter, sort]);

  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'term' ? 1 : -1 }));
  const th = (key, label, cls = '') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-btn" onClick={() => sortBy(key)}>
        {label}
        <span className="sort-ind" aria-hidden="true">{sort.key === key ? (sort.dir > 0 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  const modeLabel = (id) => modes.find((m) => m.id === id)?.label || id;
  const termOf = (id) => cards.find((c) => c.id === id)?.term || stats.concepts[id]?.term || id;
  const deckSessions = useMemo(
    () => stats.sessions.map((s) => ({ s, t: sessionFor(s, source) })).filter((x) => x.t).reverse(),
    [stats, source]
  );
  const sessions = allSessions ? deckSessions : deckSessions.slice(0, 12);

  const exportBackup = () => {
    const data = { app: 'clf-study-arcade', exportedAt: new Date().toISOString(), stats, progress, ...extraBackup };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `study-arcade-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const restore = async (file) => {
    if (!file) return;
    try {
      onRestore(parseBackup(await file.text()));
    } catch (e) {
      onError(`Couldn’t restore that file. ${e.message}`);
    } finally {
      fileRef.current.value = '';
    }
  };

  return (
    <div className="mode progress-page">
      <ModeHeader eyebrow="Every answer from every game, saved in this browser" title="Progress">
        <button className="btn btn-ghost" onClick={exportBackup}>Export backup</button>
        <button className="btn btn-ghost" onClick={() => fileRef.current.click()}>Restore backup</button>
        <input ref={fileRef} id="restore-file" type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </ModeHeader>
      <div className="deck-switch-bar">{deckSwitch}</div>

      <div className="tiles">
        <div className="tile-stat">
          <span className="tile-label">Questions answered</span>
          <span className="tile-num">{sum.total}</span>
          <span className="tile-sub">{sum.right} right · {sum.wrong} wrong{sum.kinda ? ` · ${sum.kinda} kinda` : ''}</span>
        </div>
        <div className="tile-stat">
          <span className="tile-label">Accuracy</span>
          <span className="tile-num">{pct(sum.accuracy)}</span>
          <span className="tile-sub">Kinda counts as half right</span>
        </div>
        <div className="tile-stat">
          <span className="tile-label">Concepts practiced</span>
          <span className="tile-num">{sum.practiced}<small>/{cards.length}</small></span>
          <span className="tile-sub">{counts.mastered} mastered · {counts.struggling} struggling</span>
        </div>
        <div className="tile-stat">
          <span className="tile-label">Study sessions</span>
          <span className="tile-num">{sum.sessions}</span>
          <span className="tile-sub">{sum.last ? `Last: ${ago(sum.last)}` : 'None yet'}</span>
        </div>
      </div>

      {!sum.total && (
        <div className="empty">
          No answers yet. Play <a href="#flashcards">Flashcards</a>, <a href="#showdown">Don’t Confuse Me</a>, <a href="#rapid">Rapid-Fire</a> or the <a href="#board">Game Board</a>, and every right and wrong answer shows up here.
        </div>
      )}

      {sum.total > 0 && (
        <div className="two-col">
          <section className="panel">
            <h2 className="section-title">Study these next</h2>
            {needsWork.length ? (
              <ol className="needs-list">
                {needsWork.map((r) => (
                  <li key={r.card.id}>
                    <div className="needs-main">
                      <span className="needs-term">{r.card.term}</span>
                      <span className="needs-hint">{r.card.hint}</span>
                    </div>
                    <div className="needs-meta">
                      <span className="rw"><b className="ok">{r.right}✓</b> <b className="bad">{r.wrong}✗</b></span>
                      <RecentDots recent={r.c.recent} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Everything you’ve practiced is mastered. Try concepts you haven’t seen yet.</p>
            )}
            <a className="btn btn-primary" href="#flashcards">Drill them in flashcards</a>
          </section>

          <section className="panel">
            <h2 className="section-title">By exam domain</h2>
            <ul className="domain-acc">
              {byDomain.map((d) => (
                <li key={d.name}>
                  <div className="domain-bar-top">
                    <span className={`dot tone-${domainTone(d.name)}`} aria-hidden="true" />
                    <span className="domain-name">{shortDomain(d.name)}</span>
                    <span className="domain-weight">{d.weight}% of exam</span>
                  </div>
                  <AccBar value={d.acc} />
                  <div className="domain-counts">
                    <span>{d.practiced}/{d.total} practiced</span>
                    <span>{d.answers} answers</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {sessions.length > 0 && (
        <section className="panel">
          <div className="table-head">
            <h2 className="section-title">{allSessions ? 'All sessions' : 'Recent sessions'}</h2>
            {deckSessions.length > 12 && (
              <button className="btn btn-ghost" onClick={() => setAllSessions((v) => !v)}>
                {allSessions ? 'Show recent 12' : `Show all ${deckSessions.length}`}
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>Mode</th><th className="num">Right</th><th className="num">Wrong</th>{sum.kinda > 0 && <th className="num">Kinda</th>}<th>Accuracy</th><th>Missed</th></tr>
              </thead>
              <tbody>
                {sessions.map(({ s, t }) => {
                  const n = t.n;
                  const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
                  return (
                    <tr key={s.id}>
                      <td className="nowrap">
                        {new Date(s.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        <span className="muted small"> · {mins} min</span>
                      </td>
                      <td className="nowrap">{modeLabel(s.mode)}</td>
                      <td className="num ok">{t.right}</td>
                      <td className="num bad">{t.wrong}</td>
                      {sum.kinda > 0 && <td className="num kinda">{t.kinda}</td>}
                      <td><AccBar value={n ? (t.right + 0.5 * t.kinda) / n : null} /></td>
                      <td className="missed-cell">
                        {t.missed.length ? t.missed.slice(0, 3).map(termOf).join(', ') + (t.missed.length > 3 ? ` +${t.missed.length - 3} more` : '') : <span className="muted">None</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {(allSessions || deckSessions.length <= 12) && deckSessions.length > 1 && (
                <tfoot>
                  <tr>
                    <td>Total · {deckSessions.length} sessions</td>
                    <td />
                    <td className="num ok">{sum.right}</td>
                    <td className="num bad">{sum.wrong}</td>
                    {sum.kinda > 0 && <td className="num kinda">{sum.kinda}</td>}
                    <td><AccBar value={sum.accuracy} /></td>
                    <td className="muted">Matches “Questions answered” above</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="table-head">
          <h2 className="section-title">All concepts</h2>
          <div className="table-tools">
            <label className="sr-only" htmlFor="pg-search">Search concepts</label>
            <input id="pg-search" type="search" placeholder="Search concepts…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label className="sr-only" htmlFor="pg-domain">Domain</label>
            <select id="pg-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="all">All domains</option>
              {domains.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="segmented status-filter" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : STATUS[f].label}
              <span className="count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table concepts-table">
            <thead>
              <tr>
                {th('term', 'Concept')}
                <th>Domain</th>
                <th>Status</th>
                {th('right', 'Right', 'num')}
                {th('wrong', 'Wrong', 'num')}
                {th('acc', 'Accuracy')}
                <th>Last answers</th>
                {th('last', 'Last seen')}
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.card.id}>
                  <td>
                    <span className="cell-term">{r.card.term}</span>
                    <span className="cell-cat">{r.card.category}</span>
                  </td>
                  <td><DomainChip name={r.card.domain} /></td>
                  <td><span className={`pill ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                  <td className="num ok">{r.right || <span className="muted">0</span>}</td>
                  <td className="num bad">{r.wrong || <span className="muted">0</span>}</td>
                  <td><AccBar value={r.acc} /></td>
                  <td><RecentDots recent={r.c?.recent} /></td>
                  <td className="nowrap muted">{ago(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!table.length && <p className="muted center">No concepts match.</p>}
        </div>
        <p className="muted small">
          Mastered = 3+ answers, 85%+ accuracy and the last two right. Struggling = under 60% or missed last time. Memory Match isn’t counted, since it doesn’t ask questions.
        </p>
      </section>

      <section className="danger-zone">
        <p className="muted small">
          History lives in this browser only. Export a backup now and then, especially before clearing site data or switching devices; Restore loads it anywhere.
        </p>
        {confirmClear ? (
          <div className="confirm">
            <span>Delete all answer history for both decks ({stats.sessions.length} sessions)?</span>
            <button className="btn btn-danger" onClick={() => { onClearHistory(); setConfirmClear(false); }}>Delete history</button>
            <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-link" onClick={() => setConfirmClear(true)}>Clear answer history</button>
        )}
      </section>
    </div>
  );
}
