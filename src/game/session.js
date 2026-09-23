// Relie le moteur de mémorisation à une session de jeu : construit la file de rounds
// du jour, persiste les cartes Leitner en local, ajuste légèrement le temps imparti
// selon la réussite récente (zone de flow), et replanifie les nouveautés/erreurs plus
// loin dans la même session (pas seulement le lendemain).

import { buildAllFamilies, MULT_INTRO_GROUP_ORDER, ADD_INTRO_GROUP_ORDER } from '../engine/facts.js';
import { createCard, recordAnswer, selectDailyFacts } from '../engine/leitner.js';
import { buildRound } from './round.js';
import { updateStreak } from './streak.js';
import { computeProgress } from '../engine/progress.js';

const STORAGE_KEY = 'tables-arcade:cards:v1';
const SESSION_ROUND_BUDGET = 50;
const BASE_TIME_MS = 3500;
const MIN_TIME_MS = 1500;
const MAX_TIME_MS = 5000;
const STUDY_TIME_MS = 12000; // temps calme pour lire l'astuce, sans chrono de réponse ni pression
const FIRST_ATTEMPT_TIME_MS = 5000; // essai qui suit l'étude : un peu plus généreux qu'une révision normale
const STRUGGLING_AFTER_ATTEMPTS = 3; // filet de sécurité si un fait reste au palier 0 après ce nombre d'essais
const MAX_NEW_FACTS_PER_SESSION = 4;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveCards(cardsById) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cardsById)));
  } catch {
    // stockage indisponible (navigation privée, quota) : la session continue en mémoire seulement
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Mélange les révisions dues avec les nouveautés, réparties tout au long de la file
// plutôt que regroupées au début ou à la fin.
function buildInitialQueue(reviewFamilies, newFamilies) {
  const reviews = shuffle(reviewFamilies).map((f) => f.id);
  const news = newFamilies.map((f) => f.id);
  if (reviews.length === 0) return news;

  const spacing = news.length ? Math.max(2, Math.floor(reviews.length / (news.length + 1))) : Infinity;
  const queue = [];
  let newIdx = 0;
  for (let i = 0; i < reviews.length; i++) {
    queue.push(reviews[i]);
    if (newIdx < news.length && (i + 1) % spacing === 0) {
      queue.push(news[newIdx]);
      newIdx++;
    }
  }
  while (newIdx < news.length) queue.push(news[newIdx++]);
  return queue;
}

export class Session {
  constructor() {
    this.today = todayStr();
    this.dailyStreak = updateStreak(this.today);
    this.families = buildAllFamilies();
    this.familiesById = new Map(this.families.map((f) => [f.id, f]));
    this.cardsById = loadCards();

    const { reviewFamilies, newFamilies } = selectDailyFacts(this.families, this.cardsById, this.today, {
      maxNewFacts: MAX_NEW_FACTS_PER_SESSION,
      multIntroGroupOrder: MULT_INTRO_GROUP_ORDER,
      addIntroGroupOrder: ADD_INTRO_GROUP_ORDER,
    });

    this.queue = buildInitialQueue(reviewFamilies, newFamilies);
    this.timeBudgetMs = BASE_TIME_MS;
    this.correctStreak = 0;
    this.roundsPlayed = 0;
    this.roundsCorrect = 0;
    this.points = 0;
    this.currentFamilyId = null;
  }

  get comboMultiplier() {
    return Math.min(4, 1 + Math.floor(this.correctStreak / 3));
  }

  getProgress() {
    return computeProgress(this.families, this.cardsById);
  }

  hasNext() {
    return this.queue.length > 0 && this.roundsPlayed < SESSION_ROUND_BUDGET;
  }

  nextRound() {
    const familyId = this.queue.shift();
    const family = this.familiesById.get(familyId);
    let card = this.cardsById.get(familyId);
    if (!card) {
      card = createCard(familyId, this.today);
      this.cardsById.set(familyId, card);
    }
    this.currentFamilyId = familyId;

    // Astuce montrée à la toute première rencontre, puis seulement en filet de
    // sécurité si le fait reste bloqué au palier 0 après plusieurs essais —
    // jamais pendant les révisions normales.
    const isFirstExposure = card.totalSeen === 0;
    const isStruggling = card.box === 0 && card.totalSeen >= STRUGGLING_AFTER_ATTEMPTS;
    const showHint = isFirstExposure || isStruggling;
    const timeBudget = showHint ? FIRST_ATTEMPT_TIME_MS : this.timeBudgetMs;
    const studyTimeMs = showHint ? STUDY_TIME_MS : null;

    return buildRound(family, card, timeBudget, showHint, studyTimeMs);
  }

  submitAnswer(correct) {
    const card = this.cardsById.get(this.currentFamilyId);
    const wasFirstExposure = card.totalSeen === 0;
    const updated = recordAnswer(card, correct, this.today);
    this.cardsById.set(this.currentFamilyId, updated);
    saveCards(this.cardsById);

    this.roundsPlayed++;
    let pointsGained = 0;

    if (correct) {
      this.roundsCorrect++;
      this.correctStreak++;
      const multiplier = this.comboMultiplier;
      pointsGained = 10 * multiplier;
      this.points += pointsGained;
      if (this.correctStreak >= 4) {
        this.timeBudgetMs = Math.max(MIN_TIME_MS, this.timeBudgetMs - 150);
      }
      // Palier 0 (nouveau) : revoir une deuxième fois dans la même session.
      if (wasFirstExposure) this.reinsertLater(this.currentFamilyId);
    } else {
      this.correctStreak = 0;
      this.timeBudgetMs = Math.min(MAX_TIME_MS, this.timeBudgetMs + 300);
      // Palier 0 (raté) : revoir plus tard dans la même session, pas seulement demain.
      this.reinsertLater(this.currentFamilyId);
    }

    return { correct, pointsGained, multiplier: this.comboMultiplier, streak: this.correctStreak };
  }

  reinsertLater(familyId) {
    const position = Math.min(this.queue.length, 4 + Math.floor(Math.random() * 3));
    this.queue.splice(position, 0, familyId);
  }
}
