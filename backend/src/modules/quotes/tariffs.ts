// ─────────────────────────────────────────────────────────────────────
// GRILLE TARIFAIRE IMPORT-EXPORT AXIS
// France – Europe – Afrique subsaharienne (grille remise par Roger,
// octobre 2026). Source unique : l'app l'affiche telle quelle (écran
// « Nos tarifs ») et le devis est calculé ici, jamais sur le téléphone.
//
// Conventions :
//   - montants en cents, prix PAYÉS PAR LE CLIENT (TVA comprise) ;
//   - une fourchette (« 40 à 70 € ») est facturée à son prix de départ :
//     Axis confirme au dépôt selon la taille réelle et la destination ;
//   - orderable = commandable en ligne ; sinon « sur devis » (message à Axis).
// ─────────────────────────────────────────────────────────────────────

export type TariffSectionId = 'EFFECTS' | 'GENERAL' | 'VEHICLES' | 'AIR' | 'EXPORT';
export type TariffUnit = 'piece' | 'm3' | 'kg' | 'forfait';

export interface TariffItem {
  code: string;
  section: TariffSectionId;
  label: string;
  /** Précision sous le libellé (contenance, dimensions…). */
  detail?: string;
  unit: TariffUnit;
  /** Prix (ou prix de départ d'une fourchette) par unité, TTC. */
  minCents: number;
  /** Borne haute d'une fourchette, TTC. */
  maxCents?: number;
  /** Ce que comprend le prix, tel qu'indiqué sur la grille. */
  included?: string;
  /** Conseil ou condition (emballage, minimum…). */
  note?: string;
  /** Option de convoyage routier jusqu'au port, en cents par km. */
  convoyPerKmCents?: number;
  /** Commandable en ligne, et dans quel parcours. */
  orderable?: { service: 'PARCEL' | 'MERCHANDISE'; mode: 'SEA' };
  /** Prix « sur devis » (pas de montant). */
  onQuote?: boolean;
}

export interface TariffSection {
  id: TariffSectionId;
  title: string;
  subtitle?: string;
  mode: 'SEA' | 'AIR' | 'MIXED';
}

export const TARIFF_VERSION = '2026-10';

export const TARIFF_SECTIONS: TariffSection[] = [
  { id: 'EFFECTS', title: 'Effets personnels et petits volumes', subtitle: 'Particuliers et GP · maritime', mode: 'SEA' },
  { id: 'GENERAL', title: 'Marchandises générales, palettes et volume pro', subtitle: 'Maritime', mode: 'SEA' },
  { id: 'VEHICLES', title: 'Véhicules et roulants', subtitle: 'Expédition maritime RORO', mode: 'SEA' },
  { id: 'AIR', title: 'Fret aérien express', subtitle: 'Pour ce qui est urgent', mode: 'AIR' },
  { id: 'EXPORT', title: 'Export Afrique → Europe / France', subtitle: 'De l\'Afrique subsaharienne vers l\'Europe', mode: 'MIXED' },
];

const EFFECTS = { service: 'PARCEL', mode: 'SEA' } as const;
const GENERAL = { service: 'MERCHANDISE', mode: 'SEA' } as const;

export const TARIFF_ITEMS: TariffItem[] = [
  // 1 — Effets personnels (maritime)
  { code: 'DRUM_100', section: 'EFFECTS', label: 'Fût plastique', detail: 'jusqu\'à 100 L', unit: 'piece', minCents: 10000, included: 'Transport maritime + passage portuaire', orderable: EFFECTS },
  { code: 'DRUM_200', section: 'EFFECTS', label: 'Fût plastique', detail: '120 à 200 L', unit: 'piece', minCents: 13000, included: 'Transport maritime + passage portuaire', orderable: EFFECTS },
  { code: 'DRUM_220', section: 'EFFECTS', label: 'Fût plastique', detail: '220 L', unit: 'piece', minCents: 16000, included: 'Transport maritime + passage portuaire', orderable: EFFECTS },
  { code: 'CARTON', section: 'EFFECTS', label: 'Carton standard', unit: 'piece', minCents: 4000, maxCents: 7000, included: 'Transport maritime + manutention', orderable: EFFECTS },
  { code: 'BAG', section: 'EFFECTS', label: 'Sac de voyage / valise', detail: 'grand format', unit: 'piece', minCents: 6000, maxCents: 9000, included: 'Transport maritime', orderable: EFFECTS },
  { code: 'APPLIANCE', section: 'EFFECTS', label: 'Électroménager individuel', detail: 'frigo, TV', unit: 'piece', minCents: 14000, included: 'Transport maritime', orderable: EFFECTS },

  // 2 — Marchandises générales (maritime)
  { code: 'CBM', section: 'GENERAL', label: 'Marchandise au mètre cube', unit: 'm3', minCents: 18000, maxCents: 23000, orderable: GENERAL },
  { code: 'PALLET', section: 'GENERAL', label: 'Palette standard', detail: '120 × 100 × 150 cm', unit: 'piece', minCents: 23000, maxCents: 28000, orderable: GENERAL },

  // 3 — Véhicules (RORO) : sur devis dans l'app, prix affichés
  { code: 'RORO_CAR', section: 'VEHICLES', label: 'Voiture citadine / berline', unit: 'piece', minCents: 115000, maxCents: 130000, convoyPerKmCents: 75 },
  { code: 'RORO_SUV', section: 'VEHICLES', label: 'SUV / 4×4 / pick-up', unit: 'piece', minCents: 145000, maxCents: 178000, convoyPerKmCents: 100 },
  { code: 'RORO_VAN', section: 'VEHICLES', label: 'Utilitaire', detail: 'type Sprinter, Master · selon m³', unit: 'piece', minCents: 180000, maxCents: 230000, convoyPerKmCents: 140 },

  // 4 — Aérien express
  { code: 'AIR_KG', section: 'AIR', label: 'Petit colis', detail: 'toutes zones', unit: 'kg', minCents: 850 },
  { code: 'AIR_PRO', section: 'AIR', label: 'Expédition professionnelle', unit: 'forfait', minCents: 0, onQuote: true },

  // 5 — Export Afrique → Europe : sur devis dans l'app, prix affichés
  { code: 'EXPORT_FOOD_AIR', section: 'EXPORT', label: 'Fret aérien épicerie / épices', unit: 'kg', minCents: 850, maxCents: 1000, note: 'Produit sec uniquement. Minimum de perception : 30 kg.' },
  { code: 'EXPORT_CRAFT_SEA', section: 'EXPORT', label: 'Colis, artisanat / sculpture', detail: 'maritime groupage (LCL)', unit: 'm3', minCents: 23000, maxCents: 28000, note: 'Bon emballage nécessaire : caisse en bois aux normes NIMP-15.' },
  { code: 'EXPORT_SAMPLES_AIR', section: 'EXPORT', label: 'Échantillons pro aérien', detail: 'certificats inclus', unit: 'forfait', minCents: 12000, note: 'Forfait jusqu\'à 5 kg. Idéal pour les coopératives qui envoient cacao ou café à tester.' },
];

/** Frais de douane forfaitaires, ajoutés aux effets personnels (TTC). */
export const CUSTOMS_FEE_CENTS = 6500;
/** Minimum de perception : courrier, petit colis, premier m³ ou fraction (TTC). */
export const MINIMUM_CHARGE_CENTS = 9500;
/** Fret aérien express, petit colis toutes zones, au kg (TTC). */
export const AIR_PER_KG_CENTS = 850;

/** Mentions de la grille reprises telles quelles dans l'app. */
export const TARIFF_NOTES = {
  customs: '+65 € TTC de frais de douane à ajouter aux effets personnels.',
  extraVolume: '+30 % à 40 % pour tout volume additionnel.',
  minimum: 'Minimum de perception : 95 € (courrier, petit colis pro ou perso ; couvre le premier m³ ou fraction).',
  ranges: 'Les prix en fourchette dépendent de la taille et de la destination : le prix de départ est réglé à la commande, Axis confirme au dépôt.',
};

export function tariffItem(code: string): TariffItem | undefined {
  return TARIFF_ITEMS.find((t) => t.code === code);
}

// ─── Lignes d'un devis ──────────────────────────────────────────────

export interface TariffLineInput {
  code: string;
  quantity: number;
}

export interface TariffLine {
  code: string;
  label: string;
  quantity: number;
  unit: TariffUnit;
  /** Prix unitaire facturé (prix de départ si fourchette), TTC. */
  unitCents: number;
  /** Borne haute de la fourchette, si le prix peut être ajusté au dépôt. */
  maxUnitCents?: number;
  totalCents: number;
}

const MAX_PIECES = 50;
const MAX_M3 = 100;

function lineLabel(item: TariffItem): string {
  return item.detail ? `${item.label} (${item.detail})` : item.label;
}

/**
 * Valide les articles demandés pour un parcours et calcule leurs lignes.
 * Lève une erreur lisible si un article n'existe pas, n'est pas commandable
 * dans ce parcours, ou si la quantité est incohérente.
 */
export function priceTariffLines(
  service: 'PARCEL' | 'MERCHANDISE',
  inputs: TariffLineInput[],
): TariffLine[] {
  const merged = new Map<string, number>();
  for (const i of inputs) {
    const item = tariffItem(i.code);
    if (!item) throw new Error(`Article inconnu : ${i.code}`);
    if (!item.orderable || item.orderable.service !== service) {
      throw new Error(`« ${lineLabel(item)} » ne se commande pas dans ce parcours.`);
    }
    const q = Number(i.quantity);
    if (!Number.isFinite(q) || q <= 0) throw new Error(`Quantité invalide pour « ${lineLabel(item)} ».`);
    if (item.unit === 'piece' && !Number.isInteger(q)) {
      throw new Error(`« ${lineLabel(item)} » se compte à l'unité.`);
    }
    merged.set(item.code, (merged.get(item.code) ?? 0) + q);
  }
  const lines: TariffLine[] = [];
  for (const [code, rawQty] of merged) {
    const item = tariffItem(code) as TariffItem;
    const quantity = item.unit === 'm3' ? Math.round(rawQty * 100) / 100 : rawQty;
    if (item.unit === 'piece' && quantity > MAX_PIECES) {
      throw new Error(`Au-delà de ${MAX_PIECES} « ${lineLabel(item)} », demande un devis à Axis.`);
    }
    if (item.unit === 'm3' && quantity > MAX_M3) {
      throw new Error(`Au-delà de ${MAX_M3} m³, demande un devis à Axis.`);
    }
    lines.push({
      code,
      label: lineLabel(item),
      quantity,
      unit: item.unit,
      unitCents: item.minCents,
      maxUnitCents: item.maxCents,
      totalCents: Math.round(quantity * item.minCents),
    });
  }
  // Ordre de la grille, quel que soit l'ordre de saisie.
  const order = (c: string) => TARIFF_ITEMS.findIndex((t) => t.code === c);
  return lines.sort((a, b) => order(a.code) - order(b.code));
}

/** Grille publique servie à l'app (écran « Nos tarifs »). */
export function publicTariffSheet() {
  return {
    version: TARIFF_VERSION,
    currency: 'EUR',
    sections: TARIFF_SECTIONS,
    items: TARIFF_ITEMS,
    customsFeeCents: CUSTOMS_FEE_CENTS,
    minimumChargeCents: MINIMUM_CHARGE_CENTS,
    airPerKgCents: AIR_PER_KG_CENTS,
    notes: TARIFF_NOTES,
  };
}
