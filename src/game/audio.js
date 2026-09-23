// Sons courts (bonne/mauvaise réponse) synthétisés en Web Audio — aucun fichier,
// aucun pipeline. La musique de fond, elle, vient de vrais fichiers MP3 (licence
// royalty-free, voir assets/music/) plutôt que d'une composition synthétisée :
// après deux tentatives jugées ratées, on est passé à de la vraie musique.

const TRACK_PREF_KEY = 'tables-arcade:musicTrack:v1';
const DEFAULT_TRACK_ID = 'track11';

const TRACKS = {
  track01: { label: 'Pixel Vanguard', file: 'assets/music/track01.mp3' },
  track02: { label: 'Neon Ambush', file: 'assets/music/track02.mp3' },
  track04: { label: 'Circuit Clash', file: 'assets/music/track04.mp3' },
  track09: { label: 'Rival at Zero HP', file: 'assets/music/track09.mp3' },
  track10: { label: 'Titan Core Meltdown', file: 'assets/music/track10.mp3' },
  track11: { label: 'Last Continue', file: 'assets/music/track11.mp3' },
};

let ctx = null;
let musicOn = true;
let musicStarted = false;
let currentTrackId = loadTrackPreference();
let audioEl = null;

function loadTrackPreference() {
  try {
    const saved = localStorage.getItem(TRACK_PREF_KEY);
    return saved && TRACKS[saved] ? saved : DEFAULT_TRACK_ID;
  } catch {
    return DEFAULT_TRACK_ID;
  }
}

function saveTrackPreference(id) {
  try {
    localStorage.setItem(TRACK_PREF_KEY, id);
  } catch {
    // stockage indisponible : le choix ne survivra pas à la session, tant pis
  }
}

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
  if (audioEl) {
    audioEl.src = TRACKS[id].file;
    if (musicStarted && musicOn) audioEl.play().catch(() => {});
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

// À appeler depuis un geste utilisateur (iPad bloque la lecture audio sans ça).
export function startMusic() {
  ensureContext();
  if (musicStarted) return;
  musicStarted = true;
  audioEl = new Audio(TRACKS[currentTrackId].file);
  audioEl.loop = true;
  audioEl.volume = 0.5;
  if (musicOn) audioEl.play().catch(() => {});
}

export function toggleMusic() {
  musicOn = !musicOn;
  if (audioEl) {
    if (musicOn) audioEl.play().catch(() => {});
    else audioEl.pause();
  }
  return musicOn;
}

export function isMusicOn() {
  return musicOn;
}
