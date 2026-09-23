// Audio entièrement synthétisé (Web Audio API) : aucun fichier à charger,
// aucun pipeline de production — quelques oscillateurs, rien de plus.

let ctx = null;
let musicOn = true;
let musicStarted = false;
let nextStepTime = 0;
let stepIndex = 0;
let musicTimeoutId = null;

const BPM = 192;
const BEAT_SEC = 60 / BPM;
const STEP_SEC = BEAT_SEC / 4; // un pas = une double-croche
const STEPS_PER_BAR = 16;

const NOTES = {
  E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81,
  F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
};

function n(...names) {
  return names.map((name) => (name === null ? null : NOTES[name]));
}

// Basse : même progression Am–F–C–G, motif de croches qui bondit entre
// fondamentale / quinte / octave (formule réutilisée pour les 16 mesures).
const BASS_ROOTS = [
  { root: 'A2', fifth: 'E3', octave: 'A3' }, // Am
  { root: 'F2', fifth: 'C3', octave: 'F3' }, // F
  { root: 'C3', fifth: 'G3', octave: 'C4' }, // C
  { root: 'G2', fifth: 'D3', octave: 'G3' }, // G
];
const BASS_SHAPE = [0, null, 0, null, 2, null, 0, null, 1, null, 0, null, 2, 2, 1, null];

function buildBass({ root, fifth, octave }) {
  const table = { 0: NOTES[root], 1: NOTES[fifth], 2: NOTES[octave] };
  return BASS_SHAPE.map((degree) => (degree === null ? null : table[degree]));
}

// 16 mesures (4 passages sur Am–F–C–G) pour que la mélodie ne se répète pas trop
// vite : thème (1-4) → réponse décalée (5-8) → montée dense (9-12) → résolution
// qui redescend et laisse de l'air avant de reboucler (13-16).
const LEAD_BARS = [
  // Thème
  n('A4', null, 'C5', null, 'E5', null, 'A5', null, 'E5', null, 'C5', 'D5', 'E5', null, 'D5', null),
  n('F4', null, 'A4', 'C5', 'F5', null, 'C5', null, 'A4', null, 'C5', 'D5', 'C5', null, 'A4', null),
  n('E5', null, 'G5', 'A5', 'G5', null, 'E5', null, 'C5', null, 'E5', null, 'G5', 'B4', 'C5', null),
  n('G4', null, 'B4', null, 'D5', null, 'G5', null, 'D5', null, 'B4', 'A4', 'G4', null, null, null),
  // Réponse (entrée décalée, registre plus bas)
  n(null, null, 'E4', null, 'A4', null, 'C5', null, 'E4', null, 'A4', null, 'C5', 'D5', 'E4', null),
  n('C4', null, 'F4', null, 'A4', null, 'C5', null, 'A4', null, 'F4', null, 'A4', 'C5', 'F4', null),
  n('G4', null, 'C5', null, 'E5', null, 'G4', null, 'C5', null, 'E5', null, 'D5', null, 'C5', null),
  n(null, null, 'D4', null, 'G4', null, 'B4', null, 'D5', null, 'B4', null, 'G4', null, 'D4', null),
  // Montée (dense, registre plus haut, l'énergie "épique")
  n('E5', null, 'A5', 'G5', 'E5', null, 'C5', null, 'E5', 'G5', 'A5', null, 'E5', 'D5', 'C5', 'E5'),
  n('C5', null, 'F5', 'E5', 'C5', null, 'A4', null, 'C5', 'D5', 'F5', null, 'C5', 'A4', 'F4', 'A4'),
  n('E5', null, 'G5', 'A5', 'G5', null, 'E5', null, 'G5', 'A5', 'G5', null, 'E5', 'D5', 'C5', 'E5'),
  n('D5', null, 'G5', 'A5', 'G5', null, 'D5', null, 'B4', 'D5', 'G4', null, 'D4', 'G4', 'B4', 'D5'),
  // Résolution (redescend, plus aérée, ramène doucement vers le thème)
  n('A5', null, null, null, 'E5', null, null, null, 'C5', null, null, null, 'A4', null, 'E4', null),
  n('F5', null, null, null, 'C5', null, null, null, 'A4', null, null, null, 'F4', null, 'C4', null),
  n('E5', null, null, null, 'C5', null, null, null, 'G4', null, null, null, 'E4', null, 'C4', null),
  n('D5', null, 'B4', null, null, null, 'G4', null, null, null, 'D4', null, null, null, null, null),
];

// Les 16 mesures parcourent Am–F–C–G quatre fois (une fois par section ci-dessus).
const BAR_ROOTS_CYCLE = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
const BASS_BARS = BAR_ROOTS_CYCLE.map((i) => buildBass(BASS_ROOTS[i]));

function ensureContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, type, gainValue, startOffset = 0) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain).connect(audioCtx.destination);
  const start = audioCtx.currentTime + startOffset;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playCorrect(comboLevel = 1) {
  const pitch = 660 + Math.min(comboLevel, 4) * 40;
  tone(pitch, 0.09, 'triangle', 0.18);
  tone(pitch * 1.33, 0.12, 'triangle', 0.15, 0.06);
}

export function playWrong() {
  tone(160, 0.18, 'sawtooth', 0.15);
}

function kick(time) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.14);
}

function noiseBurst(time, gainValue, duration) {
  const audioCtx = ensureContext();
  const size = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = gainValue;
  noise.connect(gain).connect(audioCtx.destination);
  noise.start(time);
}

function hat(time) {
  noiseBurst(time, 0.045, 0.025);
}

function snare(time) {
  const audioCtx = ensureContext();
  noiseBurst(time, 0.16, 0.09);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 190;
  gain.gain.setValueAtTime(0.12, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.09);
}

function bassNote(time, freq) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.24, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
  osc.connect(filter).connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.17);
}

function leadNote(time, freq) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square'; // timbre chiptune/8-bit
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.09, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.14);
}

function scheduleMusic() {
  const audioCtx = ensureContext();
  if (musicOn) {
    while (nextStepTime < audioCtx.currentTime + 0.2) {
      const step = stepIndex % STEPS_PER_BAR;
      const bar = Math.floor(stepIndex / STEPS_PER_BAR) % LEAD_BARS.length;

      if (step === 0 || step === 8) kick(nextStepTime);
      if (step === 4 || step === 12) snare(nextStepTime);
      if (step % 4 === 2) hat(nextStepTime);

      const bassFreq = BASS_BARS[bar][step];
      if (bassFreq) bassNote(nextStepTime, bassFreq);
      const leadFreq = LEAD_BARS[bar][step];
      if (leadFreq) leadNote(nextStepTime, leadFreq);

      nextStepTime += STEP_SEC;
      stepIndex++;
    }
  }
  musicTimeoutId = setTimeout(scheduleMusic, 90);
}

// À appeler depuis un geste utilisateur (iPad bloque l'audio sans ça).
export function startMusic() {
  const audioCtx = ensureContext();
  if (musicStarted) return;
  musicStarted = true;
  nextStepTime = audioCtx.currentTime + 0.05;
  stepIndex = 0;
  scheduleMusic();
}

export function toggleMusic() {
  musicOn = !musicOn;
  return musicOn;
}

export function isMusicOn() {
  return musicOn;
}
