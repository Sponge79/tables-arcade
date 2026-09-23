// Boucle de jeu : un geste par round (choisir gauche ou droite), résultat immédiat,
// enchaînement sans coupure vers le round suivant. Aucune logique pédagogique ici —
// tout vient de Session (game/session.js).
//
// Un round avec astuce se joue en deux temps : d'abord un temps d'étude calme, sans
// chrono de réponse ni choix affichés (juste lire/comprendre la stratégie), puis
// l'essai chronométré habituel — pour ne pas faire lire, réfléchir et courir contre
// la montre en même temps.

import { Session } from './game/session.js';
import { playCorrect, playWrong, startMusic, toggleMusic } from './game/audio.js';
import { initParticles, burst } from './game/particles.js';
import { initRunner, dashTo, resetRunner } from './game/runner.js';

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

function updateMasteryBar(session) {
  const { overallPercent } = session.getProgress();
  masteryFillEl.style.width = `${overallPercent}%`;
}

let session = new Session();
showStreak(session);
updateMasteryBar(session);
let currentRound = null;
let timerRAF = null;
let phaseStart = 0;
let resolved = false;
let audioUnlocked = false;
let studying = false;

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

function startRound() {
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
  updateMasteryBar(session);
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

  setTimeout(startRound, 450);
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
  endStatsEl.textContent = `${session.roundsCorrect} bonnes réponses sur ${session.roundsPlayed} — ${session.points} points. À demain !`;
  renderEndProgress(session);
}

choiceLeftEl.addEventListener('click', () => resolveRound('left'));
choiceRightEl.addEventListener('click', () => resolveRound('right'));
window.addEventListener('keydown', (e) => {
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

restartBtn.addEventListener('click', () => {
  stageEl.classList.remove('hidden');
  endScreenEl.classList.add('hidden');
  session = new Session();
  showStreak(session);
  pointsEl.textContent = '0 pt';
  scoreEl.textContent = '0 / 0';
  startRound();
});

startRound();
