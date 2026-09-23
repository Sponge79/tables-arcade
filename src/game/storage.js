// Un seul magasin de cartes Leitner, partagé par les 4 sections (les identifiants
// de famille sont préfixés par opération — mult-, div-, add-, sub- — donc aucune
// collision). Utilisé par Session, la vue parent, et le calcul de maîtrise globale.

const CARDS_STORAGE_KEY = 'tables-arcade:cards:v1';

export function loadAllCards() {
  try {
    const raw = localStorage.getItem(CARDS_STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

export function saveCard(familyId, card) {
  try {
    const all = loadAllCards();
    all.set(familyId, card);
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(Object.fromEntries(all)));
  } catch {
    // stockage indisponible (navigation privée, quota) : la session continue en mémoire seulement
  }
}

// Efface toute la progression (cartes, séquence, personnage) pour repartir à
// zéro — utilisé par le bouton "Recommencer à zéro" des réglages. Laisse
// volontairement intacte la préférence de musique : ce n'est pas de la
// progression, pas de raison de la perdre.
export function resetAllProgress() {
  try {
    localStorage.removeItem(CARDS_STORAGE_KEY);
    localStorage.removeItem('tables-arcade:streak:v1');
    localStorage.removeItem('tables-arcade:avatarTier:v1');
  } catch {
    // stockage indisponible : rien à effacer
  }
}
