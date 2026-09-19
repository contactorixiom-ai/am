// Relances : ce que Roger doit traiter aujourd'hui.
//
// Un colis qui n'avance plus ne se signale pas tout seul. Roger devait
// parcourir sa liste pour repérer celui bloqué en douane depuis huit jours.
// Ces règles le font à sa place, et remontent le motif — pas seulement le
// fait qu'il y ait un retard.

import { MissionSummary } from '../api/missions';
import { ParcelStatus, ParcelSummary } from '../api/parcels';

export type FollowUpLevel = 'urgent' | 'attention';

export interface FollowUp {
  kind: 'parcel' | 'mission';
  id: string;
  reference: string;
  route: string;
  level: FollowUpLevel;
  /** Ce qui cloche, en une phrase actionnable. */
  reason: string;
  /** Jours écoulés depuis le dernier mouvement, pour trier. */
  staleDays: number;
}

// Délai au-delà duquel une étape devient anormale. Calé sur le terrain :
// un colis en douane qui traîne coûte des frais de stockage chaque jour,
// un colis jamais déposé bloque une place au hub.
const PARCEL_LIMITS: Partial<Record<ParcelStatus, { days: number; label: string }>> = {
  AWAITING_DROP_OFF: { days: 4, label: 'jamais déposé par le client' },
  AWAITING_PICKUP: { days: 3, label: 'enlèvement non effectué' },
  RECEIVED: { days: 5, label: 'reçu au hub mais pas encore expédié' },
  IN_TRANSIT: { days: 21, label: 'en transit sans nouvelle étape' },
  CUSTOMS: { days: 5, label: 'bloqué en douane' },
  OUT_FOR_DELIVERY: { days: 3, label: 'en livraison sans confirmation' },
  LOST: { days: 0, label: 'colis en recherche' },
};

const DAY_MS = 24 * 3600 * 1000;

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/** Date du dernier mouvement : dernier événement, sinon création. */
function lastMovement(p: ParcelSummary): string | null {
  const events = p.trackingEvents;
  if (events?.length) {
    // La liste serveur ne renvoie que le dernier ; le détail les renvoie tous
    // dans l'ordre chronologique. On prend le plus récent dans les deux cas.
    return events.reduce((latest, e) => (e.occurredAt > latest ? e.occurredAt : latest), events[0].occurredAt);
  }
  return p.createdAt ?? null;
}

export function parcelFollowUp(p: ParcelSummary): FollowUp | null {
  if (p.status === 'DELIVERED' || p.status === 'CANCELLED') return null;

  const route = `${p.originCity} → ${p.destinationCity}`;
  const stale = daysSince(lastMovement(p)) ?? 0;

  // 1. Date d'arrivée dépassée : c'est le client qui va appeler.
  const lateDays = daysSince(p.estimatedDelivery);
  if (lateDays != null && lateDays > 0) {
    return {
      kind: 'parcel', id: p.id, reference: p.reference, route,
      level: 'urgent',
      reason: lateDays === 1
        ? 'arrivée prévue dépassée d\'un jour'
        : `arrivée prévue dépassée de ${lateDays} jours`,
      staleDays: Math.max(stale, lateDays),
    };
  }

  // 2. Étape figée trop longtemps.
  const limit = PARCEL_LIMITS[p.status];
  if (limit && stale >= limit.days) {
    return {
      kind: 'parcel', id: p.id, reference: p.reference, route,
      level: p.status === 'CUSTOMS' || p.status === 'LOST' ? 'urgent' : 'attention',
      reason: stale === 0 ? limit.label : `${limit.label} depuis ${stale} jours`,
      staleDays: stale,
    };
  }

  return null;
}

export function missionFollowUp(m: MissionSummary): FollowUp | null {
  const route = `${m.pickupCity} → ${m.deliveryCity}`;

  // Un convoyage sans convoyeur dont l'enlèvement approche : à affecter.
  if ((m.status === 'DRAFT' || m.status === 'PUBLISHED') && !m.driver) {
    const untilPickup = -(daysSince(m.pickupAt) ?? 0);
    if (untilPickup <= 2) {
      return {
        kind: 'mission', id: m.id, reference: m.reference, route,
        level: untilPickup < 0 ? 'urgent' : 'attention',
        reason: untilPickup < 0
          ? 'enlèvement dépassé, aucun convoyeur affecté'
          : 'enlèvement imminent, aucun convoyeur affecté',
        staleDays: Math.max(0, -untilPickup),
      };
    }
  }

  // Livré mais jamais clôturé : la facturation reste en attente.
  if (m.status === 'DELIVERED') {
    const stale = daysSince(m.deliveryAt) ?? 0;
    if (stale >= 3) {
      return {
        kind: 'mission', id: m.id, reference: m.reference, route,
        level: 'attention',
        reason: `livré depuis ${stale} jours, dossier non clôturé`,
        staleDays: stale,
      };
    }
  }

  return null;
}

/** Les plus urgentes d'abord, puis les plus anciennes. */
export function buildFollowUps(missions: MissionSummary[], parcels: ParcelSummary[]): FollowUp[] {
  const all = [
    ...parcels.map(parcelFollowUp),
    ...missions.map(missionFollowUp),
  ].filter((f): f is FollowUp => f !== null);

  return all.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'urgent' ? -1 : 1;
    return b.staleDays - a.staleDays;
  });
}
