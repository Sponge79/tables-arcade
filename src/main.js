// Boucle de jeu : un geste par round (choisir gauche ou droite), résultat immédiat,
// enchaînement sans coupure vers le round suivant. Aucune logique pédagogique ici —
// tout vient de Session (game/session.js).

import { Session } from './game/session.js';

const promptEl = document.getElementById('prompt');
const choiceLeftEl = document.getElementById('choiceLeft');
const choiceRightEl = document.getElementById('choiceRight');
const timerFillEl = document.getElementById('timerFill');
const scoreEl = document.getElementById('score');
const stageEl = document.getElementById('stage');
const endScreenEl = document.getElementById('endScreen');
const endStatsEl = document.getElementById('endStats');
const restartBtn = document.getElementById('restartBtn');

let session = new Session();
let currentRound = null;
let timerRAF = null;
let roundStart = 0;
let resolved = false;

function formatPrompt([a, op, b]) {
  return `${a} ${op} ${b}`;
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

  const chosenValue =
    chosenSide === 'left' ? currentRound.choices[0] : chosenSide === 'right' ? currentRound.choices[1] : null;
  const correct = chosenValue === currentRound.correctAnswer;

  session.submitAnswer(correct);
  scoreEl.textContent = `${session.roundsCorrect} / ${session.roundsPlayed}`;
  stageEl.classList.add(correct ? 'flash-correct' : 'flash-wrong');

  const correctSide = currentRound.choices[0] === currentRound.correctAnswer ? choiceLeftEl : choiceRightEl;
  correctSide.classList.add('choice-correct');
  if (!correct && chosenSide) {
    (chosenSide === 'left' ? choiceLeftEl : choiceRightEl).classList.add('choice-wrong');
  }

  setTimeout(startRound, 450);
}

function endSession() {
  stageEl.classList.add('hidden');
  endScreenEl.classList.remove('hidden');
  endStatsEl.textContent = `${session.roundsCorrect} bonnes réponses sur ${session.roundsPlayed}. À demain !`;
}

choiceLeftEl.addEventListener('click', () => resolveRound('left'));
choiceRightEl.addEventListener('click', () => resolveRound('right'));
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'arrowleft' || key === 'f') resolveRound('left');
  if (key === 'arrowright' || key === 'j') resolveRound('right');
});

restartBtn.addEventListener('click', () => {
  stageEl.classList.remove('hidden');
  endScreenEl.classList.add('hidden');
  session = new Session();
  startRound();
});

startRound();
