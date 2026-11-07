// Compteurs des pastilles rouges (notifications, messages non lus), partagés
// par l'accueil, le menu, la barre d'onglets et le profil. Relus toutes les
// 30 s tant que l'application est ouverte, et à la demande (après lecture).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Badges, getBadges } from '../api/messaging';

const EMPTY: Badges = { notifications: 0, messages: 0, conversations: 0 };
let current: Badges = EMPTY;
const listeners = new Set<(b: Badges) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;

export function refreshBadges(): Promise<void> {
  if (inflight) return inflight;
  inflight = getBadges()
    .then((b) => {
      current = { notifications: b.notifications ?? 0, messages: b.messages ?? 0, conversations: b.conversations ?? 0 };
      listeners.forEach((l) => l(current));
    })
    .catch(() => undefined)
    .finally(() => { inflight = null; });
  return inflight;
}

/** À la déconnexion : remet les pastilles à zéro. */
export function resetBadges() {
  current = EMPTY;
  listeners.forEach((l) => l(current));
}

export function useBadges(enabled = true): Badges {
  const [b, setB] = useState<Badges>(current);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setB);
    if (listeners.size === 1) {
      void refreshBadges();
      timer = setInterval(() => { if (AppState.currentState === 'active') void refreshBadges(); }, 30000);
    }
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refreshBadges(); });
    return () => {
      listeners.delete(setB);
      sub.remove();
      if (!listeners.size && timer) { clearInterval(timer); timer = null; }
    };
  }, [enabled]);
  return b;
}
