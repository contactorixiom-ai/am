// Envoi via le service de notifications d'Expo : un seul appel HTTP couvre
// iOS (APNs) et Android (FCM), sans gérer soi-même les certificats Apple.
// https://docs.expo.dev/push-notifications/sending-notifications/

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  channelId?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

/** Envoie par lots de 100 (limite de l'API) et renvoie un ticket par message. */
export async function sendExpoPush(
  messages: ExpoPushMessage[],
  accessToken?: string,
): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Expo push ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    tickets.push(...(json.data ?? chunk.map(() => ({ status: 'error' as const }))));
  }
  return tickets;
}
