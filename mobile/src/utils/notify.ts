import { Alert, Platform } from 'react-native';

// Alert.alert ne fonctionne PAS sur react-native-web (no-op silencieux).
// Ce helper utilise window.alert/confirm sur le web et Alert.alert sur natif.
export function notify(title: string, message?: string): void {
  const text = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.alert) window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Confirmer',
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
