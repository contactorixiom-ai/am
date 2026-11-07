// Ouverture d'un fichier protégé (billet, justificatif, contrat) — version web :
// téléchargement, ou feuille de partage sur téléphone.
import { fetchProtectedBlob } from '../api/client';
import { saveBlob } from './saveFile';

export async function openProtectedFile(url: string, fileName: string): Promise<boolean> {
  const blob = await fetchProtectedBlob(url);
  if (!blob) return false;
  await saveBlob(blob, fileName);
  return true;
}
