import { useMemo, useState } from 'react';
import { LEVELS, domainTone, shortDomain, lookup } from '../lib/deck.js';
import { DomainChip, ModeHeader, Triggers } from './ui.jsx';

const GROUPS = { domain: 'Domain', category: 'Category', az: 'A–Z' };
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

export default function Guide({ cards, deck, domains, index, setLevel, settings, setSettings }) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('all');
  const [category, setCategory] = useState('all');
  const [level, setLevelFilter] = useState('all');
  const [group, setGroup] = useState('domain');
  const [flash, setFlash] = useState(null);

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => [...new Set(cards.map((c) => c.category))].sort(), [cards]);

  const list = useMemo(() => {
    const match = (c) =>
      !q ||
      [c.term, c.category, c.hint, c.eli12, c.definition, c.official, c.notes, ...c.triggers, ...c.confuse]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q));
    return cards
      .filter((c) => (domain === 'all' || c.domain === domain) && (category === 'all' || c.category === category) && (level === 'all' || c.level === level) && match(c))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [cards, q, domain, category, level]);

  const sections = useMemo(() => {
    if (group === 'az') {
      const m = new Map();
      list.forEach((c) => {
        const k = /[a-z]/i.test(c.term.replace(/^(AWS|Amazon)\s+/, '')[0]) ? c.term.replace(/^(AWS|Amazon)\s+/, '')[0].toUpperCase() : '#';
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(c);
      });
      return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => ({ key: k, title: k, items }));
    }
    if (group === 'category') {
      const m = new Map();
      list.forEach((c) => {
        if (!m.has(c.category)) m.set(c.category, []);
        m.get(c.category).push(c);
      });
      return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => ({ key: k, title: k, items }));
    }
    return domains
      .map((d) => ({ key: d.name, title: d.name, sub: `${d.weight}% of exam`, tone: domainTone(d.name), items: list.filter((c) => c.domain === d.name) }))
      .filter((s) => s.items.length);
  }, [list, group, domains]);

  const jumpTo = (name) => {
    const target = lookup(name, index);
    if (!target) return;
    if (!list.some((c) => c.id === target.id)) {
      setQuery('');
      setDomain('all');
      setCategory('all');
      setLevelFilter('all');
    }
    setTimeout(() => {
      document.getElementById(`concept-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlash(target.id);
      setTimeout(() => setFlash(null), 1600);
    }, 50);
  };

  const lowCount = deck.cards.filter((c) => c.lowPriority).length;

  return (
    <div className="mode guide-page">
      <ModeHeader eyebrow={`${list.length} of ${cards.length} concepts${settings.includeLow ? '' : ` · ${lowCount} low-priority hidden`}`} title="Study Guide" />

      <div className="guide-tools">
        <label className="sr-only" htmlFor="guide-search">Search the study guide</label>
        <input id="guide-search" type="search" placeholder="Search names, definitions, triggers…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select id="guide-domain" aria-label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="all">All domains</option>
          {domains.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
        <select id="guide-category" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select id="guide-level" aria-label="Confidence" value={level} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="all">Any confidence</option>
          {LEVEL_ORDER.map((l) => <option key={l} value={l}>{LEVELS[l].label}</option>)}
        </select>
        <div className="segmented" role="group" aria-label="Group by">
          {Object.entries(GROUPS).map(([k, label]) => (
            <button key={k} className={group === k ? 'is-on' : ''} onClick={() => setGroup(k)}>{label}</button>
          ))}
        </div>
        <label className="toggle" htmlFor="guide-low">
          <input id="guide-low" type="checkbox" checked={settings.includeLow} onChange={(e) => setSettings({ ...settings, includeLow: e.target.checked })} />
          <span>Show low priority ({lowCount})</span>
        </label>
      </div>

      {sections.length > 1 && (
        <nav className="guide-jump" aria-label="Jump to section">
          {sections.map((s) => (
            <button key={s.key} onClick={() => document.getElementById(`sec-${s.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {group === 'domain' ? shortDomain(s.title) : s.title} <span className="count">{s.items.length}</span>
            </button>
          ))}
        </nav>
      )}

      {!list.length && <div className="empty">No concepts match. Try a different search or filter.</div>}

      {sections.map((s) => (
        <section key={s.key} id={`sec-${s.key}`} className="guide-section">
          <h2 className={`guide-section-title ${s.tone ? `tone-${s.tone}` : ''}`}>
            {s.title}
            {s.sub && <small>{s.sub}</small>}
            <span className="count">{s.items.length}</span>
          </h2>
          <div className="guide-list">
            {s.items.map((c) => (
              <article key={c.id} id={`concept-${c.id}`} className={`entry ${flash === c.id ? 'is-flash' : ''} ${c.lowPriority ? 'is-low' : ''}`}>
                <header className="entry-head">
                  <div className="entry-title">
                    <h3><Highlight text={c.term} q={q} /></h3>
                    <div className="entry-meta">
                      <DomainChip name={c.domain} />
                      <span className="category">{c.category}</span>
                      {c.lowPriority && <span className="pill pill-new">Low priority</span>}
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

                {c.hint && <p className="entry-hint"><Highlight text={c.hint} q={q} /></p>}

                <dl className="entry-grid">
                  {c.eli12 && (
                    <div><dt>Like I’m 12</dt><dd><Highlight text={c.eli12} q={q} /></dd></div>
                  )}
                  <div><dt>Exam definition</dt><dd><Highlight text={c.definition} q={q} /></dd></div>
                  {c.official && (
                    <div className="entry-official">
                      <dt>Official AWS definition</dt>
                      <dd>
                        <Highlight text={c.official} q={q} />
                        {c.officialSource && <a className="source-link" href={c.officialSource} target="_blank" rel="noopener noreferrer">Source ↗</a>}
                      </dd>
                    </div>
                  )}
                  {c.triggers.length > 0 && (
                    <div><dt>Exam triggers</dt><dd><Triggers items={c.triggers} /></dd></div>
                  )}
                  {c.confuse.length > 0 && (
                    <div>
                      <dt>Don’t confuse with</dt>
                      <dd className="confuse-links">
                        {c.confuse.map((name) =>
                          lookup(name, index) ? (
                            <button key={name} className="link-btn" onClick={() => jumpTo(name)}>{name}</button>
                          ) : (
                            <span key={name}>{name}</span>
                          )
                        )}
                      </dd>
                    </div>
                  )}
                  {c.notes && (
                    <div><dt>My notes</dt><dd><Highlight text={c.notes} q={q} /></dd></div>
                  )}
                </dl>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
