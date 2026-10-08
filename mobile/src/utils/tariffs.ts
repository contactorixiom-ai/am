// Grille tarifaire import-export : chargement et mise en forme des prix.
// Les montants viennent de l'API (GET /quotes/tariffs) ; rien n'est recopié
// ici, pour que l'écran « Nos tarifs », le choix des articles et le devis
// affichent toujours les mêmes prix.
import { useEffect, useState } from 'react';
import { getTariffs, QuoteItemInput, TariffItem, TariffSheet } from '../api/quotes';

/** « 100 € », « 8,50 € » : décimales seulement quand il y en a. */
export function eurShort(cents: number): string {
  const v = cents / 100;
  return `${v.toLocaleString('fr-FR', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })} €`;
}

const UNIT_SUFFIX: Record<TariffItem['unit'], string> = {
  piece: '',
  m3: '/m³',
  kg: '/kg',
  forfait: '',
};

/** Prix tel qu'écrit sur la grille : « 130 € », « 40 à 70 € », « 180 à 230 €/m³ ». */
export function tariffPriceLabel(item: TariffItem): string {
  if (item.onQuote) return 'Sur devis';
  const suffix = UNIT_SUFFIX[item.unit];
  if (item.maxCents && item.maxCents > item.minCents) {
    const lo = (item.minCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: item.minCents % 100 ? 2 : 0 });
    return `${lo} à ${eurShort(item.maxCents)}${suffix}`;
  }
  return `${eurShort(item.minCents)}${suffix}`;
}

/** Libellé complet : « Fût plastique (120 à 200 L) ». */
export function tariffItemLabel(item: TariffItem): string {
  return item.detail ? `${item.label} (${item.detail})` : item.label;
}

/** Articles commandables en ligne dans un parcours. */
export function orderableItems(sheet: TariffSheet, service: 'PARCEL' | 'MERCHANDISE'): TariffItem[] {
  return sheet.items.filter((i) => i.orderable?.service === service);
}

/** Quantités saisies (code → quantité) → articles à envoyer au serveur. */
export function itemsFromCounts(counts: Record<string, number> | undefined): QuoteItemInput[] {
  if (!counts) return [];
  return Object.entries(counts)
    .filter(([, q]) => Number.isFinite(q) && q > 0)
    .map(([code, quantity]) => ({ code, quantity }));
}

/** « le fût », « la palette », « par véhicule » : l'unité telle que la grille la nomme. */
export function unitWordFor(code: string, unit: string): string {
  if (unit === 'm3') return 'le m³';
  if (unit === 'kg') return 'le kg';
  if (unit === 'forfait') return 'forfait';
  if (code.startsWith('RORO')) return 'par véhicule';
  if (code.startsWith('DRUM')) return 'le fût';
  if (code === 'CARTON') return 'le carton';
  if (code === 'PALLET') return 'la palette';
  return 'la pièce';
}

export function tariffUnitWord(item: TariffItem): string {
  return unitWordFor(item.code, item.unit);
}

const ITEM_EMOJI: Record<string, string> = {
  DRUM_100: '🛢️',
  DRUM_200: '🛢️',
  DRUM_220: '🛢️',
  CARTON: '📦',
  BAG: '🧳',
  APPLIANCE: '📺',
  CBM: '📐',
  PALLET: '🚛',
  RORO_CAR: '🚗',
  RORO_SUV: '🚙',
  RORO_VAN: '🚐',
  AIR_KG: '✈️',
  AIR_PRO: '🏢',
  EXPORT_FOOD_AIR: '🌶️',
  EXPORT_CRAFT_SEA: '🗿',
  EXPORT_SAMPLES_AIR: '☕',
};

export function tariffEmoji(code: string): string {
  return ITEM_EMOJI[code] ?? '📦';
}

/** Grille chargée une fois par session ; null tant qu'elle n'est pas là. */
export function useTariffs(): { sheet: TariffSheet | null; failed: boolean; reload: () => void } {
  const [sheet, setSheet] = useState<TariffSheet | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    getTariffs()
      .then((s) => alive && setSheet(s))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [attempt]);
  return { sheet, failed, reload: () => setAttempt((a) => a + 1) };
}
