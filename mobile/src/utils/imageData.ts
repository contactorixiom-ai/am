// Conversion d'une URI d'image (file://, blob:, http(s):, data:) en data URL,
// seule forme que sait envoyer /storage/upload. expo-image-picker rend une
// URI locale : sans cette étape, la photo ne quitte jamais le téléphone.

export async function uriToDataUrl(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;
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
