// Choix d'un fichier à envoyer (billet, justificatif, contrat…) : photo prise
// sur le moment, ou fichier existant (PDF, image) depuis le téléphone ou
// l'ordinateur. Rend une data URL prête pour /storage/upload.
import * as DocumentPicker from 'expo-document-picker';
import { capturePhoto } from './pickImage';
import { mimeOfDataUrl, extOfMime, uriToDataUrl } from './imageData';

export interface PickedFile {
  dataUrl: string;
  name: string;
  mimeType: string;
  size: number;
}

/** 10 Mo : au-delà, l'envoi en base64 dépasse la limite du serveur. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

function sizeOfDataUrl(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((b64.length * 3) / 4);
}

async function readUri(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Erreur lisible quand le fichier choisi ne peut pas partir. */
export class PickFileError extends Error {}

export async function pickFile(source: 'camera' | 'document'): Promise<PickedFile | null> {
  if (source === 'camera') {
    const uri = await capturePhoto();
    if (!uri) return null;
    const dataUrl = await uriToDataUrl(uri);
    if (!dataUrl) throw new PickFileError('Photo illisible. Réessaie.');
    const mimeType = mimeOfDataUrl(dataUrl);
    return { dataUrl, mimeType, name: `photo-${Date.now()}.${extOfMime(mimeType)}`, size: sizeOfDataUrl(dataUrl) };
  }
  const res = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (asset.size && asset.size > MAX_FILE_BYTES) {
    throw new PickFileError('Fichier trop lourd (10 Mo au plus). Prends plutôt une photo du document.');
  }
  const isImage = (asset.mimeType ?? '').startsWith('image/');
  const dataUrl = isImage ? await uriToDataUrl(asset.uri) : await readUri(asset.uri);
  if (!dataUrl) throw new PickFileError('Fichier illisible. Réessaie.');
  // Le type annoncé par certains navigateurs est vide : on le déduit du nom.
  let mimeType = asset.mimeType || mimeOfDataUrl(dataUrl);
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = /\.pdf$/i.test(asset.name) ? 'application/pdf' : mimeOfDataUrl(dataUrl);
  }
  if (!ACCEPTED.includes(mimeType.toLowerCase())) {
    throw new PickFileError('Format non accepté : envoie un PDF ou une photo (JPEG, PNG).');
  }
  const fixed = dataUrl.replace(/^data:[^;,]*/, `data:${mimeType}`);
  const size = sizeOfDataUrl(fixed);
  if (size > MAX_FILE_BYTES) throw new PickFileError('Fichier trop lourd (10 Mo au plus).');
  return { dataUrl: fixed, mimeType, name: asset.name || `document.${mimeType.includes('pdf') ? 'pdf' : 'jpg'}`, size };
}
