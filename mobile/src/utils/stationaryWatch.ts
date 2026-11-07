// ─── Détection d'arrêt prolongé (sécurité chauffeur) ────────────────────────
// Logique PURE (aucun timer, aucun accès réseau/GPS) : on lui pousse des
// positions horodatées via push(lat, lng, timestamp) et elle décide seule si
// le véhicule est immobile depuis trop longtemps.
//
// Règle métier : si TOUTES les positions des `alertAfterMs` dernières
// millisecondes (5 min par défaut) tiennent dans un rayon de
// `thresholdMeters` (60 m par défaut) ET que le chauffeur n'a PAS déclaré de
// pause, on déclenche `onAlert` UNE SEULE fois. Dès que le véhicule ressort
// du rayon, l'épisode est réinitialisé et l'alerte est ré-armée.
//
// Implémentation : on garde un point d'ancrage = première position de
// l'épisode d'immobilité courant. Chaque nouvelle position est comparée à
// l'ancre : si elle s'en éloigne de plus de thresholdMeters, le véhicule a
// bougé → nouvel épisode (ancre = position courante, alerte ré-armée).
// Sinon, l'épisode continue ; quand sa durée atteint alertAfterMs, l'alerte
// part (sauf pause déclarée).

export interface StationaryWatchOptions {
  /** Rayon (mètres) en-dessous duquel on considère le véhicule immobile. */
  thresholdMeters?: number;
  /** Durée d'immobilité (ms) avant déclenchement de l'alerte. */
  alertAfterMs?: number;
  /** Appelé UNE fois par épisode d'immobilité prolongée hors pause. */
  onAlert: () => void;
  /** Optionnel : appelé quand le véhicule rebouge après un épisode d'arrêt. */
  onMove?: () => void;
}

export interface StationaryWatch {
  /** Pousse une position horodatée (timestamp en ms epoch). */
  push(latitude: number, longitude: number, timestamp: number): void;
  /** Déclare / lève la pause chauffeur. En pause : aucune alerte. */
  setPaused(paused: boolean): void;
  /** Vrai si une pause est déclarée. */
  isPaused(): boolean;
  /** Durée (ms) de l'épisode d'immobilité courant, à l'instant `now`. */
  stationaryForMs(now: number): number;
  /** Vrai si l'alerte de l'épisode courant a déjà été déclenchée. */
  hasAlerted(): boolean;
  /** Réinitialise l'épisode courant (ex. après « Je vais bien »). */
  reset(): void;
}

/** Distance en mètres entre deux coordonnées (formule de haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // rayon terrestre moyen (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function createStationaryWatch(options: StationaryWatchOptions): StationaryWatch {
  const thresholdMeters = options.thresholdMeters ?? 60;
  const alertAfterMs = options.alertAfterMs ?? 5 * 60 * 1000;

  // Ancre de l'épisode d'immobilité courant (null = pas encore de position).
  let anchor: { latitude: number; longitude: number; timestamp: number } | null = null;
  let paused = false;
  let alerted = false;

  const resetEpisode = () => {
    anchor = null;
    alerted = false;
  };

  return {
    push(latitude: number, longitude: number, timestamp: number): void {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestamp)) {
        return; // position corrompue : on l'ignore
      }

      if (!anchor) {
        anchor = { latitude, longitude, timestamp };
        return;
      }

      // Horloge qui recule (changement d'heure, points hors ordre) :
      // on repart proprement plutôt que de produire des durées négatives.
      if (timestamp < anchor.timestamp) {
        anchor = { latitude, longitude, timestamp };
        alerted = false;
        return;
      }

      const moved = distanceMeters(anchor.latitude, anchor.longitude, latitude, longitude);
      if (moved > thresholdMeters) {
        // Le véhicule est sorti du rayon : nouvel épisode, alerte ré-armée.
        const wasStationary = alerted;
        anchor = { latitude, longitude, timestamp };
        alerted = false;
        if (wasStationary) options.onMove?.();
        return;
      }

      // Toujours dans le rayon : l'épisode continue.
      if (!paused && !alerted && timestamp - anchor.timestamp >= alertAfterMs) {
        alerted = true;
        options.onAlert();
      }
    },

    setPaused(next: boolean): void {
      if (paused === next) return;
      paused = next;
      // À la reprise après une pause légitime, on repart de zéro : le temps
      // passé en pause ne doit pas compter comme de l'immobilité suspecte.
      if (!next) resetEpisode();
    },

    isPaused(): boolean {
      return paused;
    },

    stationaryForMs(now: number): number {
      if (!anchor) return 0;
      return Math.max(0, now - anchor.timestamp);
    },

    hasAlerted(): boolean {
      return alerted;
    },

    reset(): void {
      resetEpisode();
    },
  };
}
