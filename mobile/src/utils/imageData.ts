// Conversion d'une URI d'image (file://, blob:, http(s):, data:) en data URL,
// seule forme que sait envoyer /storage/upload. expo-image-picker rend une
// URI locale : sans cette étape, la photo ne quitte jamais le téléphone.

import { Platform } from 'react-native';

export async function uriToDataUrl(uri: string): Promise<string | null> {
  if (!uri) return null;
  try {
    let dataUrl: string | null = uri;
    if (!uri.startsWith('data:')) {
      const res = await fetch(uri);
      const blob = await res.blob();
      dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
    return dataUrl ? await shrinkForUpload(dataUrl) : null;
  } catch {
    return null;
  }
}

// Taille maximale du plus grand côté : largement lisible pour une pièce
// d'identité ou un défaut de carrosserie, sans envoyer 8 Mo par photo.
const MAX_SIDE = 2000;

/**
 * Navigateur : réduit une photo trop grande avant l'envoi. Sur téléphone,
 * l'appareil photo la compresse déjà (quality 0.6). Rend l'original si la
 * réduction n'apporte rien ou échoue.
 */
export async function shrinkForUpload(dataUrl: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return dataUrl;
  if (!/^data:image\/(jpeg|jpg|png|webp)/.test(dataUrl) || dataUrl.length < 700_000) return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', 0.8);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

/** Type MIME déduit d'une data URL, avec un repli raisonnable. */
export function mimeOfDataUrl(dataUrl: string): string {
  const m = /^data:([^;,]+)/.exec(dataUrl);
  return m?.[1] ?? 'image/jpeg';
}

/** Extension de fichier correspondant à un type MIME d'image. */
export function extOfMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';
  return 'jpg';
}
