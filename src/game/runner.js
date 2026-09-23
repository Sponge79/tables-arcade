// Petit personnage (forme CSS simple) qui donne une vraie sensation de mouvement
// à la boucle de jeu : il trottine sur place, bondit vers le côté choisi, atterrit
// (bonne réponse) ou trébuche (mauvaise réponse). Animation image par image via
// requestAnimationFrame, aucune bibliothèque, aucun asset.

let runnerEl;
let x = 0;
let y = 0;
let rotation = 0;
let scaleX = 1;
let scaleY = 1;
let bobPhase = 0;

let phase = 'idle'; // idle | dashing | landing | stumbling | settled
let animStart = 0;
let animDuration = 0;
let fromX = 0;
let toX = 0;
let landingCorrect = true;

function render() {
  runnerEl.style.transform =
    `translate(calc(-50% + ${x}px), ${y}px) rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
}

function loop(t) {
  if (phase === 'idle') {
    bobPhase += 0.12;
    y = Math.sin(bobPhase) * 4;
    x = 0;
    rotation = 0;
    scaleX = 1;
    scaleY = 1;
  } else if (phase === 'dashing') {
    const p = Math.min(1, (t - animStart) / animDuration);
    const eased = 1 - (1 - p) ** 3;
    x = fromX + (toX - fromX) * eased;
    y = -Math.sin(p * Math.PI) * 18;
    if (p >= 1) {
      phase = landingCorrect ? 'landing' : 'stumbling';
      animStart = t;
      animDuration = landingCorrect ? 220 : 380;
    }
  } else if (phase === 'landing') {
    const p = Math.min(1, (t - animStart) / animDuration);
    const squash = Math.sin(p * Math.PI);
    x = toX;
    y = 0;
    scaleY = 1 - squash * 0.35;
    scaleX = 1 + squash * 0.25;
    if (p >= 1) {
      phase = 'settled';
      scaleX = 1;
      scaleY = 1;
    }
  } else if (phase === 'stumbling') {
    const p = Math.min(1, (t - animStart) / animDuration);
    x = toX;
    rotation = Math.sin(p * Math.PI * 1.5) * 35 * (1 - p);
    y = Math.abs(Math.sin(p * Math.PI)) * 6;
    if (p >= 1) {
      phase = 'settled';
      rotation = 0;
      y = 0;
    }
  }
  // 'settled' : reste immobile jusqu'au prochain resetRunner()/dashTo()

  render();
  requestAnimationFrame(loop);
}

export function initRunner(el) {
  runnerEl = el;
  requestAnimationFrame(loop);
}

export function dashTo(offsetX, correct, duration = 180) {
  fromX = x;
  toX = offsetX;
  landingCorrect = correct;
  phase = 'dashing';
  animStart = performance.now();
  animDuration = duration;
}

export function resetRunner() {
  phase = 'idle';
  bobPhase = 0;
}
