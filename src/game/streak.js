// Séquence quotidienne (jours d'affilée) avec un jour de grâce : rater un jour
// ne casse pas tout, pour éviter le stress/la culpabilité (voir 2.2 du prompt
// produit) — mais deux jours manqués d'affilée repartent à zéro.

const STREAK_KEY = 'tables-arcade:streak:v1';

function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { lastPlayedDate: null, streakCount: 0, graceAvailable: true };
    return JSON.parse(raw);
  } catch {
    return { lastPlayedDate: null, streakCount: 0, graceAvailable: true };
  }
}

function saveStreak(state) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(state));
  } catch {
    // stockage indisponible : la séquence ne survivra pas à la session, tant pis
  }
}

function daysBetween(fromDate, toDate) {
  const d1 = new Date(`${fromDate}T00:00:00`);
  const d2 = new Date(`${toDate}T00:00:00`);
  return Math.round((d2 - d1) / 86400000);
}

// À appeler une fois par jour (au démarrage d'une session). Idempotent : si on
// est déjà passé aujourd'hui, ne fait rien de plus.
export function updateStreak(today) {
  const state = loadStreak();

  if (state.lastPlayedDate === today) {
    return { streakCount: state.streakCount, usedGrace: false, brokeStreak: false, isNewDay: false };
  }

  let usedGrace = false;
  let brokeStreak = false;

  if (!state.lastPlayedDate) {
    state.streakCount = 1;
    state.graceAvailable = true;
  } else {
    const gap = daysBetween(state.lastPlayedDate, today);
    if (gap === 1) {
      state.streakCount += 1;
      state.graceAvailable = true;
    } else if (gap === 2 && state.graceAvailable) {
      usedGrace = true;
      state.graceAvailable = false;
      state.streakCount += 1; // le jour manqué est pardonné, la séquence continue
    } else {
      brokeStreak = state.streakCount > 0;
      state.streakCount = 1;
      state.graceAvailable = true;
    }
  }

  state.lastPlayedDate = today;
  saveStreak(state);
  return { streakCount: state.streakCount, usedGrace, brokeStreak, isNewDay: true };
}

export function getStreak() {
  return loadStreak().streakCount;
}

export function getStreakState() {
  return loadStreak();
}
