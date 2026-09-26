// Vocabulaire partagé entre l'accueil, le suivi et le dossier d'envoi :
// un convoyage et un colis n'ont pas les mêmes statuts, mais le client veut
// lire la même chose — où en est mon envoi, et quand arrive-t-il.

import { MissionStatus, MissionSummary } from '../api/missions';
import { ParcelStatus, ParcelSummary } from '../api/parcels';

export type ShipmentKind = 'mission' | 'parcel';

export interface ShipmentView {
  kind: ShipmentKind;
  id: string;
  reference: string;
  from: string;
  to: string;
  /** Libellé court de l'étape en cours, lisible par le client. */
  step: string;
  /** Précision facultative sur l'étape (lieu du dernier scan, par exemple). */
  stepDetail: string | null;
  /** Avancement 0 → 1, déduit du statut (aucune donnée GPS n'est inventée). */
  progress: number;
  /** true tant que l'envoi est en cours (ni livré, ni annulé). */
  active: boolean;
  /** Date d'arrivée prévue (ou, à défaut, d'enlèvement), déjà formatée. */
  eta: string | null;
  /** Ce que désigne `eta` : l'arrivée n'est pas connue avant la prise en
   *  charge, on affichait la date d'enlèvement sous « Arrivée prévue ». */
  etaLabel: 'Arrivée prévue' | 'Enlèvement prévu';
  driverName: string | null;
  driverPhone: string | null;
  /** Identifiant du convoyeur affecté — sert à savoir si la mission est la sienne. */
  driverId: string | null;
  /** Nom du client donneur d'ordre — affiché côté convoyeur, jamais côté client. */
  clientName: string | null;
  vehicleLabel: string | null;
  distanceKm: number | null;
}

const MISSION_STEPS: Record<MissionStatus, { label: string; progress: number }> = {
  DRAFT: { label: 'Brouillon — à confirmer', progress: 0.04 },
  PUBLISHED: { label: 'En recherche de convoyeur', progress: 0.12 },
  ACCEPTED: { label: 'Convoyeur affecté', progress: 0.28 },
  IN_PROGRESS: { label: 'Véhicule en route', progress: 0.65 },
  DELIVERED: { label: 'Livré — en attente de clôture', progress: 0.92 },
  COMPLETED: { label: 'Mission terminée', progress: 1 },
  CANCELLED: { label: 'Annulé', progress: 0 },
  DISPUTED: { label: 'Litige en cours', progress: 0.65 },
};

const PARCEL_STEPS: Record<ParcelStatus, { label: string; progress: number }> = {
  DRAFT: { label: 'Brouillon — à confirmer', progress: 0.03 },
  AWAITING_DROP_OFF: { label: 'En attente de dépôt', progress: 0.1 },
  AWAITING_PICKUP: { label: 'Enlèvement programmé', progress: 0.15 },
  RECEIVED: { label: 'Colis réceptionné', progress: 0.3 },
  IN_TRANSIT: { label: 'En transit', progress: 0.55 },
  CUSTOMS: { label: 'En cours de dédouanement', progress: 0.75 },
  OUT_FOR_DELIVERY: { label: 'En cours de livraison', progress: 0.9 },
  DELIVERED: { label: 'Livré', progress: 1 },
  CANCELLED: { label: 'Annulé', progress: 0 },
  LOST: { label: 'Colis en recherche', progress: 0.55 },
};

const INACTIVE_MISSION: MissionStatus[] = ['DELIVERED', 'COMPLETED', 'CANCELLED'];
const INACTIVE_PARCEL: ParcelStatus[] = ['DELIVERED', 'CANCELLED'];

export function formatEta(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function missionView(m: MissionSummary): ShipmentView {
  const step = MISSION_STEPS[m.status] ?? { label: m.status, progress: 0.5 };
  const driver = m.driver ? `${m.driver.firstName} ${m.driver.lastName}`.trim() : null;
  return {
    kind: 'mission',
    id: m.id,
    reference: m.reference,
    from: m.pickupCity,
    to: m.deliveryCity,
    step: step.label,
    stepDetail: null,
    progress: step.progress,
    active: !INACTIVE_MISSION.includes(m.status),
    eta: formatEta(m.deliveryAt) ?? formatEta(m.pickupAt),
    etaLabel: formatEta(m.deliveryAt) ? 'Arrivée prévue' : 'Enlèvement prévu',
    driverName: driver,
    driverPhone: m.driver?.phone ?? null,
    driverId: m.driver?.id ?? null,
    clientName: m.client ? `${m.client.firstName} ${m.client.lastName}`.trim() || null : null,
    vehicleLabel: [`${m.vehicle.make} ${m.vehicle.model}`.trim(), m.vehicle.licensePlate]
      .filter(Boolean)
      .join(' · ') || null,
    distanceKm: m.distanceKm ?? null,
  };
}

export function parcelView(p: ParcelSummary): ShipmentView {
  const step = PARCEL_STEPS[p.status] ?? { label: p.status, progress: 0.5 };
  const last = p.trackingEvents?.length ? p.trackingEvents[p.trackingEvents.length - 1] : undefined;
  return {
    kind: 'parcel',
    id: p.id,
    reference: p.reference,
    from: p.originCity,
    to: [p.destinationCity, p.destinationCountry].filter(Boolean).join(', '),
    step: step.label,
    stepDetail: last?.location ?? null,
    progress: step.progress,
    active: !INACTIVE_PARCEL.includes(p.status),
    eta: formatEta(p.estimatedDelivery),
    etaLabel: 'Arrivée prévue',
    driverName: null,
    driverPhone: null,
    driverId: null,
    clientName: null,
    vehicleLabel: null,
    distanceKm: null,
  };
}

// Les envois en cours d'abord, du plus avancé au moins avancé : le client
// voit en tête ce qui bouge aujourd'hui.
export function sortForClient(views: ShipmentView[]): ShipmentView[] {
  return [...views].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.progress - a.progress;
  });
}
