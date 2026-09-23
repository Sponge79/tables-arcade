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

const promptEl = document.getElementById('prompt');
const choiceLeftEl = document.getElementById('choiceLeft');
const choiceRightEl = document.getElementById('choiceRight');
const timerFillEl = document.getElementById('timerFill');
const timerBarEl = document.getElementById('timerBar');
const scoreEl = document.getElementById('score');
const pointsEl = document.getElementById('points');
const comboBadgeEl = document.getElementById('comboBadge');
const hintEl = document.getElementById('hint');
const studyCaptionEl = document.getElementById('studyCaption');
const stageEl = document.getElementById('stage');
const endScreenEl = document.getElementById('endScreen');
const endStatsEl = document.getElementById('endStats');
const restartBtn = document.getElementById('restartBtn');
const muteBtn = document.getElementById('muteBtn');

initParticles();

let session = new Session();
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
  stageEl.classList.add(correct ? 'flash-correct' : 'flash-wrong');

  const correctSide = currentRound.choices[0] === currentRound.correctAnswer ? choiceLeftEl : choiceRightEl;
  correctSide.classList.add('choice-correct');

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

function endSession() {
  stageEl.classList.add('hidden');
  endScreenEl.classList.remove('hidden');
  endStatsEl.textContent = `${session.roundsCorrect} bonnes réponses sur ${session.roundsPlayed} — ${session.points} points. À demain !`;
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
  pointsEl.textContent = '0 pt';
  scoreEl.textContent = '0 / 0';
  startRound();
});

startRound();
