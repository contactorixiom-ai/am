import { Alert, Platform } from 'react-native';

// Alert.alert ne fonctionne PAS sur react-native-web (no-op silencieux), et
// window.alert / window.confirm peuvent être bloqués par le navigateur
// (« Empêcher cette page d'afficher d'autres boîtes de dialogue ») : confirm
// répond alors « Annuler » sans rien afficher. Sur le web, les messages
// passent donc par une fenêtre de l'application (DialogHost) ; window.* ne
// sert que de secours tant qu'elle n'est pas montée.

export interface DialogButton {
  label: string;
  kind?: 'primary' | 'danger' | 'cancel';
  onPress?: () => void;
}

export interface DialogRequest {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

type DialogListener = (req: DialogRequest) => void;
let listener: DialogListener | null = null;

/** Branché par DialogHost à son montage. */
export function setDialogListener(fn: DialogListener | null): void {
  listener = fn;
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (listener) {
      listener({ title, message, buttons: [{ label: 'OK', kind: 'primary' }] });
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
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
    if (listener) {
      listener({
        title,
        message,
        buttons: [
          { label: 'Annuler', kind: 'cancel' },
          { label: confirmLabel, kind: 'danger', onPress: onConfirm },
        ],
      });
      return;
    }
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

/** Question Oui / Non qui attend la réponse (web et téléphone). */
export function askYesNo(title: string, message: string, yes: string, no = 'Plus tard'): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      if (listener) {
        listener({
          title,
          message,
          buttons: [
            { label: no, kind: 'cancel', onPress: () => resolve(false) },
            { label: yes, kind: 'primary', onPress: () => resolve(true) },
          ],
        });
        return;
      }
      // eslint-disable-next-line no-alert
      resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
      return;
    }
    Alert.alert(title, message, [
      { text: no, style: 'cancel', onPress: () => resolve(false) },
      { text: yes, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
