// Notifications push (iOS / Android) via le service d'Expo.
//
// Le serveur enregistrait les notifications mais n'en envoyait aucune :
// le client ne savait pas que son véhicule était parti ou arrivé tant qu'il
// n'ouvrait pas l'application. Ici, l'appareil demande l'autorisation,
// obtient son jeton et le confie au serveur.
//
// Limites connues :
// - le web n'est pas concerné (pas de jeton Expo) ;
// - Expo Go sur Android ne reçoit plus de push depuis le SDK 53 : il faut
//   une version installée (eas build) ;
// - il faut un projectId EAS (créé par le premier `eas build`) et, pour
//   Android, la clé FCM déposée sur expo.dev.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from '../api/client';

const TOKEN_KEY = 'axis.pushToken';

if (Platform.OS !== 'web') {
  // Application ouverte : la notification s'affiche quand même en bannière.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

/**
 * Demande l'autorisation puis enregistre l'appareil. Ne lève jamais : une
 * notification manquée ne doit pas empêcher d'utiliser l'application.
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Suivi des transports',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#C9A55C',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const id = projectId();
    if (!id) {
      console.warn('[push] projectId EAS absent : lancez `eas init` ou un premier `eas build`.');
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await apiFetch('/notifications/push-token', {
      method: 'POST',
      body: {
        token,
        platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        deviceId: Device.modelName ?? undefined,
      },
    });
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => undefined);
    return token;
  } catch (e) {
    console.warn('[push] enregistrement impossible :', e instanceof Error ? e.message : e);
    return null;
  }
}

/** À la déconnexion : cet appareil ne reçoit plus les notifications du compte. */
export async function unregisterPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await apiFetch('/notifications/push-token', { method: 'DELETE', body: { token } });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* le serveur l'oubliera de lui-même si l'appareil n'existe plus */
  }
}

/** Écoute les appuis sur une notification ; renvoie la fonction d'arrêt. */
export function onNotificationTap(handler: (data: Record<string, unknown>) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler((response.notification.request.content.data ?? {}) as Record<string, unknown>);
  });
  // Application lancée par l'appui sur une notification.
  Notifications.getLastNotificationResponseAsync()
    .then((r) => r && handler((r.notification.request.content.data ?? {}) as Record<string, unknown>))
    .catch(() => undefined);
  return () => sub.remove();
}
