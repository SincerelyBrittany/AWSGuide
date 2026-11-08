// Browser storage wrappers. Everything is optional: if storage is blocked the app still works for the session.
const KEYS = {
  deck: 'clf-arcade:deck:v1',
  progress: 'clf-arcade:progress:v1',
  settings: 'clf-arcade:settings:v1',
  best: 'clf-arcade:best:v1',
  stats: 'clf-arcade:stats:v1',
  quiz: 'clf-arcade:quiz:v1',
  questions: 'clf-arcade:questions:v1',
  vocabSkips: 'clf-arcade:vocab-skips:v1',
  vocabFlags: 'clf-arcade:vocab-flags:v1',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Returns true when the value was actually saved.
function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else {
      localStorage.setItem(key, JSON.stringify(value));
      if (localStorage.getItem(key) === null) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const loadDeck = () => read(KEYS.deck, null);
export const saveDeck = (deck) => write(KEYS.deck, deck);
export const loadProgress = () => read(KEYS.progress, {});
export const saveProgress = (p) => write(KEYS.progress, p);
export const loadSettings = () => read(KEYS.settings, { includeLow: false });
export const saveSettings = (s) => write(KEYS.settings, s);
export const loadStats = () => read(KEYS.stats, null);
export const saveStats = (s) => write(KEYS.stats, s);
export const loadBest = () => read(KEYS.best, {});
export const saveBest = (b) => write(KEYS.best, b);
export const loadQuiz = () => read(KEYS.quiz, null);
export const saveQuiz = (q) => write(KEYS.quiz, q);
export const loadImportedQuestions = () => read(KEYS.questions, []);
export const saveImportedQuestions = (q) => write(KEYS.questions, q);
export const loadVocabSkips = () => read(KEYS.vocabSkips, {});
export const saveVocabSkips = (v) => write(KEYS.vocabSkips, v);
export const loadVocabFlags = () => read(KEYS.vocabFlags, {});
export const saveVocabFlags = (v) => write(KEYS.vocabFlags, v);
