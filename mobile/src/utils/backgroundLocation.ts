// Version web : il n'existe pas de suivi en tâche de fond dans un navigateur.
// Le mode chauffeur retombe sur navigator.geolocation, qui s'interrompt dès
// que l'onglet passe en arrière-plan — d'où l'intérêt de l'app installée.

export const LOCATION_TASK = 'axis-convoy-location';

export type BackgroundStart =
  | { ok: true }
  | { ok: false; reason: 'denied-foreground' | 'denied-background' | 'error' | 'unsupported' };

export async function isBackgroundTrackingRunning(): Promise<boolean> {
  return false;
}

export async function startBackgroundTracking(_missionId: string): Promise<BackgroundStart> {
  return { ok: false, reason: 'unsupported' };
}

export async function stopBackgroundTracking(): Promise<void> {
  /* sans objet sur le web */
}
