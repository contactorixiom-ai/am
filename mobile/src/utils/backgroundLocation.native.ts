// Suivi GPS en tâche de fond (application installée uniquement).
//
// `watchPositionAsync` ne relève la position que tant que l'application est
// au premier plan : dès que le convoyeur verrouille son téléphone, le suivi
// s'arrête. Sur un trajet Paris–Lisbonne, c'est inutilisable.
//
// On passe donc par une tâche enregistrée auprès du système, qui continue de
// tourner écran éteint. Cette tâche s'exécute HORS de React : elle ne peut
// lire ni l'état ni le contexte de l'application, et va donc chercher
// elle-même dans AsyncStorage le jeton d'authentification et la mission
// active.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { API_BASE_URL } from '../api/client';

export const LOCATION_TASK = 'axis-convoy-location';
/** Mission dont les positions doivent être transmises, lue par la tâche. */
const ACTIVE_MISSION_KEY = 'axis.activeMissionId';
const ACCESS_TOKEN_KEY = 'axis.accessToken';

interface RawFix {
  coords: {
    latitude: number; longitude: number; accuracy: number | null;
    speed: number | null; heading: number | null; altitude: number | null;
  };
  timestamp: number;
}

// Envoi direct, sans passer par apiFetch : la tâche de fond ne doit pas
// déclencher de rafraîchissement de jeton ni de navigation.
async function pushFix(missionId: string, token: string, fix: RawFix): Promise<void> {
  const { coords } = fix;
  await fetch(`${API_BASE_URL}/missions/${missionId}/gps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy != null && coords.accuracy >= 0 ? coords.accuracy : undefined,
      speedKmh: coords.speed != null && coords.speed >= 0 ? Math.round(coords.speed * 36) / 10 : undefined,
      heading: coords.heading != null && coords.heading >= 0 ? coords.heading : undefined,
      altitude: coords.altitude ?? undefined,
    }),
  });
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: RawFix[] } | undefined)?.locations;
  if (!locations?.length) return;

  const [missionId, token] = await Promise.all([
    AsyncStorage.getItem(ACTIVE_MISSION_KEY).catch(() => null),
    AsyncStorage.getItem(ACCESS_TOKEN_KEY).catch(() => null),
  ]);
  if (!missionId || !token) return;

  // Seule la dernière position compte : inutile de rejouer la file quand le
  // téléphone sort d'une zone blanche avec dix points d'avance.
  const last = locations[locations.length - 1];
  try {
    await pushFix(missionId, token, last);
  } catch {
    // Réseau coupé : le point suivant repartira. On n'interrompt jamais le
    // convoyeur pour un souci de réseau.
  }
});

export async function isBackgroundTrackingRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

export type BackgroundStart =
  | { ok: true }
  | { ok: false; reason: 'denied-foreground' | 'denied-background' | 'error' };

export async function startBackgroundTracking(missionId: string): Promise<BackgroundStart> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { ok: false, reason: 'denied-foreground' };

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return { ok: false, reason: 'denied-background' };

    await AsyncStorage.setItem(ACTIVE_MISSION_KEY, missionId);

    if (await isBackgroundTrackingRunning()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15000,
      distanceInterval: 50,
      // iOS : garde le suivi actif écran verrouillé et affiche l'indicateur
      // bleu, qu'Apple exige pour un suivi continu.
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      // Android : notification permanente, obligatoire pour un service de
      // localisation en premier plan depuis Android 8.
      foregroundService: {
        notificationTitle: 'Convoyage en cours',
        notificationBody: 'Axis Import partage ta position avec le client.',
        notificationColor: '#C9A55C',
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  try {
    if (await isBackgroundTrackingRunning()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    /* rien à arrêter */
  }
  await AsyncStorage.removeItem(ACTIVE_MISSION_KEY).catch(() => {});
}
