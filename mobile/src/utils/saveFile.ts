// Enregistrement d'un fichier généré (PDF, CSV, JSON) depuis la version web.
//
// Sur ordinateur, <a download> suffit. Sur téléphone, et surtout sur iPhone
// quand l'appli est posée sur l'écran d'accueil (mode plein écran, sans barre
// de Safari), ce lien ouvre le fichier dans une vue d'où l'on ne revient pas
// toujours, ou ne fait rien. On ouvre donc la feuille de partage du téléphone
// (« Enregistrer dans Fichiers », WhatsApp, Mail…), et l'on retombe sur le
// téléchargement classique si elle n'est pas disponible.

function isTouchDevice(): boolean {
  try {
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Enregistre ou partage le fichier ; ne lève jamais. */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (isTouchDevice() && typeof navigator.share === 'function' && typeof File === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      // Partage annulé par l'utilisateur : rien d'autre à faire.
      if (e instanceof Error && e.name === 'AbortError') return;
      // Partage refusé (geste trop ancien, type non pris en charge) : on
      // retombe sur le téléchargement.
    }
  }
  anchorDownload(blob, filename);
}
