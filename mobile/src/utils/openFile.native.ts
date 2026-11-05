// Ouverture d'un fichier protégé (billet, justificatif, contrat) — application
// installée : le fichier est copié sur le téléphone puis proposé à
// l'ouverture ou au partage (lecteur PDF, Fichiers, WhatsApp…).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { fetchProtectedBlob } from '../api/client';

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'document';
}

export async function openProtectedFile(url: string, fileName: string): Promise<boolean> {
  const blob = await fetchProtectedBlob(url);
  if (!blob) return false;
  const dataUrl = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
  if (!dataUrl) return false;
  const target = `${FileSystem.cacheDirectory}${Date.now()}-${safeName(fileName)}`;
  await FileSystem.writeAsStringAsync(target, dataUrl.slice(dataUrl.indexOf(',') + 1), {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, { mimeType: blob.type || undefined, dialogTitle: fileName });
  }
  return true;
}
