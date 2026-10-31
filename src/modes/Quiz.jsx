import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRound, isCorrect, prepare, fmtClock } from '../lib/quiz.js';
import { DomainChip, ModeHeader } from './ui.jsx';

const COUNTS = [10, 20, 65, 'all'];
const EXAM_MINUTES_PER_Q = 90 / 65; // the real exam: 65 questions in 90 minutes
const PASS = 0.7; // roughly the 700 / 1000 passing line
const DISPLAY = 'ABCDEFGH';

/** One question as it appears in a round: answer order (maybe shuffled) plus the picks. */
function Question({ q, n, total, picked, onPick, revealed, flagged }) {
  const multi = q.correct.length > 1;
  return (
    <div className="clue-card quiz-card">
      <div className="quiz-card-top">
        <span className="category">Question {n} of {total}{q.topic && q.topic !== 'General' ? ` · ${q.topic}` : ''}</span>
        {flagged && <span className="pill pill-yellow">Flagged</span>}
      </div>
      <p className="quiz-q">{q.text}</p>
      {multi && <p className="quiz-multi">Choose {q.correct.length}.</p>}
      <div className="quiz-choices" role={multi ? 'group' : 'radiogroup'} aria-label="Answers">
        {q.shown.map((o, k) => {
          const on = picked.includes(o.letter);
          let state = on ? 'picked' : '';
          if (revealed) {
            if (q.correct.includes(o.letter)) state = 'right';
            else if (on) state = 'wrong';
            else state = 'dim';
          }
          return (
            <button
              key={o.letter}
              className={`choice quiz-choice ${state ? `is-${state}` : ''}`}
              onClick={() => onPick(o.letter)}
              disabled={revealed}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
            >
              <kbd className="choice-key">{DISPLAY[k]}</kbd>
              <span className="choice-body"><span className="choice-label">{o.text}</span></span>
              {revealed && q.correct.includes(o.letter) && <span className="quiz-mark" aria-label="Correct answer">✓</span>}
              {revealed && on && !q.correct.includes(o.letter) && <span className="quiz-mark" aria-label="Your answer">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Explanation({ q, link, ok }) {
  return (
    <div className={`quiz-why ${ok ? 'is-right' : 'is-wrong'}`} aria-live="polite">
      <p className="quiz-verdict">{ok ? 'Correct.' : `Not quite. The answer is ${answerText(q)}.`}</p>
      {q.why && <p>{q.why}</p>}
      {link && (
        <p className="quiz-concept">
          <span className="field-label">Study guide</span>
          <strong>{link.term}</strong>
          {link.hint && <span className="muted"> · {link.hint}</span>}
        </p>
      )}
    </div>
  );
}

const answerText = (q) => q.correct.map((l) => q.options.find((o) => o.letter === l)?.text).join(' + ');
const pickedText = (q, picked) => (picked.length ? picked.map((l) => q.options.find((o) => o.letter === l)?.text).join(' + ') : 'No answer');

export default function Quiz({ questions, links, domains, record, missed, quizHistory, onQuestion, onAttempt }) {
  const [style, setStyle] = useState('practice');
  const [count, setCount] = useState(20);
  const [domain, setDomain] = useState('all');
  const [only, setOnly] = useState('all');
  const [shuffleAnswers, setShuffleAnswers] = useState(true);

  const [phase, setPhase] = useState('setup');
  const [round, setRound] = useState([]);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState({}); // id -> letters
  const [revealed, setRevealed] = useState({}); // practice: id -> true once checked
  const [flags, setFlags] = useState({});
  const [left, setLeft] = useState(0);
  const [reviewFilter, setReviewFilter] = useState('missed');
  const deadline = useRef(0);
  const startedAt = useRef(0);
  const finished = useRef(false);

  const domainOf = (q) => links[q.id]?.domain || 'Other';
  const pool = useMemo(() => (domain === 'all' ? questions : questions.filter((q) => domainOf(q) === domain)), [questions, domain, links]);
  const available = useMemo(() => buildRound(pool, { count: 'all', history: quizHistory.questions, only }).length, [pool, only, quizHistory]);
  const seen = questions.filter((q) => quizHistory.questions[q.id]).length;

  const begin = (list) => {
    if (!list.length) return;
    setRound(list.map((q) => prepare(q, shuffleAnswers)));
    setPos(0);
    setAnswers({});
    setRevealed({});
    setFlags({});
    finished.current = false;
    startedAt.current = Date.now();
    if (style === 'exam') {
      const secs = Math.ceil(list.length * EXAM_MINUTES_PER_Q) * 60;
      deadline.current = Date.now() + secs * 1000;
      setLeft(secs);
    }
    setReviewFilter('missed');
    setPhase('playing');
    window.scrollTo({ top: 0 });
  };
  const start = () => begin(buildRound(pool, { count, history: quizHistory.questions, only }));

  // Exam clock
  useEffect(() => {
    if (phase !== 'playing' || style !== 'exam') return;
    const t = setInterval(() => {
      const r = Math.max(0, (deadline.current - Date.now()) / 1000);
      setLeft(r);
      if (r <= 0) finish();
    }, 250);
    return () => clearInterval(t);
  });

  const q = round[pos];
  const picked = (q && answers[q.id]) || [];

  const scoreOne = (question, letters) => {
    const ok = isCorrect(question, letters);
    const result = ok ? 'right' : 'wrong';
    onQuestion(question.id, result);
    const card = links[question.id]?.strong ? links[question.id].card : null;
    if (card) {
      record(card, result);
      if (!ok) missed(card);
    }
    return ok;
  };

  const pick = (letter) => {
    if (!q || revealed[q.id]) return;
    const multi = q.correct.length > 1;
    const next = multi ? (picked.includes(letter) ? picked.filter((l) => l !== letter) : [...picked, letter]) : [letter];
    setAnswers((a) => ({ ...a, [q.id]: next }));
    // Practice + single answer: check right away, like the other games.
    if (style === 'practice' && !multi) check(next);
  };

  const check = (letters = picked) => {
    if (!q || revealed[q.id] || !letters.length) return;
    scoreOne(q, letters);
    setRevealed((r) => ({ ...r, [q.id]: true }));
  };

  const go = (i) => setPos(Math.max(0, Math.min(round.length - 1, i)));

  function finish() {
    if (finished.current) return;
    finished.current = true;
    // Exam answers are scored at the end (blanks count as wrong, like the real exam).
    // Practice answers were scored as you went; ending early only counts the ones you checked.
    let list = round;
    if (style === 'exam') round.forEach((x) => scoreOne(x, answers[x.id] || []));
    else list = round.filter((x) => revealed[x.id]);
    if (!list.length) return setPhase('setup');
    const right = list.filter((x) => isCorrect(x, answers[x.id] || [])).length;
    onAttempt({
      at: Date.now(),
      style,
      domain,
      total: list.length,
      right,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
      missed: list.filter((x) => !isCorrect(x, answers[x.id] || [])).map((x) => x.id),
    });
    setRound(list);
    setPhase('done');
    window.scrollTo({ top: 0 });
  }

  // Keyboard: A–D or 1–4 to pick, Enter to check / continue, F to flag, ←/→ to move in exam mode.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === 'setup' && e.key === 'Enter') return start();
      if (phase !== 'playing' || !q) return;
      const k = e.key.toLowerCase();
      const i = k.length === 1 ? Math.max('12345678'.indexOf(k), 'abcdefgh'.indexOf(k)) : -1;
      if (i >= 0 && q.shown[i]) return pick(q.shown[i].letter);
      if (k === 'f' && style === 'exam') return setFlags((f) => ({ ...f, [q.id]: !f[q.id] }));
      if (style === 'exam' && e.key === 'ArrowRight') return go(pos + 1);
      if (style === 'exam' && e.key === 'ArrowLeft') return go(pos - 1);
      if (e.key === 'Enter') {
        if (style === 'practice') {
          if (!revealed[q.id]) check();
          else if (pos < round.length - 1) go(pos + 1);
          else finish();
        } else if (pos < round.length - 1) go(pos + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const recent = quizHistory.attempts.slice(-5).reverse();

  if (!questions.length) {
    return (
      <div className="mode">
        <ModeHeader title="Quiz" />
        <div className="empty">No practice questions yet. Use <strong>Import</strong> to add a question spreadsheet.</div>
      </div>
    );
  }

  /* ---------- Setup ---------- */
  if (phase === 'setup') {
    return (
      <div className="mode">
        <ModeHeader eyebrow={`${questions.length} practice questions · ${seen} tried`} title="Quiz" />
        <div className="results quiz-setup">
          <p className="lede">Exam-style multiple choice from your question sheets. Every answer also counts toward the concept it tests, so the Progress page and the other games know what to bring back.</p>

          <div className="quiz-options">
            <div className="field">
              <span className="field-label">Style</span>
              <div className="segmented" role="group" aria-label="Quiz style">
                <button className={style === 'practice' ? 'is-on' : ''} onClick={() => setStyle('practice')}>Practice</button>
                <button className={style === 'exam' ? 'is-on' : ''} onClick={() => setStyle('exam')}>Exam simulation</button>
              </div>
              <span className="quiz-help">
                {style === 'practice' ? 'See the answer and why after each question.' : 'Timed at the real pace (90 min per 65 questions). Flag, skip, go back. Results at the end.'}
              </span>
            </div>

            <div className="field">
              <span className="field-label">Questions</span>
              <div className="segmented" role="group" aria-label="Number of questions">
                {COUNTS.map((c) => (
                  <button key={c} className={count === c ? 'is-on' : ''} onClick={() => setCount(c)}>
                    {c === 'all' ? 'All' : c}
                    {c === 65 && <span className="count">exam</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Which ones</span>
              <div className="segmented" role="group" aria-label="Question pool">
                {[['all', 'All'], ['new', 'Not tried yet'], ['missed', 'Ones I’ve missed']].map(([k, label]) => (
                  <button key={k} className={only === k ? 'is-on' : ''} onClick={() => setOnly(k)}>{label}</button>
                ))}
              </div>
            </div>

            <label className="field" htmlFor="quiz-domain">
              <span className="field-label">Domain</span>
              <select id="quiz-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="all">All domains</option>
                {domains.map((d) => (
                  <option key={d.name} value={d.name}>{d.name} ({questions.filter((x) => domainOf(x) === d.name).length})</option>
                ))}
              </select>
            </label>

            <label className="toggle" htmlFor="quiz-shuffle">
              <input id="quiz-shuffle" type="checkbox" checked={shuffleAnswers} onChange={(e) => setShuffleAnswers(e.target.checked)} />
              <span>Shuffle answer order</span>
            </label>
          </div>

          <button className="btn btn-primary btn-lg" onClick={start} disabled={!available}>
            {available ? <>Start {count === 'all' || count > available ? available : count} questions <kbd>↵</kbd></> : 'No questions match'}
          </button>
          {available > 0 && count !== 'all' && count > available && <p className="muted">Only {available} questions match these settings, so the round uses all of them.</p>}

          {recent.length > 0 && (
            <div className="quiz-recent">
              <h2 className="section-title">Recent quizzes</h2>
              <ul>
                {recent.map((a) => {
                  const pct = a.total ? Math.round((a.right / a.total) * 100) : 0;
                  return (
                    <li key={a.at}>
                      <span className={`quiz-recent-score ${pct >= PASS * 100 ? 'is-pass' : 'is-fail'}`}>{pct}%</span>
                      <span>{a.right}/{a.total} · {a.style === 'exam' ? 'Exam' : 'Practice'}{a.domain !== 'all' ? ` · ${a.domain}` : ''}</span>
                      <span className="muted">{new Date(a.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Results ---------- */
  if (phase === 'done') {
    const rows = round.map((x) => ({ q: x, picked: answers[x.id] || [], ok: isCorrect(x, answers[x.id] || []), flagged: !!flags[x.id] }));
    const right = rows.filter((r) => r.ok).length;
    const pct = Math.round((right / rows.length) * 100);
    const byDomain = domains
      .map((d) => {
        const rs = rows.filter((r) => domainOf(r.q) === d.name);
        return { name: d.name, total: rs.length, right: rs.filter((r) => r.ok).length };
      })
      .filter((d) => d.total);
    const shown = rows.filter((r) => (reviewFilter === 'missed' ? !r.ok : reviewFilter === 'flagged' ? r.flagged : true));
    const missedQs = rows.filter((r) => !r.ok).map((r) => r.q);

    return (
      <div className="mode">
        <ModeHeader eyebrow={style === 'exam' ? 'Exam simulation' : 'Practice quiz'} title="Results" />
        <div className="results">
          <p className="eyebrow">{pct >= PASS * 100 ? 'Above the passing line' : 'Below the passing line'}</p>
          <p className={`big-score ${pct >= PASS * 100 ? 'is-pass' : 'is-fail'}`}>{pct}<small>%</small></p>
          <p className="lede">{right} of {rows.length} right. The real exam needs about 70% (700 of 1000), so use this as a rough guide; the real score is scaled.</p>

          {byDomain.length > 1 && (
            <ul className="quiz-domains">
              {byDomain.map((d) => (
                <li key={d.name}>
                  <DomainChip name={d.name} />
                  <span className="progress-track" aria-hidden="true"><span style={{ width: `${(d.right / d.total) * 100}%` }} /></span>
                  <span className="nowrap">{d.right}/{d.total}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="quiz-actions">
            {missedQs.length > 0 && <button className="btn btn-primary" onClick={() => begin(missedQs.map(({ shown, ...rest }) => rest))}>Retry the {missedQs.length} I missed</button>}
            <button className="btn btn-ghost" onClick={() => setPhase('setup')}>New quiz</button>
          </div>
        </div>

        <div className="quiz-review">
          <div className="table-head">
            <h2 className="section-title">Review</h2>
            <div className="segmented" role="group" aria-label="Show">
              <button className={reviewFilter === 'missed' ? 'is-on' : ''} onClick={() => setReviewFilter('missed')}>Missed <span className="count">{rows.length - right}</span></button>
              {style === 'exam' && <button className={reviewFilter === 'flagged' ? 'is-on' : ''} onClick={() => setReviewFilter('flagged')}>Flagged <span className="count">{rows.filter((r) => r.flagged).length}</span></button>}
              <button className={reviewFilter === 'all' ? 'is-on' : ''} onClick={() => setReviewFilter('all')}>All <span className="count">{rows.length}</span></button>
            </div>
          </div>
          {!shown.length && <div className="empty">{reviewFilter === 'missed' ? 'Nothing missed. Nice.' : 'Nothing here.'}</div>}
          <ol className="review-list">
            {shown.map((r) => (
              <li key={r.q.id} className={r.ok ? 'is-right' : 'is-wrong'}>
                <p className="review-q">{r.q.text}</p>
                <p className="review-a">
                  <span className="review-tag">{r.ok ? '✓ You' : '✗ You'}</span> {pickedText(r.q, r.picked)}
                </p>
                {!r.ok && (
                  <p className="review-a"><span className="review-tag is-answer">Answer</span> {answerText(r.q)}</p>
                )}
                {r.q.why && <p className="review-why">{r.q.why}</p>}
                {links[r.q.id]?.strong && (
                  <p className="review-concept muted">Study guide: <strong>{links[r.q.id].card.term}</strong>{links[r.q.id].card.hint ? ` · ${links[r.q.id].card.hint}` : ''}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  /* ---------- Playing ---------- */
  const done = revealed[q.id];
  const answeredCount = round.filter((x) => (answers[x.id] || []).length).length;
  const low = style === 'exam' && left < 300;

  return (
    <div className="mode">
      <ModeHeader eyebrow={style === 'exam' ? 'Exam simulation' : 'Practice quiz'} title="Quiz">
        <button className="btn btn-ghost" onClick={finish}>
          {style === 'exam' ? 'Submit exam' : 'End quiz'}
        </button>
      </ModeHeader>

      <div className="quiz">
        <div className="round-bar">
          <span>{pos + 1}/{round.length}</span>
          <span className="progress-track" aria-hidden="true">
            <span style={{ width: `${((style === 'exam' ? answeredCount : Object.keys(revealed).length) / round.length) * 100}%` }} />
          </span>
          {style === 'exam' && <span className={`timer ${low ? 'is-low' : ''}`} aria-label="Time left">{fmtClock(left)}</span>}
        </div>

        <Question q={q} n={pos + 1} total={round.length} picked={picked} onPick={pick} revealed={style === 'practice' && done} flagged={flags[q.id]} />

        {style === 'practice' && done && (
          <Explanation q={q} link={links[q.id]?.strong ? links[q.id].card : null} ok={isCorrect(q, picked)} />
        )}

        <div className="quiz-nav">
          {style === 'practice' ? (
            !done ? (
              q.correct.length > 1 && (
                <button className="btn btn-primary" onClick={() => check()} disabled={picked.length !== q.correct.length}>
                  Check answer <kbd>↵</kbd>
                </button>
              )
            ) : pos < round.length - 1 ? (
              <button className="btn btn-primary" onClick={() => go(pos + 1)}>Next question <kbd>↵</kbd></button>
            ) : (
              <button className="btn btn-primary" onClick={finish}>See results <kbd>↵</kbd></button>
            )
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => go(pos - 1)} disabled={pos === 0}>← Back</button>
              <button className={`btn btn-ghost ${flags[q.id] ? 'is-flagged' : ''}`} onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))} aria-pressed={!!flags[q.id]}>
                {flags[q.id] ? '⚑ Flagged' : '⚐ Flag for review'} <kbd>F</kbd>
              </button>
              {pos < round.length - 1 ? (
                <button className="btn btn-primary" onClick={() => go(pos + 1)}>Next →</button>
              ) : (
                <button className="btn btn-primary" onClick={finish}>
                  Submit exam{answeredCount < round.length ? ` (${round.length - answeredCount} unanswered)` : ''}
                </button>
              )}
            </>
          )}
        </div>

        {style === 'exam' && (
          <nav className="quiz-grid" aria-label="Jump to question">
            {round.map((x, i) => (
              <button
                key={x.id}
                className={`${i === pos ? 'is-here' : ''} ${(answers[x.id] || []).length ? 'is-answered' : ''} ${flags[x.id] ? 'is-flagged' : ''}`}
                onClick={() => go(i)}
                aria-label={`Question ${i + 1}${(answers[x.id] || []).length ? ', answered' : ''}${flags[x.id] ? ', flagged' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </nav>
        )}
        <p className="muted quiz-keys">Keys: A–D or 1–4 to answer · Enter to {style === 'practice' ? 'continue' : 'go to the next question'}{style === 'exam' ? ' · F to flag · ← → to move' : ''}</p>
      </div>
    </div>
  );
}
