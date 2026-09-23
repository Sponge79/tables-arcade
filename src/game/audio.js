// Audio entièrement synthétisé (Web Audio API) : aucun fichier à charger,
// aucun pipeline de production — quelques oscillateurs, rien de plus.

let ctx = null;
let musicOn = true;
let musicStarted = false;
let nextStepTime = 0;
let stepIndex = 0;
let musicTimeoutId = null;

const BPM = 128;
const BEAT_SEC = 60 / BPM;
const STEP_SEC = BEAT_SEC / 4; // un pas = une double-croche
const STEPS_PER_BAR = 16;

// Enchaînement d'accords très commun en électro (i–VI–III–VII, ici Am–F–C–G) :
// une basse (note grave) + un petit motif arpégé par mesure, plutôt qu'un seul
// battement qui ne change jamais.
const CHORDS = [
  { bass: 110.0, arp: [220.0, 261.63, 329.63, 392.0] }, // Am : A2 | A3 C4 E4 G4
  { bass: 87.31, arp: [174.61, 220.0, 261.63, 349.23] }, // F  : F2 | F3 A3 C4 F4
  { bass: 130.81, arp: [261.63, 329.63, 392.0, 493.88] }, // C  : C3 | C4 E4 G4 B4
  { bass: 98.0, arp: [196.0, 246.94, 293.66, 392.0] }, // G  : G2 | G3 B3 D4 G4
];

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
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.16);
}

function hat(time) {
  const audioCtx = ensureContext();
  const size = Math.floor(audioCtx.sampleRate * 0.03);
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.05;
  noise.connect(gain).connect(audioCtx.destination);
  noise.start(time);
}

function bass(time, freq) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.22, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
  osc.connect(filter).connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.4);
}

function arpNote(time, freq) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.1, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.16);
}

function scheduleMusic() {
  const audioCtx = ensureContext();
  if (musicOn) {
    while (nextStepTime < audioCtx.currentTime + 0.2) {
      const step = stepIndex % STEPS_PER_BAR;
      const bar = Math.floor(stepIndex / STEPS_PER_BAR) % CHORDS.length;
      const chord = CHORDS[bar];

      if (step % 4 === 0) {
        kick(nextStepTime);
        arpNote(nextStepTime, chord.arp[step / 4]);
        if (step === 0) bass(nextStepTime, chord.bass);
      } else if (step % 4 === 2) {
        hat(nextStepTime);
      }

      nextStepTime += STEP_SEC;
      stepIndex++;
    }
  }
  musicTimeoutId = setTimeout(scheduleMusic, 100);
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
