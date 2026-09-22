// Boucle de jeu : un geste par round (choisir gauche ou droite), résultat immédiat,
// enchaînement sans coupure vers le round suivant. Aucune logique pédagogique ici —
// tout vient de Session (game/session.js).

import { Session } from './game/session.js';
import { playCorrect, playWrong, startMusic, toggleMusic } from './game/audio.js';
import { initParticles, burst } from './game/particles.js';

const promptEl = document.getElementById('prompt');
const choiceLeftEl = document.getElementById('choiceLeft');
const choiceRightEl = document.getElementById('choiceRight');
const timerFillEl = document.getElementById('timerFill');
const scoreEl = document.getElementById('score');
const pointsEl = document.getElementById('points');
const comboBadgeEl = document.getElementById('comboBadge');
const hintEl = document.getElementById('hint');
const stageEl = document.getElementById('stage');
const endScreenEl = document.getElementById('endScreen');
const endStatsEl = document.getElementById('endStats');
const restartBtn = document.getElementById('restartBtn');
const muteBtn = document.getElementById('muteBtn');

initParticles();

let session = new Session();
let currentRound = null;
let timerRAF = null;
let roundStart = 0;
let resolved = false;
let audioUnlocked = false;

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
  resolved = true; // évite qu'un timer résiduel du round précédent se résolve pendant le setup
  currentRound = session.nextRound();
  promptEl.textContent = `${formatPrompt(currentRound.prompt)} = ?`;
  choiceLeftEl.textContent = currentRound.choices[0];
  choiceRightEl.textContent = currentRound.choices[1];
  choiceLeftEl.className = 'choice choice-left';
  choiceRightEl.className = 'choice choice-right';
  stageEl.classList.remove('flash-correct', 'flash-wrong');
  comboBadgeEl.classList.add('hidden');
  if (currentRound.hint) {
    hintEl.textContent = currentRound.hint;
    hintEl.classList.remove('hidden');
  } else {
    hintEl.classList.add('hidden');
  }
  roundStart = performance.now();
  resolved = false;
  tickTimer();
}

function tickTimer() {
  if (resolved) return;
  const elapsed = performance.now() - roundStart;
  const remaining = Math.max(0, currentRound.timeBudgetMs - elapsed);
  timerFillEl.style.transform = `scaleX(${remaining / currentRound.timeBudgetMs})`;
  if (remaining <= 0) {
    resolveRound(null);
    return;
  }
  timerRAF = requestAnimationFrame(tickTimer);
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
