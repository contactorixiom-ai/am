import React from 'react';
import { Pill, PillTone } from './Pill';

type MissionStatus =
  | 'DRAFT' | 'PUBLISHED' | 'ACCEPTED' | 'IN_PROGRESS'
  | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

type ParcelStatus =
  | 'DRAFT' | 'AWAITING_DROP_OFF' | 'RECEIVED' | 'IN_TRANSIT'
  | 'CUSTOMS' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'LOST';

const STATUS_MAP: Record<string, { label: string; tone: PillTone }> = {
  // Missions
  DRAFT:        { label: 'Brouillon',     tone: 'default' },
  PUBLISHED:    { label: 'Publiée',       tone: 'navy' },
  ACCEPTED:     { label: 'Acceptée',      tone: 'gold' },
  IN_PROGRESS:  { label: 'En route',      tone: 'good' },
  DELIVERED:    { label: 'Livrée',        tone: 'good' },
  COMPLETED:    { label: 'Terminée',      tone: 'good' },
  CANCELLED:    { label: 'Annulée',       tone: 'bad' },
  DISPUTED:     { label: 'Litige',        tone: 'warn' },
  // Parcels
  AWAITING_DROP_OFF: { label: 'À déposer',     tone: 'default' },
  RECEIVED:          { label: 'Reçu',          tone: 'navy' },
  IN_TRANSIT:        { label: 'En transit',    tone: 'good' },
  CUSTOMS:           { label: 'Douane',        tone: 'warn' },
  OUT_FOR_DELIVERY:  { label: 'En livraison',  tone: 'good' },
  LOST:              { label: 'Perdu',         tone: 'bad' },
};

export function StatusBadge({ status }: { status: MissionStatus | ParcelStatus | string }) {
  const info = STATUS_MAP[status] ?? { label: status, tone: 'default' as PillTone };
  return <Pill tone={info.tone}>{info.label}</Pill>;
}
