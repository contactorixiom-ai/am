// Géolocalisation native (expo-location), chargée dynamiquement.
//
// Sur le web, `navigator.geolocation` suffit — mais il s'arrête dès que
// l'écran se verrouille. Sur une vraie application installée, expo-location
// tient le suivi en tâche de fond pendant tout le convoyage.
//
// Le module est requis dynamiquement : la version web, où il n'existe pas,
// continue de fonctionner exactement comme avant.

import { Platform } from 'react-native';

export interface NativeFix {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speedKmh?: number;
  heading?: number;
  altitude?: number;
  timestamp: number;
}

export type NativeStop = () => void;

interface ExpoLocationModule {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  requestBackgroundPermissionsAsync: () => Promise<{ status: string }>;
  watchPositionAsync: (
    options: Record<string, unknown>,
    cb: (p: {
      coords: {
        latitude: number; longitude: number; accuracy: number | null;
        speed: number | null; heading: number | null; altitude: number | null;
      };
      timestamp: number;
    }) => void,
  ) => Promise<{ remove: () => void }>;
  Accuracy: { High: number };
}

function loadModule(): ExpoLocationModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('expo-location') as ExpoLocationModule;
  } catch {
    return null;
  }
}

export function hasNativeLocation(): boolean {
  return loadModule() !== null;
}

export type NativeStartResult =
  | { ok: true; stop: NativeStop; background: boolean }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error' };

/**
 * Démarre le suivi natif. `background: true` signifie que la position
 * continuera d'être relevée écran verrouillé — c'est le cas qui compte pour
 * un convoyage de plusieurs heures.
 */
export async function startNativeWatch(
  onFix: (fix: NativeFix) => void,
): Promise<NativeStartResult> {
  const Location = loadModule();
  if (!Location) return { ok: false, reason: 'unavailable' };

  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { ok: false, reason: 'denied' };

    // L'autorisation « toujours » est un bonus : refusée, le suivi marche
    // quand même tant que l'app est au premier plan.
    let background = false;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      background = bg.status === 'granted';
    } catch {
      background = false;
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 25,
      },
      (p) => {
        onFix({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? undefined,
          // expo-location renvoie des m/s (−1 si inconnu) → km/h
          speedKmh: p.coords.speed !== null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : undefined,
          heading: p.coords.heading !== null && p.coords.heading >= 0 ? p.coords.heading : undefined,
          altitude: p.coords.altitude ?? undefined,
          timestamp: p.timestamp || Date.now(),
        });
      },
    );

    return { ok: true, stop: () => sub.remove(), background };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
