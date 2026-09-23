// Palier visuel du personnage, dérivé directement du % de maîtrise réelle
// (engine/progress.js) — jamais un déblocage à l'ancienneté ou à l'XP.

const AVATAR_KEY = 'tables-arcade:avatarTier:v1';

export function tierForPercent(percent) {
  if (percent >= 80) return 4;
  if (percent >= 60) return 3;
  if (percent >= 40) return 2;
  if (percent >= 20) return 1;
  return 0;
}

// Compare au dernier palier connu (persisté) pour savoir si le personnage
// vient d'évoluer depuis la dernière fois — sert à afficher un moment de
// célébration une seule fois, pas à chaque round.
export function checkTierUp(percent) {
  const tier = tierForPercent(percent);
  let previous = 0;
  try {
    previous = Number(localStorage.getItem(AVATAR_KEY)) || 0;
  } catch {
    previous = 0;
  }
  const leveledUp = tier > previous;
  try {
    localStorage.setItem(AVATAR_KEY, String(tier));
  } catch {
    // stockage indisponible : l'évolution ne sera simplement pas mémorisée
  }
  return { tier, leveledUp };
}
