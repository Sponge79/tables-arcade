// Boucle de jeu : un geste par round (choisir gauche ou droite), résultat immédiat,
// enchaînement sans coupure vers le round suivant. Aucune logique pédagogique ici —
// tout vient de Session (game/session.js). Chaque section (addition, soustraction,
// multiplication, division) a sa propre progression Leitner indépendante ; le menu
// permet de choisir laquelle jouer.
//
// Un round avec astuce se joue en deux temps : d'abord un temps d'étude calme, sans
// chrono de réponse ni choix affichés (juste lire/comprendre la stratégie), puis
// l'essai chronométré habituel — pour ne pas faire lire, réfléchir et courir contre
// la montre en même temps.

import { Session } from './game/session.js';
import { playCorrect, playWrong, startMusic, toggleMusic } from './game/audio.js';
import { initParticles, burst } from './game/particles.js';
import { initRunner, dashTo, resetRunner } from './game/runner.js';
import { checkTierUp } from './game/avatar.js';
import { computeAllOperationsProgress } from './game/summary.js';

const menuScreenEl = document.getElementById('menuScreen');
const sectionButtons = [...document.querySelectorAll('.sectionBtn')];
const diagnosticButtons = [...document.querySelectorAll('.sectionDiagnosticBtn')];
const menuBtn = document.getElementById('menuBtn');
const menuFromEndBtn = document.getElementById('menuFromEndBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const pauseOverlayEl = document.getElementById('pauseOverlay');

const appEl = document.getElementById('app');
const promptEl = document.getElementById('prompt');
const choiceLeftEl = document.getElementById('choiceLeft');
const choiceRightEl = document.getElementById('choiceRight');
const timerFillEl = document.getElementById('timerFill');
const timerBarEl = document.getElementById('timerBar');
const scoreEl = document.getElementById('score');
const pointsEl = document.getElementById('points');
const streakEl = document.getElementById('streak');
const streakBannerEl = document.getElementById('streakBanner');
const avatarBannerEl = document.getElementById('avatarBanner');
const masteryFillEl = document.getElementById('masteryFill');
const endProgressEl = document.getElementById('endProgress');
const comboBadgeEl = document.getElementById('comboBadge');
const hintEl = document.getElementById('hint');
const studyCaptionEl = document.getElementById('studyCaption');
const stageEl = document.getElementById('stage');
const endScreenEl = document.getElementById('endScreen');
const endStatsEl = document.getElementById('endStats');
const restartBtn = document.getElementById('restartBtn');
const muteBtn = document.getElementById('muteBtn');
const runnerTrackEl = document.getElementById('runnerTrack');
const runnerEl = document.getElementById('runner');

initParticles();
initRunner(runnerEl);

let session = null;
let currentRound = null;
let timerRAF = null;
let phaseStart = 0;
let resolved = false;
let audioUnlocked = false;
let studying = false;
let sectionActive = false;
let isPaused = false;
let pauseStart = 0;
let pendingStart = false;

// Phrases d'encouragement variables — pas la même récompense à chaque fois,
// sans système de loot : juste un peu d'imprévisibilité sympathique.
const HYPE_WORDS = ['Zoom !', 'Éclair !', 'Wow !', 'Parfait !', 'Boum !'];

function formatPrompt([a, op, b]) {
  return `${a} ${op} ${b}`;
}

function runnerOffsetFor(el) {
  const trackRect = runnerTrackEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const trackCenterX = trackRect.left + trackRect.width / 2;
  const elCenterX = elRect.left + elRect.width / 2;
  return elCenterX - trackCenterX;
}

function triggerShake(correct) {
  const cls = correct ? 'shake-correct' : 'shake-wrong';
  appEl.classList.remove('shake-correct', 'shake-wrong');
  void appEl.offsetWidth; // force un reflow pour pouvoir rejouer la même animation
  appEl.classList.add(cls);
}

function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  startMusic();
}

// --- Menu de sélection de section ---

function populateMenu() {
  const { perOperation } = computeAllOperationsProgress();
  const byOperation = new Map(perOperation.map((o) => [o.operation, o]));
  for (const btn of sectionButtons) {
    const info = byOperation.get(btn.dataset.operation);
    btn.querySelector('.sectionBtn-percent').textContent = `${info ? info.percent : 0}%`;
  }
}

function showMenu() {
  sectionActive = false;
  resolved = true;
  studying = false;
  isPaused = false;
  pendingStart = false;
  pauseOverlayEl.classList.add('hidden');
  cancelAnimationFrame(timerRAF);
  populateMenu();
  appEl.classList.add('hidden');
  menuScreenEl.classList.remove('hidden');
}

function startSection(operation, options = {}) {
  menuScreenEl.classList.add('hidden');
  appEl.classList.remove('hidden');
  stageEl.classList.remove('hidden');
  endScreenEl.classList.add('hidden');

  session = new Session(operation, options);
  sectionActive = true;
  pointsEl.textContent = '0 pt';
  scoreEl.textContent = '0 / 0';
  showStreak(session);
  updateAvatar(session);
  startRound();
}

for (const btn of sectionButtons) {
  btn.addEventListener('click', () => startSection(btn.dataset.operation));
}
for (const btn of diagnosticButtons) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    startSection(btn.dataset.operation, { mode: 'diagnostic' });
  });
}
menuBtn.addEventListener('click', showMenu);
menuFromEndBtn.addEventListener('click', showMenu);

// --- HUD : séquence quotidienne, maîtrise, personnage ---

function showStreak(session) {
  const { streakCount, usedGrace, brokeStreak, isNewDay } = session.dailyStreak;
  streakEl.textContent = `🔥 ${streakCount}`;

  if (!isNewDay) {
    streakBannerEl.classList.add('hidden');
    return;
  }

  let message;
  if (usedGrace) {
    message = `Jour de grâce utilisé — ta séquence continue : ${streakCount} jours !`;
  } else if (brokeStreak) {
    message = 'Nouvelle séquence — vas-y !';
  } else if (streakCount > 1) {
    message = `🔥 ${streakCount} jours d'affilée !`;
  } else {
    message = 'Premier jour de la séquence — bienvenue !';
  }

  streakBannerEl.textContent = message;
  streakBannerEl.classList.remove('hidden', 'fading');
  setTimeout(() => streakBannerEl.classList.add('fading'), 3500);
  setTimeout(() => streakBannerEl.classList.add('hidden'), 4000);
}

function updateAvatar(session) {
  // La barre du HUD reflète la section en cours ; le personnage, lui, représente
  // la maîtrise globale des 4 sections combinées.
  const { overallPercent } = session.getProgress();
  masteryFillEl.style.width = `${overallPercent}%`;

  const { overallPercent: combinedPercent } = computeAllOperationsProgress();
  const { tier, leveledUp } = checkTierUp(combinedPercent);
  runnerEl.classList.remove('tier-0', 'tier-1', 'tier-2', 'tier-3', 'tier-4');
  runnerEl.classList.add(`tier-${tier}`);

  if (leveledUp) {
    avatarBannerEl.textContent = `Ton personnage évolue ! (palier ${tier}/4)`;
    avatarBannerEl.classList.remove('hidden', 'fading');
    setTimeout(() => avatarBannerEl.classList.add('fading'), 3500);
    setTimeout(() => avatarBannerEl.classList.add('hidden'), 4000);
  }
}

// --- Boucle de jeu ---

function startRound() {
  if (!sectionActive) return;
  if (!session.hasNext()) {
    endSession();
    return;
  }
  currentRound = session.nextRound();
  promptEl.textContent = `${formatPrompt(currentRound.prompt)} = ?`;
  stageEl.classList.remove('flash-correct', 'flash-wrong');
  comboBadgeEl.classList.add('hidden');
  resetRunner();

  if (currentRound.hint) {
    hintEl.textContent = currentRound.hint;
    hintEl.classList.remove('hidden');
  } else {
    hintEl.classList.add('hidden');
  }

  if (currentRound.studyTimeMs) {
    beginStudyPhase();
  } else {
    beginAnswerPhase();
  }
}

function beginStudyPhase() {
  studying = true;
  resolved = true; // aucune réponse possible tant qu'on n'a pas quitté la phase d'étude
  choiceLeftEl.classList.add('hidden');
  choiceRightEl.classList.add('hidden');
  timerBarEl.classList.add('timer-study');
  studyCaptionEl.classList.remove('hidden');
  stageEl.addEventListener('click', skipStudyPhase);
  phaseStart = performance.now();
  tickStudyTimer();
}

function skipStudyPhase() {
  if (!studying) return;
  cancelAnimationFrame(timerRAF);
  endStudyPhase();
}

function endStudyPhase() {
  studying = false;
  stageEl.removeEventListener('click', skipStudyPhase);
  choiceLeftEl.classList.remove('hidden');
  choiceRightEl.classList.remove('hidden');
  timerBarEl.classList.remove('timer-study');
  studyCaptionEl.classList.add('hidden');
  beginAnswerPhase();
}

function tickStudyTimer() {
  if (!studying) return;
  const elapsed = performance.now() - phaseStart;
  const remaining = Math.max(0, currentRound.studyTimeMs - elapsed);
  timerFillEl.style.transform = `scaleX(${remaining / currentRound.studyTimeMs})`;
  if (remaining <= 0) {
    endStudyPhase();
    return;
  }
  timerRAF = requestAnimationFrame(tickStudyTimer);
}

function beginAnswerPhase() {
  choiceLeftEl.textContent = currentRound.choices[0];
  choiceRightEl.textContent = currentRound.choices[1];
  choiceLeftEl.className = 'choice choice-left';
  choiceRightEl.className = 'choice choice-right';
  phaseStart = performance.now();
  resolved = false;
  tickAnswerTimer();
}

function tickAnswerTimer() {
  if (resolved) return;
  const elapsed = performance.now() - phaseStart;
  const remaining = Math.max(0, currentRound.timeBudgetMs - elapsed);
  timerFillEl.style.transform = `scaleX(${remaining / currentRound.timeBudgetMs})`;
  if (remaining <= 0) {
    resolveRound(null);
    return;
  }
  timerRAF = requestAnimationFrame(tickAnswerTimer);
}

function resolveRound(chosenSide) {
  if (resolved) return;
  resolved = true;
  cancelAnimationFrame(timerRAF);
  unlockAudioOnce();

  const chosenEl = chosenSide === 'left' ? choiceLeftEl : chosenSide === 'right' ? choiceRightEl : null;
  const chosenValue = chosenEl ? currentRound.choices[chosenSide === 'left' ? 0 : 1] : null;
  const correct = chosenValue === currentRound.correctAnswer;

  const result = session.submitAnswer(correct);
  scoreEl.textContent = `${session.roundsCorrect} / ${session.roundsPlayed}`;
  pointsEl.textContent = `${session.points} pt`;
  updateAvatar(session);
  stageEl.classList.add(correct ? 'flash-correct' : 'flash-wrong');

  const correctSide = currentRound.choices[0] === currentRound.correctAnswer ? choiceLeftEl : choiceRightEl;
  correctSide.classList.add('choice-correct');

  const dashOffset = chosenEl ? runnerOffsetFor(chosenEl) : 0;
  dashTo(dashOffset, correct);
  setTimeout(() => triggerShake(correct), 180);

  if (correct) {
    playCorrect(result.multiplier);
    const rect = chosenEl.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (result.multiplier > 1) {
      comboBadgeEl.textContent = `Combo x${result.multiplier}`;
      comboBadgeEl.classList.remove('hidden');
    } else if (Math.random() < 0.25) {
      comboBadgeEl.textContent = HYPE_WORDS[Math.floor(Math.random() * HYPE_WORDS.length)];
      comboBadgeEl.classList.remove('hidden');
    }
  } else {
    playWrong();
    if (chosenEl) chosenEl.classList.add('choice-wrong');
  }

  setTimeout(() => {
    if (isPaused) {
      pendingStart = true;
      return;
    }
    startRound();
  }, 450);
}

function renderEndProgress(session) {
  const { byGroup } = session.getProgress();
  endProgressEl.innerHTML = '';
  for (const group of byGroup) {
    const row = document.createElement('div');
    row.className = 'progress-row';

    const label = document.createElement('div');
    label.className = 'progress-row-label';
    label.innerHTML = `<span>${group.label}</span><span>${group.masteredCount}/${group.total}</span>`;

    const bar = document.createElement('div');
    bar.className = 'progress-row-bar';
    const fill = document.createElement('div');
    fill.className = `progress-row-fill${group.percent >= 100 ? ' mastered' : ''}`;
    fill.style.width = `${group.percent}%`;
    bar.appendChild(fill);

    row.appendChild(label);
    row.appendChild(bar);
    endProgressEl.appendChild(row);
  }
}

function endSession() {
  stageEl.classList.add('hidden');
  endScreenEl.classList.remove('hidden');
  if (session.mode === 'diagnostic') {
    endStatsEl.textContent = `${session.roundsCorrect} faits déjà connus sur ${session.roundsPlayed} testés — ils ont été avancés dans ta progression !`;
    restartBtn.textContent = 'Refaire le test rapide';
  } else {
    endStatsEl.textContent = `${session.roundsCorrect} bonnes réponses sur ${session.roundsPlayed} — ${session.points} points. À demain !`;
    restartBtn.textContent = 'Rejouer cette section';
  }
  renderEndProgress(session);
}

choiceLeftEl.addEventListener('click', () => resolveRound('left'));
choiceRightEl.addEventListener('click', () => resolveRound('right'));
window.addEventListener('keydown', (e) => {
  if (isPaused) return;
  const key = e.key.toLowerCase();
  if (studying && (key === ' ' || key === 'enter')) {
    skipStudyPhase();
    return;
  }
  if (key === 'arrowleft' || key === 'f') resolveRound('left');
  if (key === 'arrowright' || key === 'j') resolveRound('right');
});

muteBtn.addEventListener('click', () => {
  unlockAudioOnce();
  const on = toggleMusic();
  muteBtn.classList.toggle('muted', !on);
});

pauseBtn.addEventListener('click', () => {
  if (!sectionActive || isPaused || !endScreenEl.classList.contains('hidden')) return;
  isPaused = true;
  pauseStart = performance.now();
  cancelAnimationFrame(timerRAF);
  session.pause();
  pauseOverlayEl.classList.remove('hidden');
});

resumeBtn.addEventListener('click', () => {
  if (!isPaused) return;
  const pausedDuration = performance.now() - pauseStart;
  phaseStart += pausedDuration;
  isPaused = false;
  session.resume();
  pauseOverlayEl.classList.add('hidden');

  if (pendingStart) {
    pendingStart = false;
    startRound();
  } else if (studying) {
    tickStudyTimer();
  } else if (!resolved) {
    tickAnswerTimer();
  }
});

restartBtn.addEventListener('click', () => {
  startSection(session.operation, { mode: session.mode });
});

showMenu();
