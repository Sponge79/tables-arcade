// Audio entièrement synthétisé (Web Audio API) : aucun fichier à charger,
// aucun pipeline de production — quelques oscillateurs, rien de plus.
// Plusieurs morceaux sélectionnables (voir TRACKS), chacun avec son tempo,
// son timbre et sa progression d'accords propres.

const TRACK_PREF_KEY = 'tables-arcade:musicTrack:v1';

let ctx = null;
let musicOn = true;
let musicStarted = false;
let nextStepTime = 0;
let stepIndex = 0;
let musicTimeoutId = null;
let stepSec = 0;
let currentTrackId = loadTrackPreference();

const STEPS_PER_BAR = 16;

const NOTES = {
  D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81,
  F3: 174.61, G3: 196.0, GS3: 207.65, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.0, GS4: 415.3, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
};

function n(...names) {
  return names.map((name) => (name === null ? null : NOTES[name]));
}

// Motif de basse générique : rebond fondamentale / quinte / octave, réutilisé
// par les 3 morceaux (seuls les accords et le tempo changent).
const BASS_SHAPE = [0, null, 0, null, 2, null, 0, null, 1, null, 0, null, 2, 2, 1, null];

function buildBass({ root, fifth, octave }) {
  const table = { 0: NOTES[root], 1: NOTES[fifth], 2: NOTES[octave] };
  return BASS_SHAPE.map((degree) => (degree === null ? null : table[degree]));
}

// --- Morceau 1 : Énergique (celui d'origine) — Am–F–C–G, carré/triangle, 192 BPM.
const ENERGIQUE_CHORDS = [
  { root: 'A2', fifth: 'E3', octave: 'A3' },
  { root: 'F2', fifth: 'C3', octave: 'F3' },
  { root: 'C3', fifth: 'G3', octave: 'C4' },
  { root: 'G2', fifth: 'D3', octave: 'G3' },
];
const ENERGIQUE_LEAD_BARS = [
  n('A4', null, 'C5', null, 'E5', null, 'A5', null, 'E5', null, 'C5', 'D5', 'E5', null, 'D5', null),
  n('F4', null, 'A4', 'C5', 'F5', null, 'C5', null, 'A4', null, 'C5', 'D5', 'C5', null, 'A4', null),
  n('E5', null, 'G5', 'A5', 'G5', null, 'E5', null, 'C5', null, 'E5', null, 'G5', 'B4', 'C5', null),
  n('G4', null, 'B4', null, 'D5', null, 'G5', null, 'D5', null, 'B4', 'A4', 'G4', null, null, null),
  n(null, null, 'E4', null, 'A4', null, 'C5', null, 'E4', null, 'A4', null, 'C5', 'D5', 'E4', null),
  n('C4', null, 'F4', null, 'A4', null, 'C5', null, 'A4', null, 'F4', null, 'A4', 'C5', 'F4', null),
  n('G4', null, 'C5', null, 'E5', null, 'G4', null, 'C5', null, 'E5', null, 'D5', null, 'C5', null),
  n(null, null, 'D4', null, 'G4', null, 'B4', null, 'D5', null, 'B4', null, 'G4', null, 'D4', null),
  n('E5', null, 'A5', 'G5', 'E5', null, 'C5', null, 'E5', 'G5', 'A5', null, 'E5', 'D5', 'C5', 'E5'),
  n('C5', null, 'F5', 'E5', 'C5', null, 'A4', null, 'C5', 'D5', 'F5', null, 'C5', 'A4', 'F4', 'A4'),
  n('E5', null, 'G5', 'A5', 'G5', null, 'E5', null, 'G5', 'A5', 'G5', null, 'E5', 'D5', 'C5', 'E5'),
  n('D5', null, 'G5', 'A5', 'G5', null, 'D5', null, 'B4', 'D5', 'G4', null, 'D4', 'G4', 'B4', 'D5'),
  n('A5', null, null, null, 'E5', null, null, null, 'C5', null, null, null, 'A4', null, 'E4', null),
  n('F5', null, null, null, 'C5', null, null, null, 'A4', null, null, null, 'F4', null, 'C4', null),
  n('E5', null, null, null, 'C5', null, null, null, 'G4', null, null, null, 'E4', null, 'C4', null),
  n('D5', null, 'B4', null, null, null, 'G4', null, null, null, 'D4', null, null, null, null, null),
];
const ENERGIQUE_CYCLE = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];

// --- Morceau 2 : Mystérieuse — Am–E–Am–Dm (mineur harmonique, sensible
// empruntée à E majeur), sinusoïdale, tempo modéré mais qui garde le mouvement.
const MYSTERIEUSE_CHORDS = [
  { root: 'A2', fifth: 'E3', octave: 'A3' }, // Am
  { root: 'E2', fifth: 'B2', octave: 'E3' }, // E (majeur emprunté)
  { root: 'D2', fifth: 'A2', octave: 'D3' }, // Dm
];
const MYSTERIEUSE_LEAD_BARS = [
  n('A4', null, null, null, 'E4', null, null, null, 'C4', null, null, null, 'E4', null, null, null),
  n('B4', null, null, null, 'GS4', null, null, null, 'E4', null, null, null, 'GS4', null, null, null),
  n('A4', null, null, null, 'C5', null, null, null, 'E4', null, null, null, 'A4', null, null, null),
  n('D4', null, null, null, 'F4', null, null, null, 'A4', null, null, null, 'F4', null, null, null),
  n('E4', null, 'A4', null, 'E4', null, null, null, 'C4', null, 'E4', null, 'A3', null, null, null),
  n('GS4', null, 'B4', null, 'GS4', null, null, null, 'E4', null, 'GS4', null, 'B3', null, null, null),
  n('C5', null, 'A4', null, 'E4', null, null, null, 'A4', null, 'C5', null, 'E4', null, null, null),
  n('F4', null, 'D4', null, 'A4', null, null, null, 'F4', null, 'D4', null, 'A3', null, null, null),
  n('A4', null, 'C5', null, 'E5', null, 'C5', null, 'A4', null, 'E4', null, 'C5', null, null, null),
  n('B4', null, 'GS4', null, 'B4', null, 'E5', null, 'GS4', null, 'B4', null, 'GS4', null, null, null),
  n('E5', null, 'C5', null, 'A4', null, 'E4', null, 'C5', null, 'A4', null, 'E4', null, null, null),
  n('A4', null, 'F4', null, 'D4', null, 'F4', null, 'A4', null, 'F4', null, 'D4', null, null, null),
];
const MYSTERIEUSE_CYCLE = [0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2];

// --- Morceau 3 : Épique — C–G–Am–F, carré/scie, tempo rapide, registre large.
const EPIQUE_CHORDS = [
  { root: 'C3', fifth: 'G3', octave: 'C4' },
  { root: 'G2', fifth: 'D3', octave: 'G3' },
  { root: 'A2', fifth: 'E3', octave: 'A3' },
  { root: 'F2', fifth: 'C3', octave: 'F3' },
];
const EPIQUE_LEAD_BARS = [
  n('C5', null, 'E5', null, 'G5', null, 'E5', null, 'C5', null, 'E5', null, 'G5', null, 'E5', null),
  n('G4', null, 'B4', null, 'D5', null, 'B4', null, 'G4', null, 'B4', null, 'D5', null, 'B4', null),
  n('A4', null, 'C5', null, 'E5', null, 'C5', null, 'A4', null, 'C5', null, 'E5', null, 'C5', null),
  n('F4', null, 'A4', null, 'C5', null, 'A4', null, 'F4', null, 'A4', null, 'C5', null, 'G4', null),
  n(null, null, 'C5', null, 'E5', null, 'G5', null, 'E5', null, 'C5', null, 'E5', null, 'G5', null),
  n(null, null, 'G4', null, 'B4', null, 'D5', null, 'B4', null, 'G4', null, 'B4', null, 'D5', null),
  n(null, null, 'A4', null, 'C5', null, 'E5', null, 'C5', null, 'A4', null, 'C5', null, 'E5', null),
  n(null, null, 'F4', null, 'A4', null, 'C5', null, 'A4', null, 'F4', null, 'A4', null, 'C5', null),
  n('G5', null, 'E5', 'G5', 'C5', null, 'E5', null, 'G5', null, 'E5', 'G5', 'C5', null, 'E5', null),
  n('D5', null, 'B4', 'D5', 'G4', null, 'B4', null, 'D5', null, 'B4', 'D5', 'G4', null, 'B4', null),
  n('E5', null, 'C5', 'E5', 'A4', null, 'C5', null, 'E5', null, 'C5', 'E5', 'A4', null, 'C5', null),
  n('C5', null, 'A4', 'C5', 'F4', null, 'A4', null, 'C5', null, 'A4', 'C5', 'F4', null, 'G4', null),
  n('C5', null, null, null, 'G4', null, null, null, 'E5', null, null, null, 'C5', null, null, null),
  n('G4', null, null, null, 'D4', null, null, null, 'B4', null, null, null, 'G4', null, null, null),
  n('A4', null, null, null, 'E4', null, null, null, 'C5', null, null, null, 'A4', null, null, null),
  n('F4', null, null, null, 'C4', null, null, null, 'A4', null, null, null, null, null, null, null),
];
const EPIQUE_CYCLE = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];

function buildTrack({ label, bpm, leadWave, bassWave, drums, chords, leadBars, cycle }) {
  return {
    label,
    bpm,
    leadWave,
    bassWave,
    drums,
    leadBars,
    bassBars: cycle.map((i) => buildBass(chords[i])),
  };
}

const TRACKS = {
  energique: buildTrack({
    label: 'Énergique',
    bpm: 192,
    leadWave: 'square',
    bassWave: 'triangle',
    drums: 'full',
    chords: ENERGIQUE_CHORDS,
    leadBars: ENERGIQUE_LEAD_BARS,
    cycle: ENERGIQUE_CYCLE,
  }),
  mysterieuse: buildTrack({
    label: 'Mystérieuse',
    bpm: 150,
    leadWave: 'sine',
    bassWave: 'triangle',
    drums: 'sparse',
    chords: MYSTERIEUSE_CHORDS,
    leadBars: MYSTERIEUSE_LEAD_BARS,
    cycle: MYSTERIEUSE_CYCLE,
  }),
  epique: buildTrack({
    label: 'Épique',
    bpm: 210,
    leadWave: 'square',
    bassWave: 'sawtooth',
    drums: 'full',
    chords: EPIQUE_CHORDS,
    leadBars: EPIQUE_LEAD_BARS,
    cycle: EPIQUE_CYCLE,
  }),
};

function loadTrackPreference() {
  try {
    return localStorage.getItem(TRACK_PREF_KEY) || 'energique';
  } catch {
    return 'energique';
  }
}

function saveTrackPreference(id) {
  try {
    localStorage.setItem(TRACK_PREF_KEY, id);
  } catch {
    // stockage indisponible : le choix ne survivra pas à la session, tant pis
  }
}

// loadTrackPreference() ci-dessus est appelée avant que TRACKS existe au tout
// premier chargement du module ; on revalide ici pour éviter un id invalide.
if (!TRACKS[currentTrackId]) currentTrackId = 'energique';

export function listTracks() {
  return Object.entries(TRACKS).map(([id, t]) => ({ id, label: t.label }));
}

export function getSelectedTrack() {
  return currentTrackId;
}

export function setTrack(id) {
  if (!TRACKS[id] || id === currentTrackId) return;
  currentTrackId = id;
  saveTrackPreference(id);
  stepSec = 60 / TRACKS[id].bpm / 4;
  if (musicStarted) {
    stepIndex = 0;
    const audioCtx = ensureContext();
    nextStepTime = audioCtx.currentTime + 0.05;
  }
}

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

function kick(time, gainMul = 1) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
  gain.gain.setValueAtTime(0.3 * gainMul, time);
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

function bassNote(time, freq, wave) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  osc.type = wave;
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

function leadNote(time, freq, wave) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = wave; // timbre du morceau sélectionné
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
  const track = TRACKS[currentTrackId];
  if (musicOn) {
    while (nextStepTime < audioCtx.currentTime + 0.2) {
      const step = stepIndex % STEPS_PER_BAR;
      const bar = Math.floor(stepIndex / STEPS_PER_BAR) % track.leadBars.length;

      if (track.drums === 'full') {
        if (step === 0 || step === 8) kick(nextStepTime);
        if (step === 4 || step === 12) snare(nextStepTime);
        if (step % 4 === 2) hat(nextStepTime);
      } else if (step === 0 || step === 8) {
        kick(nextStepTime, 0.6); // "sparse" : juste un battement discret, pas de charleston/caisse claire
      }

      const bassFreq = track.bassBars[bar][step];
      if (bassFreq) bassNote(nextStepTime, bassFreq, track.bassWave);
      const leadFreq = track.leadBars[bar][step];
      if (leadFreq) leadNote(nextStepTime, leadFreq, track.leadWave);

      nextStepTime += stepSec;
      stepIndex++;
    }
  }
  musicTimeoutId = setTimeout(scheduleMusic, 90);
}

// À appeler depuis un geste utilisateur (iPad bloque l'audio sans ça).
export function startMusic() {
  const audioCtx = ensureContext();
  stepSec = 60 / TRACKS[currentTrackId].bpm / 4;
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
