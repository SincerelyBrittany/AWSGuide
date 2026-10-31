import { useMemo, useState } from 'react';
import { LEVELS, domainTone, shortDomain } from '../lib/deck.js';
import { DomainChip, JumpMenu, ModeHeader, scrollToSection } from './ui.jsx';

const GROUPS = { topic: 'Concept covered', domain: 'Domain', az: 'A–Z' };
const LEVEL_ORDER = ['red', 'yellow', 'green'];

function Highlight({ text, q }) {
  if (!q || !text) return text || null;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** Right/wrong totals across every quiz question behind this entry. */
function quizRecord(card, quizHistory) {
  let right = 0, wrong = 0, last = null;
  for (const q of card.questions) {
    const h = quizHistory.questions[q.id];
    if (!h) continue;
    right += h.right;
    wrong += h.wrong;
    if (!last || h.lastSeen > last.lastSeen) last = h;
  }
  return { right, wrong, tried: right + wrong > 0, lastWrong: last?.lastResult === 'wrong' };
}

export default function QuestionsGuide({ qCards, domains, quizHistory, setLevel, lowCount = 0, settings, setSettings }) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('all');
  const [level, setLevelFilter] = useState('all');
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [group, setGroup] = useState('topic');

  const q = query.trim().toLowerCase();
  const records = useMemo(() => Object.fromEntries(qCards.map((c) => [c.id, quizRecord(c, quizHistory)])), [qCards, quizHistory]);
  const missedCount = qCards.filter((c) => records[c.id].wrong > 0).length;
  const questionCount = qCards.reduce((n, c) => n + c.questions.length, 0);

  const list = useMemo(() => {
    const match = (c) =>
      !q ||
      [c.term, ...c.topics, ...c.whys, c.related?.term, ...c.questions.flatMap((x) => [x.text, ...x.options.map((o) => o.text)])]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q));
    return qCards
      .filter((c) => (domain === 'all' || c.domain === domain) && (level === 'all' || c.level === level) && (!onlyMissed || records[c.id].wrong > 0) && match(c))
      .sort((a, b) => a.term.replace(/^(AWS|Amazon)\s+/, '').localeCompare(b.term.replace(/^(AWS|Amazon)\s+/, '')));
  }, [qCards, q, domain, level, onlyMissed, records]);

  const sections = useMemo(() => {
    const bucket = (keyOf) => {
      const m = new Map();
      list.forEach((c) => {
        const k = keyOf(c);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(c);
      });
      return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => ({ key: k, title: k, items }));
    };
    if (group === 'az') return bucket((c) => (c.term.replace(/^(AWS|Amazon)\s+/, '')[0] || '#').toUpperCase());
    if (group === 'topic') return bucket((c) => c.category);
    return domains
      .map((d) => ({ key: d.name, title: d.name, sub: `${d.weight}% of exam`, tone: domainTone(d.name), items: list.filter((c) => c.domain === d.name) }))
      .filter((s) => s.items.length);
  }, [list, group, domains]);

  return (
    <div className="mode guide-page qguide">
      <ModeHeader eyebrow={`${list.length} of ${qCards.length} answers · from ${questionCount} quiz questions${lowCount && !settings.includeLow ? ` · ${lowCount} low-priority hidden` : ''}`} title="Questions Guide">
        <a className="btn btn-ghost" href="#quiz">Take the quiz</a>
      </ModeHeader>
      <p className="lede qguide-lede">
        Every correct answer from your question sheets, with the explanation of why it’s right. To drill these, switch Flashcards or any game to <strong>Questions Guide</strong>.
      </p>

      <div className="guide-tools">
        <label className="sr-only" htmlFor="qg-search">Search the questions guide</label>
        <input id="qg-search" type="search" placeholder="Search answers, explanations, questions…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="all">All domains</option>
          {domains.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
        <select aria-label="Confidence" value={level} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="all">Any confidence</option>
          {LEVEL_ORDER.map((l) => <option key={l} value={l}>{LEVELS[l].label}</option>)}
        </select>
        <div className="segmented" role="group" aria-label="Group by">
          {Object.entries(GROUPS).map(([k, label]) => (
            <button key={k} className={group === k ? 'is-on' : ''} onClick={() => setGroup(k)}>{label}</button>
          ))}
        </div>
        <label className="toggle" htmlFor="qg-missed">
          <input id="qg-missed" type="checkbox" checked={onlyMissed} onChange={(e) => setOnlyMissed(e.target.checked)} />
          <span>Only ones I’ve missed ({missedCount})</span>
        </label>
        {lowCount > 0 && (
          <label className="toggle" htmlFor="qg-low">
            <input id="qg-low" type="checkbox" checked={!!settings.includeLow} onChange={(e) => setSettings({ ...settings, includeLow: e.target.checked })} />
            <span>Show low priority ({lowCount})</span>
          </label>
        )}
        {sections.length > 1 && (
          <JumpMenu
            items={sections.map((s) => ({ key: s.key, label: group === 'domain' ? shortDomain(s.title) : s.title, count: s.items.length }))}
            onJump={(key) => scrollToSection(`qsec-${key}`)}
          />
        )}
      </div>


      {!list.length && (
        <div className="empty">{onlyMissed && !missedCount ? 'Nothing missed in the quiz yet.' : 'No answers match. Try a different search or filter.'}</div>
      )}

      {sections.map((s) => (
        <section key={s.key} id={`qsec-${s.key}`} className="guide-section">
          <h2 className={`guide-section-title ${s.tone ? `tone-${s.tone}` : ''}`}>
            {s.title}
            {s.sub && <small>{s.sub}</small>}
            <span className="count">{s.items.length}</span>
          </h2>
          <div className="guide-list">
            {s.items.map((c) => {
              const r = records[c.id];
              return (
                <article key={c.id} className={`entry qentry ${c.lowPriority ? 'is-low' : ''}`}>
                  <header className="entry-head">
                    <div className="entry-title">
                      <h3><Highlight text={c.term} q={q} /></h3>
                      <div className="entry-meta">
                        <DomainChip name={c.domain} />
                        <span className="category">{c.topics.join(' · ')}</span>
                        {c.lowPriority && <span className="pill pill-new" title={c.priorityNotes.join('; ')}>Low priority</span>}
                        {r.tried && (
                          <span className={`pill ${r.wrong ? 'pill-red' : 'pill-green'}`} title="Your quiz record for this answer">
                            Quiz: {r.right} right{r.wrong ? ` · ${r.wrong} missed` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="entry-rate" role="group" aria-label={`Confidence for ${c.term}`}>
                      {LEVEL_ORDER.map((l) => (
                        <button key={l} className={`rate-chip rc-${l} ${c.level === l ? 'is-on' : ''}`} onClick={() => setLevel(c.id, l)} aria-pressed={c.level === l}>
                          {LEVELS[l].short}
                        </button>
                      ))}
                    </div>
                  </header>

                  {c.whys.length ? (
                    c.whys.map((w, k) => <p key={k} className="qentry-why"><Highlight text={w} q={q} /></p>)
                  ) : (
                    <p className="qentry-why muted">No explanation in the sheet for this one yet.</p>
                  )}

                  {c.lowPriority && c.priorityNotes.length > 0 && (
                    <p className="qentry-low muted">Low priority: {c.priorityNotes.join('; ')}.</p>
                  )}
                  {c.related && c.related.term !== c.term && (
                    <p className="qentry-related">
                      <span className="field-label">Study guide</span> <strong>{c.related.term}</strong>
                      {c.related.hint && <span className="muted"> · {c.related.hint}</span>}
                    </p>
                  )}

                  <details className="qentry-questions">
                    <summary>Show the question{c.questions.length > 1 ? `s (${c.questions.length})` : ''}</summary>
                    {c.questions.map((x) => (
                      <div key={x.id} className="qentry-q">
                        <p><Highlight text={x.text} q={q} /></p>
                        <ul>
                          {x.options.map((o) => (
                            <li key={o.letter} className={x.correct.includes(o.letter) ? 'is-right' : ''}>
                              <span className="qentry-letter">{o.letter}</span> {o.text}
                              {x.correct.includes(o.letter) && <span className="sr-only"> (correct)</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
