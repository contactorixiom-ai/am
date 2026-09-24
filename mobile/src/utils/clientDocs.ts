// Contrats et factures du CLIENT, dérivés de ses envois réels.
// Partagé entre l'accueil (compteur « à signer ») et l'espace Documents.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MissionSummary } from '../api/missions';
import { ParcelSummary } from '../api/parcels';

export const CONTRACTS_KEY = 'axis.contracts.v1';
export const INVOICE_STORAGE_KEY = 'axis.docs.v1';

export interface ContractDoc {
  id: string;                    // identifiant de l'envoi d'origine
  title: string;
  ref: string;
  kind: 'mission' | 'parcel';
  reference: string;             // référence Axis imprimée sur le PDF
  route: string;
  vehicleLabel?: string;
  plate?: string;
  vehicleCategory?: string;
  driverName?: string;
  pickupDate?: string;
  signed: boolean;
  signedAt?: string;
  /** Image de la signature du client, relue du serveur. */
  signatureUrl?: string;
  /** Preuve émise par le serveur, imprimée sur le PDF. */
  proof?: { hash: string; signedAt: string; verifyUrl: string };
}

export interface Invoice {
  id: string;
  title: string;                 // n° de facture
  ref: string;                   // libellé de la prestation
  date: string;
  amountEur: number;
  paid: boolean;
  /** Envoi facturé — permet de rattacher le règlement au dossier côté serveur. */
  kind: 'mission' | 'parcel';
  shipmentId: string;
}

const fmtDate = (iso?: string | null): string =>
  iso && !Number.isNaN(new Date(iso).getTime())
    ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

// Le type de véhicule du serveur pilote la case cochée et le croquis du
// contrat. Les libellés doivent correspondre à VEHICLE_CATEGORIES (pdf.ts).
function vehicleCategoryLabel(type?: string | null): string | undefined {
  switch (type) {
    case 'CAR': return 'Berline';
    case 'SUV': return 'SUV';
    case 'VAN': return 'Utilitaire';
    case 'TRUCK': return 'Poids lourd';
    case 'MOTORCYCLE': return 'Moto';
    default: return undefined;
  }
}

// Un convoyage donne toujours lieu à un contrat ; un colis n'en a pas
// (le récépissé de dépôt tient lieu de preuve).
export function contractsFrom(missions: MissionSummary[]): ContractDoc[] {
  return missions
    .filter((m) => m.status !== 'CANCELLED')
    .map((m) => ({
      id: m.id,
      title: 'Contrat de convoyage',
      ref: `${m.pickupCity} → ${m.deliveryCity} · ${m.reference}`,
      kind: 'mission' as const,
      reference: m.reference,
      route: `${m.pickupCity} → ${m.deliveryCity}`,
      vehicleLabel: `${m.vehicle.make} ${m.vehicle.model}`.trim(),
      plate: m.vehicle.licensePlate,
      vehicleCategory: vehicleCategoryLabel(m.vehicle.type),
      driverName: m.driver ? `${m.driver.firstName} ${m.driver.lastName}`.trim() : undefined,
      pickupDate: m.pickupAt
        ? new Date(m.pickupAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : undefined,
      signed: false,
    }));
}

// Une facture n'existe que si un prix a été convenu : pas de montant inventé.
export function invoicesFrom(missions: MissionSummary[], parcels: ParcelSummary[]): Invoice[] {
  const fromMissions = missions
    .filter((m) => m.status !== 'CANCELLED' && (m.priceCents ?? 0) > 0)
    .map((m) => ({
      id: `m-${m.id}`,
      // Pas encore une facture : le numéro légal n'existe qu'une fois réglé.
      title: `Commande ${m.reference}`,
      ref: `Convoyage ${m.pickupCity} → ${m.deliveryCity}`,
      date: fmtDate(m.pickupAt),
      amountEur: (m.priceCents ?? 0) / 100, // au centime : arrondir à l'euro faisait payer 500 € au lieu de 499,56 €
      paid: false,
      kind: 'mission' as const,
      shipmentId: m.id,
    }));
  const fromParcels = parcels
    .filter((p) => p.status !== 'CANCELLED' && (p.priceCents ?? 0) > 0)
    .map((p) => ({
      id: `p-${p.id}`,
      title: `Commande ${p.reference}`,
      ref: `Envoi ${p.originCity} → ${p.destinationCity} · ${p.weightKg.toLocaleString('fr-FR')} kg`,
      date: fmtDate(p.createdAt),
      amountEur: (p.priceCents ?? 0) / 100,
      paid: false,
      kind: 'parcel' as const,
      shipmentId: p.id,
    }));
  return [...fromMissions, ...fromParcels];
}


export function safeParse<T>(raw: string | null): T {
  if (!raw) return {} as T;
  try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

// Nombre de contrats que le client doit encore signer (utilisé sur l'accueil).
export async function countContractsToSign(missions: MissionSummary[]): Promise<number> {
  const raw = await AsyncStorage.getItem(CONTRACTS_KEY).catch(() => null);
  const signed = safeParse<Record<string, { signed?: boolean }>>(raw);
  return contractsFrom(missions).filter((c) => !signed[c.id]?.signed).length;
}
