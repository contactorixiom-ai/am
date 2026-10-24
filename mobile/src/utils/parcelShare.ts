// Partage du suivi d'un colis : lien public (sans compte) vers le voyage du
// colis, envoyé au destinataire sur WhatsApp ou par la feuille de partage.
//
// La famille qui attend un colis à Dakar ou Abidjan n'a pas l'application :
// le lien ouvre directement la page de suivi par référence.
import { Linking, Platform, Share } from 'react-native';
import type { ParcelSummary } from '../api/parcels';
import { PUBLIC_APP_URL } from '../config/company';
import { notify } from './notify';

/** Lien public de suivi : …/app/?suivi=AXP-XXXX */
export function trackingLink(reference: string): string {
  let base = PUBLIC_APP_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    base = `${window.location.origin}${window.location.pathname}`;
  }
  return `${base}?suivi=${encodeURIComponent(reference)}`;
}

function contents(parcel: ParcelSummary): string {
  const items = (parcel.items ?? []).filter((i) => i.quantity > 0);
  if (!items.length) return 'un colis';
  return items.map((i) => `${i.quantity} × ${i.description}`).join(', ');
}

export function recipientMessage(parcel: ParcelSummary): string {
  const hello = parcel.recipientFirstName ? `Bonjour ${parcel.recipientFirstName},` : 'Bonjour,';
  const mode = parcel.transportMode === 'AIR' ? 'par avion' : 'par bateau';
  return [
    `${hello} je t'envoie ${contents(parcel)} ${mode}, de ${parcel.originCity} à ${parcel.destinationCity}, avec Axis Import.`,
    `Tu peux suivre son voyage ici : ${trackingLink(parcel.reference)}`,
    `Référence : ${parcel.reference}. Axis t'appellera pour organiser la remise.`,
  ].join('\n\n');
}

/** Ouvre WhatsApp sur la conversation du destinataire, message prêt. */
export async function whatsappRecipient(parcel: ParcelSummary): Promise<void> {
  const text = encodeURIComponent(recipientMessage(parcel));
  const digits = (parcel.recipientPhone ?? '').replace(/[^\d]/g, '').replace(/^00/, '');
  const url = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener');
      return;
    }
    await Linking.openURL(url);
  } catch {
    notify('WhatsApp indisponible', 'Copie la référence et envoie-la à ton destinataire.');
  }
}

/** Feuille de partage du téléphone (ou copie du lien sur ordinateur). */
export async function shareParcelTracking(parcel: ParcelSummary): Promise<void> {
  const message = recipientMessage(parcel);
  const url = trackingLink(parcel.reference);
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Suivi ${parcel.reference}`, text: message });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify('Lien copié', 'Colle-le dans un message pour ton destinataire.');
        return;
      }
      notify('Lien de suivi', url);
      return;
    }
    await Share.share({ message });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    notify('Lien de suivi', url);
  }
}
