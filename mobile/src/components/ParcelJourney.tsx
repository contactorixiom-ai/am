// « Le voyage de ton colis » : le trajet Europe → Afrique raconté étape par
// étape, du dépôt à la remise au destinataire.
//
// Un colis maritime met plusieurs semaines à arriver : un simple statut
// (« En transit ») laisse le client sans repère. On montre donc tout le
// parcours prévu, chaque étape franchie datée d'après l'historique saisi par
// Axis, et la position du bateau (ou de l'avion) sur la route. Aucune date
// n'est inventée : l'avancement en mer n'est estimé que si Axis a indiqué une
// date d'arrivée.
import React from 'react';
import { Text, View } from 'react-native';
import type { ParcelStatus, ParcelSummary } from '../api/parcels';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { countryFlag, countryName, isEuropean } from '../utils/countries';
import { Icons } from './Icons';
import { Surface } from './Surface';

interface Stage {
  key: string;
  /** Statuts serveur qui correspondent à cette étape. */
  statuses: ParcelStatus[];
  label: string;
  /** Texte de l'étape quand elle est en cours. */
  now: string;
}

function stagesFor(parcel: ParcelSummary, recipient?: string): Stage[] {
  const sea = parcel.transportMode !== 'AIR';
  const city = parcel.destinationCity;
  // Import Afrique → Europe : dépôt chez le correspondant Axis au départ.
  const imported = isEuropean(parcel.destinationCountry) && !isEuropean(parcel.originCountry);
  return [
    { key: 'ordered', statuses: ['DRAFT'], label: 'Commande confirmée', now: 'Axis prépare ton dossier et les documents de douane.' },
    {
      key: 'handover',
      statuses: ['AWAITING_DROP_OFF', 'AWAITING_PICKUP'],
      label: imported
        ? `Dépôt chez le correspondant Axis à ${parcel.originCity}`
        : parcel.status === 'AWAITING_PICKUP' ? 'Enlèvement à ton adresse' : 'Dépôt chez Axis',
      now: imported
        ? 'L\'expéditeur dépose l\'envoi : il est pesé et étiqueté sur place.'
        : parcel.status === 'AWAITING_PICKUP'
        ? 'Axis vient chercher ton colis au créneau convenu.'
        : 'Dépose ton colis chez Axis : il sera pesé et étiqueté devant toi.',
    },
    { key: 'received', statuses: ['RECEIVED'], label: 'Pris en charge par Axis', now: imported ? 'Contrôlé et emballé pour l\'export, documents en préparation.' : 'Contrôlé, pesé et étiqueté à l\'entrepôt, prêt pour le départ.' },
    {
      key: 'transit',
      statuses: ['IN_TRANSIT'],
      label: sea ? 'En mer' : 'En vol',
      now: sea ? `Ton colis traverse vers ${city}, en conteneur.` : `Ton colis est en route vers ${city}.`,
    },
    { key: 'customs', statuses: ['CUSTOMS'], label: `Arrivé à ${city} · douane`, now: 'Axis s\'occupe du dédouanement à l\'arrivée.' },
    {
      key: 'delivery',
      statuses: ['OUT_FOR_DELIVERY'],
      label: 'Remise au destinataire',
      now: recipient ? `Axis contacte ${recipient} pour convenir de la remise.` : 'Axis contacte le destinataire pour convenir de la remise.',
    },
    { key: 'delivered', statuses: ['DELIVERED'], label: 'Livré', now: recipient ? `${recipient} a bien reçu le colis.` : 'Le colis a été remis.' },
  ];
}

function shortDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Position du véhicule sur la route (0 → 1), d'après l'étape atteinte. */
function routeProgress(parcel: ParcelSummary, stageIdx: number, transitSince?: string): number {
  const fixed = [0.03, 0.06, 0.14, 0.5, 0.86, 0.94, 1];
  if (stageIdx !== 3) return fixed[Math.max(0, stageIdx)] ?? 0;
  // En mer : avancement estimé entre le départ et l'arrivée prévue, si Axis
  // l'a indiquée ; sinon milieu de la traversée.
  const start = transitSince ? new Date(transitSince).getTime() : NaN;
  const end = parcel.estimatedDelivery ? new Date(parcel.estimatedDelivery).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0.5;
  const t = (Date.now() - start) / (end - start);
  return 0.18 + Math.max(0, Math.min(1, t)) * (0.82 - 0.18);
}

interface Props {
  parcel: ParcelSummary;
  /** Prénom du destinataire, si l'expéditeur consulte son propre envoi. */
  recipientFirstName?: string;
  /** Titre de la liste d'étapes (« Le voyage du colis » sur le suivi public). */
  title?: string;
}

export function ParcelJourney({ parcel, recipientFirstName, title = 'Le voyage de ton colis' }: Props) {
  const { theme } = useTheme();
  const stages = stagesFor(parcel, recipientFirstName);
  const events = parcel.trackingEvents ?? [];
  const stopped = parcel.status === 'CANCELLED' || parcel.status === 'LOST';

  const currentIdx = Math.max(0, stages.findIndex((s) => s.statuses.includes(parcel.status)));
  const eventFor = (s: Stage) => events.find((e) => s.statuses.includes(e.status));
  const dateFor = (s: Stage, i: number) =>
    shortDate(eventFor(s)?.occurredAt) || (i === 0 ? shortDate(parcel.createdAt ?? events[0]?.occurredAt) : '');
  const transitSince = events.find((e) => e.status === 'IN_TRANSIT')?.occurredAt;
  const progress = stopped ? 0 : parcel.status === 'DELIVERED' ? 1 : routeProgress(parcel, currentIdx, transitSince);

  const sea = parcel.transportMode !== 'AIR';
  const Vehicle = sea ? Icons.ship : Icons.plane;
  const daysAway = transitSince && currentIdx === 3
    ? Math.max(1, Math.ceil((Date.now() - new Date(transitSince).getTime()) / 86_400_000))
    : null;

  return (
    <View style={{ gap: 12 }}>
      {/* Bannière de route : départ → arrivée, le colis avance dessus. */}
      <View style={{ backgroundColor: theme.navy, borderRadius: RADII.xl, padding: 18, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Endpoint flag={countryFlag(parcel.originCountry)} city={parcel.originCity} country={countryName(parcel.originCountry)} />
          <Endpoint flag={countryFlag(parcel.destinationCountry)} city={parcel.destinationCity} country={countryName(parcel.destinationCountry)} right />
        </View>

        <View style={{ height: 44, marginTop: 14, justifyContent: 'center' }}>
          {/* Route en pointillés (la mer, ou le ciel) */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', left: 6, right: 6 }}>
            {Array.from({ length: 26 }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 4,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: i / 25 <= progress ? theme.gold : 'rgba(255,255,255,0.22)',
                }}
              />
            ))}
          </View>
          <View style={{ position: 'absolute', left: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: theme.gold }} />
          <View style={{ position: 'absolute', right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: progress >= 1 ? theme.gold : 'rgba(255,255,255,0.45)', backgroundColor: progress >= 1 ? theme.gold : theme.navy }} />
          {!stopped ? (
            <View
              style={{
                position: 'absolute',
                left: `${Math.round(progress * 100)}%`,
                marginLeft: -20,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F5F1E8',
                borderWidth: 3,
                borderColor: theme.gold,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {parcel.status === 'DELIVERED'
                ? <Icons.check size={18} color={theme.navy} stroke={2.6} />
                : <Vehicle size={20} color={theme.navy} stroke={1.9} />}
            </View>
          ) : null}
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: TYPO.weights.medium, marginTop: 12 }}>
          {stopped
            ? parcel.status === 'LOST' ? 'Envoi signalé perdu : Axis te contacte.' : 'Envoi annulé.'
            : parcel.status === 'DELIVERED'
            ? `Arrivé à ${parcel.destinationCity}${dateFor(stages[6], 6) ? ` le ${dateFor(stages[6], 6)}` : ''}.`
            : daysAway
            ? `Jour ${daysAway} ${sea ? 'de traversée' : 'de voyage'}${shortDate(parcel.estimatedDelivery) ? ` · arrivée prévue vers le ${shortDate(parcel.estimatedDelivery)}` : ''}`
            : shortDate(parcel.estimatedDelivery)
            ? `Arrivée prévue vers le ${shortDate(parcel.estimatedDelivery)}`
            : sea ? 'Transport maritime · Axis te prévient à chaque étape' : 'Transport aérien · Axis te prévient à chaque étape'}
        </Text>
      </View>

      {/* Toutes les étapes, franchies ou à venir */}
      <Surface padded style={{ padding: 16 }}>
        <Text style={{ fontSize: 10.5, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginBottom: 12 }}>
          {title}
        </Text>
        {stages.map((s, i) => {
          const done = !stopped && (parcel.status === 'DELIVERED' ? true : i < currentIdx);
          const current = !stopped && !done && i === currentIdx;
          const date = dateFor(s, i);
          // La note d'attente (« En attente de dépôt ») n'a plus de sens une
          // fois l'étape franchie.
          const rawNote = eventFor(s)?.notes || eventFor(s)?.location;
          const note = done && rawNote && /^en attente/i.test(rawNote) ? '' : rawNote;
          const last = i === stages.length - 1;
          return (
            <View key={s.key} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center', width: 22 }}>
                <View
                  style={{
                    width: current ? 22 : 16,
                    height: current ? 22 : 16,
                    marginTop: current ? 0 : 3,
                    borderRadius: 11,
                    backgroundColor: done ? theme.good : current ? theme.gold : theme.surface,
                    borderWidth: 2,
                    borderColor: done ? theme.good : current ? theme.gold : theme.line,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {done ? <Icons.check size={9} color="#fff" stroke={3.2} /> : null}
                  {current ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.navy }} /> : null}
                </View>
                {!last ? (
                  <View style={{ flex: 1, width: 2, minHeight: 14, backgroundColor: done ? theme.good : theme.line, marginVertical: 2 }} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: current ? 15 : 13.5,
                      color: done || current ? theme.ink : theme.muted,
                      fontFamily: current ? TYPO.weights.bold : TYPO.weights.medium,
                    }}
                  >
                    {s.label}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                    {date || (done || current ? '' : 'À venir')}
                  </Text>
                </View>
                {current ? (
                  <Text style={{ fontSize: 12.5, color: theme.inkSoft, marginTop: 3, lineHeight: 18, fontFamily: TYPO.weights.regular }}>
                    {s.now}
                  </Text>
                ) : null}
                {note ? (
                  <Text style={{ fontSize: 12, color: theme.inkSoft, marginTop: 3, fontFamily: TYPO.weights.regular }}>{note}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

function Endpoint({ flag, city, country, right }: { flag: string; city: string; country: string; right?: boolean }) {
  return (
    <View style={{ alignItems: right ? 'flex-end' : 'flex-start', maxWidth: '48%' }}>
      {flag ? <Text style={{ fontSize: 22 }}>{flag}</Text> : null}
      <Text style={{ color: '#fff', fontSize: 19, fontFamily: TYPO.weights.bold, marginTop: 4 }} numberOfLines={1}>{city}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: TYPO.weights.medium }} numberOfLines={1}>{country}</Text>
    </View>
  );
}
