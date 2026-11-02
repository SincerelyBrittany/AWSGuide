import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import builtInDeck from './data/studyGuide.json';
import builtInQuestions from './data/questions.json';
import focusDeck from './data/focus.json';
// Optional, git-ignored: personal questions from data/private/ (see scripts/sync-data.mjs).
const privateQuestions = Object.values(import.meta.glob('./data/privateQuestions.json', { eager: true, import: 'default' }))[0]?.questions || [];
import { parseQuestionFile, mergeQuestions } from './lib/parseQuestions.js';
import { linkConcept, emptyQuizHistory, recordQuestion, addAttempt } from './lib/quiz.js';
import Quiz from './modes/Quiz.jsx';
import QuestionsGuide from './modes/QuestionsGuide.jsx';
import { buildQuestionCards } from './lib/questionCards.js';
import { DeckSwitch } from './modes/ui.jsx';
import { parseWorkbook } from './lib/parseWorkbook.js';
import { buildIndex, demote } from './lib/deck.js';
import * as store from './lib/storage.js';
import Home from './modes/Home.jsx';
import Flashcards from './modes/Flashcards.jsx';
import Showdown from './modes/Showdown.jsx';
import RapidFire from './modes/RapidFire.jsx';
import GameBoard from './modes/GameBoard.jsx';
import MemoryMatch from './modes/MemoryMatch.jsx';
import Progress from './modes/Progress.jsx';
import Guide from './modes/Guide.jsx';
import { emptyStats, recordAnswer, upgradeStats, deckOf, SESSION_GAP_MS } from './lib/stats.js';

export const MODES = [
  { id: 'flashcards', label: 'Flashcards', blurb: 'Flip, rate yourself, and your weak cards come back more often.', Component: Flashcards },
  { id: 'showdown', label: "Don't Confuse Me", blurb: 'Two look-alike services. One exam clue. Pick the right one.', Component: Showdown },
  { id: 'rapid', label: 'Rapid-Fire', blurb: '60 seconds of exam triggers. Misses cost you 3 seconds.', Component: RapidFire },
  { id: 'board', label: 'Game Board', blurb: 'Jeopardy-style board. Points follow the exam domain weights.', Component: GameBoard },
  { id: 'match', label: 'Memory Match', blurb: 'Pair each service with its memory hint. A lighter review.', Component: MemoryMatch },
  { id: 'quiz', label: 'Quiz', blurb: 'Exam-style questions with explanations. Practice, or a timed exam simulation.', Component: Quiz },
];

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash.slice(1));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const [deck, setDeck] = useState(() => store.loadDeck() || builtInDeck);
  const [progress, setProgress] = useState(() => store.loadProgress());
  const [settings, setSettings] = useState(() => store.loadSettings());
  const [stats, setStats] = useState(() => store.loadStats() || emptyStats());
  const [quizHistory, setQuizHistory] = useState(() => store.loadQuiz() || emptyQuizHistory());
  const [importedQuestions, setImportedQuestions] = useState(() => store.loadImportedQuestions());
  const session = useRef(null);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const isImported = deck !== builtInDeck && deck.importedAt !== builtInDeck.importedAt;

  useEffect(() => { store.saveProgress(progress); }, [progress]);
  useEffect(() => { store.saveSettings(settings); }, [settings]);
  useEffect(() => { store.saveStats(stats); }, [stats]);
  useEffect(() => { store.saveQuiz(quizHistory); }, [quizHistory]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  // Study-guide cards in play, with your saved confidence layered over the spreadsheet's.
  const guideCards = useMemo(
    () =>
      deck.cards
        .filter((c) => settings.includeLow || !c.lowPriority)
        .map((c) => ({ ...c, level: progress[c.id] || c.confidence })),
    [deck, progress, settings.includeLow]
  );
  const guideIndex = useMemo(() => buildIndex(guideCards), [guideCards]);
  const guideDomains = useMemo(() => deck.domains.filter((d) => guideCards.some((c) => c.domain === d.name)), [deck, guideCards]);

  // Practice questions: built-in bank plus anything imported in this browser, each linked to the concept it tests.
  const allQuestions = useMemo(() => mergeQuestions(builtInQuestions.questions, privateQuestions, importedQuestions), [importedQuestions]);
  // Retired or out-of-scope questions are hidden unless "show low priority" is on (same switch as the study guide).
  const questions = useMemo(() => allQuestions.filter((q) => settings.includeLow || !q.lowPriority), [allQuestions, settings.includeLow]);
  const lowQuestionCount = allQuestions.length - allQuestions.filter((q) => !q.lowPriority).length;
  const links = useMemo(() => {
    const all = buildIndex(deck.cards);
    const out = {};
    for (const q of allQuestions) {
      const l = linkConcept(q, all);
      if (l) out[q.id] = { ...l, domain: l.card.domain };
    }
    return out;
  }, [allQuestions, deck]);

  // Questions Guide: one card per correct answer, titled by the answer, defined by "why it's right".
  const qCardsBase = useMemo(() => buildQuestionCards(questions, links), [questions, links]);
  // Every quiz question (hidden ones too) → its Questions Guide entry, so quiz answers count there.
  const qCardOf = useMemo(() => {
    const out = {};
    for (const c of buildQuestionCards(allQuestions, links)) for (const q of c.questions) out[q.id] = c;
    return out;
  }, [allQuestions, links]);

  // One-time upgrade of history saved before answers were tagged by deck.
  useEffect(() => {
    if ((stats.version || 1) < 2) setStats((st) => upgradeStats(st, quizHistory, qCardOf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.version]);
  const qCards = useMemo(() => qCardsBase.map((c) => ({ ...c, level: progress[c.id] || c.confidence })), [qCardsBase, progress]);
  const qIndex = useMemo(() => buildIndex(qCards), [qCards]);
  const qDomains = useMemo(() => deck.domains.filter((d) => qCards.some((c) => c.domain === d.name)), [deck, qCards]);

  // Flashcards, the games and Progress run on whichever deck is switched on.
  // Focus deck: a temporary, separate deck from data/focus/ (practice-test weak spots).
  const focusCards = useMemo(() => (focusDeck.cards || []).map((c) => ({ ...c, level: progress[c.id] || c.confidence })), [progress]);
  const focusIndex = useMemo(() => buildIndex(focusCards), [focusCards]);
  const focusDomains = useMemo(() => deck.domains.filter((d) => focusCards.some((c) => c.domain === d.name)), [deck, focusCards]);

  // Flashcards, the games and Progress run on whichever deck is switched on.
  const source =
    settings.source === 'questions' && qCards.length ? 'questions' : settings.source === 'focus' && focusCards.length ? 'focus' : 'guide';
  const pick = (g, q, f) => (source === 'questions' ? q : source === 'focus' ? f : g);
  const cards = pick(guideCards, qCards, focusCards);
  const index = pick(guideIndex, qIndex, focusIndex);
  const domains = pick(guideDomains, qDomains, focusDomains);
  const setSource = (v) => setSettings((st) => ({ ...st, source: v }));

  const setLevel = useCallback((id, level) => setProgress((p) => ({ ...p, [id]: level })), []);
  const missed = useCallback(
    (card) => setProgress((p) => ({ ...p, [card.id]: demote(p[card.id] || card.confidence) })),
    []
  );

  // Every answer in every game lands here. A session is one stretch of play in one mode;
  // switching modes or 30 idle minutes starts a new one.
  const record = useCallback(
    (cardOrCards, outcome) => {
      const cards = [].concat(cardOrCards).filter(Boolean);
      if (!cards.length) return;
      const now = Date.now();
      // Switching deck in a game also starts a new session, so each session belongs to one deck.
      const key = `${hash}|${hash === 'quiz' ? 'both' : deckOf(cards[0])}`;
      const s = session.current;
      if (!s || s.key !== key || now - s.lastAt > SESSION_GAP_MS) session.current = { id: `s${now}`, key, lastAt: now };
      else s.lastAt = now;
      setStats((st) => recordAnswer(st, { cards, outcome, mode: hash, sessionId: session.current.id, now }));
    },
    [hash]
  );

  const onImport = async (file) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      // A question sheet (Question / Answer A–D / Correct Answer) goes to the Quiz; anything else is the study guide.
      const qs = parseQuestionFile(buf, 'array', file.name.replace(/\.xlsx?$/i, ''));
      if (qs.questions.length) {
        const known = new Set(allQuestions.map((x) => x.id));
        const fresh = qs.questions.filter((x) => !known.has(x.id)).length;
        const nextImported = mergeQuestions(importedQuestions, qs.questions);
        const saved = store.saveImportedQuestions(nextImported);
        setImportedQuestions(nextImported);
        const parts = [`Added ${qs.questions.length} quiz questions${fresh < qs.questions.length ? ` (${fresh} new, ${qs.questions.length - fresh} already in the bank)` : ''}.`];
        if (qs.skipped.length) parts.push(`Skipped ${qs.skipped.length}: ${qs.skipped.slice(0, 2).join('; ')}${qs.skipped.length > 2 ? '…' : ''}.`);
        parts.push(saved ? 'Saved in this browser.' : 'This view can’t save them, so they reset when you reload.');
        setToast({ kind: qs.skipped.length || !saved ? 'warn' : 'ok', text: parts.join(' ') });
        if (window.location.hash !== '#quiz') window.location.hash = 'quiz';
        return;
      }
      const next = parseWorkbook(buf, 'array');
      if (!next.cards.length) throw new Error('The sheet has the right headers but no concept rows under them.');
      const before = new Set(deck.cards.map((c) => c.id));
      const added = next.cards.filter((c) => !before.has(c.id)).length;
      const hidden = next.cards.filter((c) => c.lowPriority).length;
      const saved = store.saveDeck(next);
      setDeck(next);
      const parts = [`Imported ${next.cards.length} concepts${added ? ` (${added} new)` : ''}.`];
      if (hidden && !settings.includeLow) parts.push(`${hidden} low-priority/out-of-scope ${hidden === 1 ? 'card is' : 'cards are'} hidden; turn them on under Your deck.`);
      parts.push(saved ? 'Saved in this browser.' : 'This view can’t save it, so it will reset when you reload.');
      setToast({ kind: saved ? 'ok' : 'warn', text: parts.join(' ') });
    } catch (err) {
      setToast({ kind: 'error', text: `Couldn’t read that file. ${err.message}` });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const useBuiltIn = () => {
    store.saveDeck(null);
    setDeck(builtInDeck);
    setToast({ kind: 'ok', text: 'Switched back to the built-in deck.' });
  };

  const resetProgress = () => {
    setProgress({});
    setToast({ kind: 'ok', text: 'Progress reset to the confidence levels in your spreadsheet.' });
  };

  const quizProps = {
    questions,
    qCardOf,
    lowCount: lowQuestionCount,
    settings,
    setSettings,
    links,
    quizHistory,
    onQuestion: (id, result) => setQuizHistory((h) => recordQuestion(h, id, result)),
    onAttempt: (a) => setQuizHistory((h) => addAttempt(h, a)),
  };
  const mode = MODES.find((m) => m.id === hash);
  const shared = { cards, index, domains, deck, setLevel, missed, record, stats };
  const guideShared = { ...shared, cards: guideCards, index: guideIndex, domains: guideDomains };
  const deckSwitch = (
    <DeckSwitch value={source} onChange={setSource} counts={{ guide: guideCards.length, questions: qCards.length, focus: focusCards.length }} focusName={focusDeck.name} />
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#" className="brand" aria-label="Study Arcade home">
            <span className="brand-mark" aria-hidden="true">C02</span>
            <span className="brand-name">Study Arcade</span>
          </a>
          <nav className="tabs" aria-label="Study modes">
            {MODES.map((m) => (
              <a key={m.id} href={`#${m.id}`} className={`tab ${hash === m.id ? 'is-active' : ''}`} aria-current={hash === m.id ? 'page' : undefined}>
                {m.label}
              </a>
            ))}
            <a href="#guide" className={`tab tab-guide ${hash === 'guide' ? 'is-active' : ''}`} aria-current={hash === 'guide' ? 'page' : undefined}>
              Study Guide
            </a>
            <a href="#questions" className={`tab tab-qguide ${hash === 'questions' ? 'is-active' : ''}`} aria-current={hash === 'questions' ? 'page' : undefined}>
              Questions Guide
            </a>
            <a href="#progress" className={`tab tab-progress ${hash === 'progress' ? 'is-active' : ''}`} aria-current={hash === 'progress' ? 'page' : undefined}>
              Progress
            </a>
          </nav>
          <button className="btn btn-ghost import-btn" title="Import your study guide or a quiz question sheet (.xlsx)" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input ref={fileRef} id="import-file" type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      </header>

      <main className="main">
        {hash === 'guide' ? (
          <Guide {...guideShared} settings={settings} setSettings={setSettings} />
        ) : hash === 'questions' ? (
          <QuestionsGuide qCards={qCards} domains={qDomains} quizHistory={quizHistory} setLevel={setLevel} lowCount={lowQuestionCount} settings={settings} setSettings={setSettings} />
        ) : hash === 'progress' ? (
          <Progress
            deckSwitch={deckSwitch}
            source={source}
            {...shared}
            modes={MODES}
            progress={progress}
            extraBackup={{ quiz: quizHistory, questions: importedQuestions }}
            onRestore={(next) => {
              setStats(next.stats);
              if (next.progress) setProgress(next.progress);
              if (next.quiz) setQuizHistory(next.quiz);
              if (next.questions) {
                setImportedQuestions(next.questions);
                store.saveImportedQuestions(next.questions);
              }
              setToast({ kind: 'ok', text: `Restored ${Object.keys(next.stats.concepts).length} concepts and ${next.stats.sessions.length} sessions from the backup.` });
            }}
            onClearHistory={() => {
              setStats(emptyStats());
              setQuizHistory(emptyQuizHistory());
              session.current = null;
              setToast({ kind: 'ok', text: 'Answer history cleared.' });
            }}
            onError={(text) => setToast({ kind: 'error', text })}
          />
        ) : mode ? (
          mode.id === 'quiz' ? (
            <Quiz key="quiz" {...guideShared} {...quizProps} />
          ) : (
            <>
              <div className="deck-switch-bar">{deckSwitch}</div>
              <mode.Component key={`${mode.id}-${source}`} {...shared} />
            </>
          )
        ) : (
          <Home
            {...guideShared}
            deckSwitch={deckSwitch}
            focusCount={focusCards.length}
            modes={MODES}
            settings={settings}
            setSettings={setSettings}
            isImported={isImported}
            onImportClick={() => fileRef.current?.click()}
            onUseBuiltIn={useBuiltIn}
            onResetProgress={resetProgress}
          />
        )}
      </main>

      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
