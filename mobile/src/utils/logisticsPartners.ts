// Partenaires logistiques tiers : Tronçon 1 (premier kilomètre).
// Le client voit le partenaire qui vient chercher son colis, mais une
// seule facture Axis (refacturation interne).
export type PartnerCarrier =
  | 'GEODIS' | 'DHL' | 'CHRONOPOST' | 'COLISSIMO' | 'DPD' | 'MONDIAL_RELAY' | 'UPS' | 'TNT';

export interface LogisticsPartner {
  carrier: PartnerCarrier;
  name: string;
  trackingNumber: string;
  phone: string;
  pickupEta: string; // ex "Aujourd'hui · 14h-18h"
  hub: string;       // ex "Hub Geodis Roissy"
  /** Couleur d'accent pour la card. */
  color: string;
}

export interface ParcelLeg {
  key: string;
  label: string;
  sub: string;
  state: 'done' | 'current' | 'pending';
  carrier?: PartnerCarrier;
}

// Choisit automatiquement un transporteur pour la démo en fonction du pays
// et du poids. À remplacer par un service d'orchestration côté backend en prod.
export function selectPartner(opts: { fromCountry?: string; weightKg?: number; toCountry?: string }): LogisticsPartner {
  const fr = (opts.fromCountry ?? 'FR').toUpperCase().startsWith('F');
  const heavy = (opts.weightKg ?? 0) > 30;
  // Heuristique simple — démo
  let carrier: PartnerCarrier;
  if (heavy && fr) carrier = 'GEODIS';
  else if (heavy) carrier = 'DHL';
  else if (fr) carrier = 'CHRONOPOST';
  else carrier = 'DPD';
  return partnerFor(carrier, opts.toCountry ?? 'SN');
}

function partnerFor(carrier: PartnerCarrier, toCountry: string): LogisticsPartner {
  const isAfrica = ['SN', 'CI', 'CM', 'BJ', 'TG', 'GA', 'CG', 'BF', 'ML'].includes(toCountry.toUpperCase());
  const port = isAfrica ? 'Marseille — Port autonome' : 'Le Havre';
  const hubByCarrier: Record<PartnerCarrier, string> = {
    GEODIS:        `Hub Geodis Roissy → ${port}`,
    DHL:           `DHL Express Paris CDG → ${port}`,
    CHRONOPOST:    `Centre Chronopost Wissous → ${port}`,
    COLISSIMO:     `Plateforme Colissimo Gonesse → ${port}`,
    DPD:           `Hub DPD Combs-la-Ville → ${port}`,
    MONDIAL_RELAY: `Entrepôt Mondial Relay Lille → ${port}`,
    UPS:           `UPS Worldport Lyon → ${port}`,
    TNT:           `Centre TNT Liège → ${port}`,
  };
  return {
    carrier,
    name: NAME[carrier],
    trackingNumber: genTracking(carrier),
    phone: PHONE[carrier],
    pickupEta: nextPickupWindow(),
    hub: hubByCarrier[carrier],
    color: COLOR[carrier],
  };
}

function genTracking(carrier: PartnerCarrier): string {
  const r = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  switch (carrier) {
    case 'CHRONOPOST': return `XX${r(11)}FR`;
    case 'DHL':        return `${r(10)}`;
    case 'GEODIS':     return `GE${r(10)}FR`;
    case 'COLISSIMO':  return `8R${r(11)}`;
    case 'DPD':        return `01250${r(9)}`;
    case 'MONDIAL_RELAY': return `${r(8)}MR`;
    case 'UPS':        return `1Z${r(15)}`;
    case 'TNT':        return `GE${r(9)}WW`;
  }
}

function nextPickupWindow(): string {
  // Démo : créneau "demain matin" ou "aujourd'hui" selon l'heure
  const h = new Date().getHours();
  if (h < 10) return 'Aujourd\'hui · 14h-18h';
  if (h < 16) return 'Demain · 09h-12h';
  return 'Demain · 14h-18h';
}

const NAME: Record<PartnerCarrier, string> = {
  GEODIS: 'Geodis',
  DHL: 'DHL Express',
  CHRONOPOST: 'Chronopost',
  COLISSIMO: 'Colissimo',
  DPD: 'DPD',
  MONDIAL_RELAY: 'Mondial Relay',
  UPS: 'UPS',
  TNT: 'TNT',
};

const PHONE: Record<PartnerCarrier, string> = {
  GEODIS: '0 825 04 13 13',
  DHL: '0 809 100 030',
  CHRONOPOST: '0 969 391 391',
  COLISSIMO: '3631',
  DPD: '0 825 070 070',
  MONDIAL_RELAY: '0 970 80 81 82',
  UPS: '0 821 233 877',
  TNT: '0 825 077 077',
};

const COLOR: Record<PartnerCarrier, string> = {
  GEODIS:        '#0A4F8A',
  DHL:           '#FFCC00',
  CHRONOPOST:    '#00A551',
  COLISSIMO:     '#F19F1B',
  DPD:           '#DC0032',
  MONDIAL_RELAY: '#D71E1C',
  UPS:           '#341B14',
  TNT:           '#FF6600',
};

// URL de suivi externe vers le site du transporteur.
export function trackingUrlFor(p: LogisticsPartner): string {
  const t = encodeURIComponent(p.trackingNumber);
  switch (p.carrier) {
    case 'CHRONOPOST': return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${t}`;
    case 'DHL':        return `https://www.dhl.com/fr-fr/home/tracking/tracking-parcel.html?tracking-id=${t}`;
    case 'GEODIS':     return `https://gw.geodis.com/tracking?refTracking=${t}`;
    case 'COLISSIMO':  return `https://www.laposte.fr/outils/suivre-vos-envois?code=${t}`;
    case 'DPD':        return `https://www.dpd.fr/tracex_${t}`;
    case 'MONDIAL_RELAY': return `https://www.mondialrelay.fr/suivi-de-colis?numeroExpedition=${t}`;
    case 'UPS':        return `https://www.ups.com/track?tracknum=${t}`;
    case 'TNT':        return `https://www.tnt.com/express/fr_fr/site/shipping-tools/tracking.html?searchType=con&cons=${t}`;
  }
}
