// Relie le moteur de mémorisation à une session de jeu, pour UNE opération/section
// à la fois : construit la file de rounds, persiste les cartes Leitner en local,
// ajuste légèrement le temps imparti selon la réussite récente (zone de flow), et
// prolonge un peu la pratique (révisions recyclées) plutôt que de s'arrêter net
// dès que les quelques nouveautés du jour sont épuisées — mais reste courte
// (~1 minute par section) : un enfant de 10 ans décroche vite au-delà.

import { buildOperationFamilies, introGroupOrderFor, isTrivial } from '../engine/facts.js';
import { createCard, recordAnswer, selectDailyFacts, promoteFromDiagnostic, DIAGNOSTIC_BOX } from '../engine/leitner.js';
import { buildRound } from './round.js';
import { updateStreak } from './streak.js';
import { computeProgress } from '../engine/progress.js';
import { loadAllCards, saveCard } from './storage.js';

const SESSION_ROUND_BUDGET = 400; // filet de sécurité ; c'est le temps, pas ce compteur, qui limite la session
const TARGET_SESSION_MS = 60 * 1000; // dosage visé par section : court, pour ne pas lasser
const MAX_SESSION_MS = 90 * 1000; // garde-fou si jamais le recyclage tournait en rond
const DIAGNOSTIC_SAMPLE_PER_GROUP = 3; // "test rapide" : un échantillon par groupe, pas tout
const BASE_TIME_MS = 3500;
const MIN_TIME_MS = 1500;
const MAX_TIME_MS = 5000;
const STUDY_TIME_MS = 12000; // temps calme pour lire l'astuce, sans chrono de réponse ni pression
const FIRST_ATTEMPT_TIME_MS = 5000; // essai qui suit l'étude : un peu plus généreux qu'une révision normale
const STRUGGLING_AFTER_ATTEMPTS = 3; // filet de sécurité si un fait reste au palier 0 après ce nombre d'essais
const MAX_NEW_FACTS_PER_SESSION = 4;
const DIAGNOSTIC_TIME_MS = 4000; // test rapide : temps fixe, pas d'ajustement adaptatif

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// "Test rapide" : échantillonne dans TOUS les groupes d'un coup (pas de gating
// séquentiel) pour vérifier ce que l'enfant sait peut-être déjà, plutôt que de
// le faire attendre des semaines avant même de pouvoir le montrer.
function buildDiagnosticQueue(families) {
  const byGroup = new Map();
  for (const family of families) {
    if (!byGroup.has(family.introGroup)) byGroup.set(family.introGroup, []);
    byGroup.get(family.introGroup).push(family);
  }
  const sample = [];
  for (const group of byGroup.values()) {
    sample.push(...shuffle(group).slice(0, DIAGNOSTIC_SAMPLE_PER_GROUP));
  }
  return shuffle(sample).map((f) => f.id);
}

export class Session {
  constructor(operation, options = {}) {
    this.operation = operation;
    this.mode = options.mode === 'diagnostic' ? 'diagnostic' : 'normal';
    this.today = todayStr();
    this.startedAt = Date.now();
    this.pausedAt = null;
    this.dailyStreak = updateStreak(this.today);
    this.families = buildOperationFamilies(operation);
    this.familiesById = new Map(this.families.map((f) => [f.id, f]));

    const allCards = loadAllCards();
    this.cardsById = new Map();
    for (const family of this.families) {
      if (allCards.has(family.id)) this.cardsById.set(family.id, allCards.get(family.id));
    }

    // Les faits triviaux (×0, ×1, ÷1, +1, -1) n'ont pas besoin de grimper
    // lentement palier par palier comme un vrai apprentissage — un enfant de
    // 10 ans les connaît déjà. On les avance directement au lieu de les faire
    // refaire encore et encore et de bloquer les groupes suivants derrière eux.
    for (const family of this.families) {
      if (!isTrivial(family)) continue;
      const existing = this.cardsById.get(family.id);
      if (existing && existing.box >= DIAGNOSTIC_BOX) continue;
      const boosted = promoteFromDiagnostic(existing, this.today);
      boosted.familyId = family.id;
      this.cardsById.set(family.id, boosted);
      saveCard(family.id, boosted);
    }

    if (this.mode === 'diagnostic') {
      this.queue = buildDiagnosticQueue(this.families);
    } else {
      const { reviewFamilies, newFamilies } = selectDailyFacts(this.families, this.cardsById, this.today, {
        maxNewFacts: MAX_NEW_FACTS_PER_SESSION,
        introGroupOrder: introGroupOrderFor(operation),
      });
      this.queue = buildInitialQueue(reviewFamilies, newFamilies);
    }

    this.timeBudgetMs = BASE_TIME_MS;
    this.correctStreak = 0;
    this.roundsPlayed = 0;
    this.roundsCorrect = 0;
    this.points = 0;
    this.currentFamilyId = null;
  }

  pause() {
    if (this.pausedAt === null) this.pausedAt = Date.now();
  }

  resume() {
    if (this.pausedAt !== null) {
      this.startedAt += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  get comboMultiplier() {
    return Math.min(4, 1 + Math.floor(this.correctStreak / 3));
  }

  getProgress() {
    return computeProgress(this.families, this.cardsById);
  }

  elapsedMs() {
    return Date.now() - this.startedAt;
  }

  // Une fois les révisions dues et les nouveautés épuisées, on continue à
  // pratiquer (faits déjà rencontrés aujourd'hui ou avant) plutôt que de
  // s'arrêter après une poignée de rounds — jusqu'au dosage visé.
  refillQueue() {
    const candidates = this.families.filter((f) => this.cardsById.has(f.id));
    if (candidates.length === 0) return false;
    this.queue.push(...shuffle(candidates).map((f) => f.id));
    return true;
  }

  hasNext() {
    if (this.mode === 'diagnostic') {
      return this.queue.length > 0;
    }
    const elapsed = this.elapsedMs();
    if (this.queue.length === 0 && elapsed < TARGET_SESSION_MS) {
      this.refillQueue();
    }
    return this.queue.length > 0 && elapsed < MAX_SESSION_MS && this.roundsPlayed < SESSION_ROUND_BUDGET;
  }

  nextRound() {
    const familyId = this.queue.shift();
    const family = this.familiesById.get(familyId);
    this.currentFamilyId = familyId;

    if (this.mode === 'diagnostic') {
      // Un test rapide n'enseigne pas : pas d'astuce, pas de temps d'étude,
      // juste "le sais-tu, oui ou non ?".
      return buildRound(family, DIAGNOSTIC_TIME_MS, false, null);
    }

    let card = this.cardsById.get(familyId);
    if (!card) {
      card = createCard(familyId, this.today);
      this.cardsById.set(familyId, card);
    }

    // Astuce montrée à la toute première rencontre, puis seulement en filet de
    // sécurité si le fait reste bloqué au palier 0 après plusieurs essais —
    // jamais pendant les révisions normales.
    const isFirstExposure = card.totalSeen === 0;
    const isStruggling = card.box === 0 && card.totalSeen >= STRUGGLING_AFTER_ATTEMPTS;
    const showHint = isFirstExposure || isStruggling;
    const timeBudget = showHint ? FIRST_ATTEMPT_TIME_MS : this.timeBudgetMs;
    const studyTimeMs = showHint ? STUDY_TIME_MS : null;

    return buildRound(family, timeBudget, showHint, studyTimeMs);
  }

  submitAnswer(correct) {
    if (this.mode === 'diagnostic') return this.submitDiagnosticAnswer(correct);

    const card = this.cardsById.get(this.currentFamilyId);
    const wasFirstExposure = card.totalSeen === 0;
    const updated = recordAnswer(card, correct, this.today);
    this.cardsById.set(this.currentFamilyId, updated);
    saveCard(this.currentFamilyId, updated);

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

  // Un test rapide n'a pas de combo/points ni de reprise en cas d'erreur —
  // chaque fait n'est demandé qu'une fois, ce n'est pas une session d'entraînement.
  submitDiagnosticAnswer(correct) {
    this.roundsPlayed++;
    if (correct) {
      this.roundsCorrect++;
      const existing = this.cardsById.get(this.currentFamilyId);
      const updated = promoteFromDiagnostic(existing, this.today);
      updated.familyId = this.currentFamilyId;
      this.cardsById.set(this.currentFamilyId, updated);
      saveCard(this.currentFamilyId, updated);
    }
    return { correct, pointsGained: 0, multiplier: 1, streak: 0 };
  }
}
