// Capture / sélection de photo — compatible web et natif (Expo).
// Sur natif on tente l'appareil photo (preuve horodatée de l'état du véhicule
// ou du colis) ; sur web ou si la caméra est refusée, on ouvre le sélecteur
// d'image du navigateur. Renvoie l'URI de l'image, ou null si annulé/erreur.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const IMAGES = ImagePicker.MediaTypeOptions.Images;

export async function capturePhoto(): Promise<string | null> {
  try {
    // Natif : on privilégie l'appareil photo pour une vraie prise sur le terrain.
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.granted) {
        const res = await ImagePicker.launchCameraAsync({
          quality: 0.6,
          mediaTypes: IMAGES,
          allowsEditing: false,
        });
        if (!res.canceled && res.assets?.length) return res.assets[0].uri;
        return null;
      }
    }
    // Web ou permission caméra refusée → sélecteur d'image.
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      mediaTypes: IMAGES,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets?.length) return res.assets[0].uri;
    return null;
  } catch {
    return null;
  }
}

/** Photo de profil : appareil photo ou galerie, recadrée au carré. */
export async function pickSquarePhoto(source: 'camera' | 'library'): Promise<string | null> {
  try {
    const opts = { quality: 0.5, mediaTypes: IMAGES, allowsEditing: Platform.OS !== 'web', aspect: [1, 1] as [number, number] };
    if (source === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.granted) {
        const res = await ImagePicker.launchCameraAsync(opts);
        return !res.canceled && res.assets?.length ? res.assets[0].uri : null;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync(opts);
    return !res.canceled && res.assets?.length ? res.assets[0].uri : null;
  } catch {
    return null;
  }
}
