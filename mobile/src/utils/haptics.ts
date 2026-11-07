// Retour haptique discret (téléphone uniquement). Sans effet sur le web ou si
// le module natif est absent (ancienne version installée de l'application).
import { Platform } from 'react-native';

type HapticsModule = typeof import('expo-haptics');
let mod: HapticsModule | null | undefined;
function haptics(): HapticsModule | null {
  if (Platform.OS === 'web') return null;
  if (mod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mod = require('expo-haptics') as HapticsModule;
    } catch {
      mod = null;
    }
  }
  return mod;
}

/** Toucher d'un bouton. */
export function tapFeedback(): void {
  haptics()?.impactAsync(haptics()!.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Action réussie (paiement, PV, commande). */
export function successFeedback(): void {
  haptics()?.notificationAsync(haptics()!.NotificationFeedbackType.Success).catch(() => undefined);
}

/** Refus ou erreur. */
export function warningFeedback(): void {
  haptics()?.notificationAsync(haptics()!.NotificationFeedbackType.Warning).catch(() => undefined);
}
