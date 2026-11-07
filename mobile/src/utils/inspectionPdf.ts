// Reprend les états des lieux enregistrés sur le serveur pour les imprimer sur
// le contrat PDF (kilométrage, carburant, observations, dommages placés sur la
// planche). Sans cela, le contrat téléchargé depuis « Documents » ou généré
// par Roger montrait un état des lieux vierge.

import { Inspection, listInspections } from '../api/inspections';
import type { PdfDamage } from './pdf';

type Quarter = 0 | 0.25 | 0.5 | 0.75 | 1;

const quarter = (pct?: number | null): Quarter | undefined =>
  pct == null ? undefined : (Math.round(Math.min(100, Math.max(0, pct)) / 25) / 4) as Quarter;

const dateFr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : undefined;
const timeFr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : undefined;

function side(i: Inspection | undefined) {
  if (!i) return {};
  return {
    km: i.mileage ?? undefined,
    fuel: quarter(i.fuelLevel),
    date: dateFr(i.createdAt),
    time: timeFr(i.createdAt),
    observations: i.damageNotes || i.generalNotes || undefined,
    damages: (i.damages ?? []).map((d) => ({ view: d.view, x: d.x, y: d.y, code: d.code, zone: d.zone })) as PdfDamage[],
    driverSigned: !!i.driverSignedAt,
    clientSigned: !!i.clientSignedAt,
    clientSignedDate: dateFr(i.clientSignedAt),
  };
}

export async function inspectionPdfFields(missionId?: string | null) {
  if (!missionId) return {};
  try {
    const list = await listInspections(missionId);
    const dep = side(list.find((i) => i.type === 'PRE_DEPARTURE'));
    const arr = side(list.find((i) => i.type === 'POST_DELIVERY'));
    return {
      departureKm: dep.km,
      departureFuel: dep.fuel,
      departureDate: dep.date,
      departureTime: dep.time,
      departureObservations: dep.observations,
      departureDamages: dep.damages,
      departureDriverSigned: dep.driverSigned,
      arrivalKm: arr.km,
      arrivalFuel: arr.fuel,
      arrivalDate: arr.date,
      arrivalTime: arr.time,
      arrivalObservations: arr.observations,
      arrivalDamages: arr.damages,
      arrivalDriverSigned: arr.driverSigned,
      arrivalClientSigned: arr.clientSigned,
      arrivalClientSignedDate: arr.clientSignedDate,
    };
  } catch {
    // Hors ligne : le contrat reste générable, sans l'état des lieux.
    return {};
  }
}
