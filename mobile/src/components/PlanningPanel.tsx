// Planning interne (responsables d'exploitation, administrateur) : les
// missions de la semaine jour par jour ou convoyeur par convoyeur, et
// l'affectation directe d'un convoyeur. Le convoyeur est prévenu et retrouve
// la mission dans son onglet « Missions ».
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { assignDriver, DriverOption, listDrivers, listMissionsBetween, MissionSummary } from '../api/missions';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { CountBadge } from './CountBadge';
import { Icons } from './Icons';
import { Pill } from './Pill';
import { StatusBadge } from './StatusBadge';
import { Chips } from './StaffWidgets';
import { Surface } from './Surface';

type View_ = 'day' | 'driver';
const DONE = ['DELIVERED', 'COMPLETED', 'CANCELLED'];

function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - wd);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const needsDriver = (m: MissionSummary) => !m.driver && !DONE.includes(m.status);

export function PlanningPanel({ onNewMission, refreshToken }: { onNewMission?: () => void; refreshToken?: number }) {
  const { theme } = useTheme();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [view, setView] = useState<View_>('day');
  const [missions, setMissions] = useState<MissionSummary[] | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<MissionSummary | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    setFailed(false);
    setMissions(null);
    try {
      setMissions(await listMissionsBetween(weekStart, addDays(weekStart, 7)));
    } catch {
      setFailed(true);
    }
  }, [weekStart]);
  // Rechargé aussi quand une mission vient d'être créée (refreshToken).
  useEffect(() => { void load(); }, [load, refreshToken]);
  useEffect(() => { listDrivers().then(setDrivers).catch(() => setDrivers([])); }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, MissionSummary[]>();
    for (const m of missions ?? []) {
      const k = dayKey(new Date(m.pickupAt));
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return map;
  }, [missions]);

  const toAssign = (missions ?? []).filter(needsDriver);
  const isThisWeek = dayKey(weekStart) === dayKey(mondayOf(new Date()));
  const range = `${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Missions d'un convoyeur un jour donné (pour repérer les doublons).
  const countFor = (driverId: string, d: Date) =>
    (byDay.get(dayKey(d)) ?? []).filter((m) => m.driver?.id === driverId && m.status !== 'CANCELLED').length;

  return (
    <View style={{ gap: 12 }}>
      <Surface padded style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>Planning des missions</Text>
            <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>{range}</Text>
          </View>
          <NavBtn label="Semaine précédente" icon="arrowL" onPress={() => setWeekStart((w) => addDays(w, -7))} />
          <NavBtn label="Semaine suivante" icon="arrow" onPress={() => setWeekStart((w) => addDays(w, 7))} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!isThisWeek ? <Button kind="ghost" size="sm" onPress={() => setWeekStart(mondayOf(new Date()))}>Cette semaine</Button> : null}
          <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
            {missions ? `${missions.length} mission${missions.length > 1 ? 's' : ''}` : '…'}
          </Text>
          {toAssign.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CountBadge count={toAssign.length} />
              <Text style={{ fontSize: 12.5, color: theme.bad, fontFamily: TYPO.weights.semibold }}>à affecter</Text>
            </View>
          ) : missions?.length ? <Pill tone="good">Tout est affecté</Pill> : null}
          <View style={{ flex: 1 }} />
          {onNewMission ? (
            <Button kind="gold" size="sm" leftIcon={<Icons.plus size={14} color={theme.onGold} stroke={2.2} />} onPress={onNewMission}>
              Nouvelle mission
            </Button>
          ) : null}
        </View>
        <Chips<View_> options={[{ key: 'day', label: 'Jour par jour' }, { key: 'driver', label: 'Par convoyeur' }]} value={view} onChange={setView} />
      </Surface>

      {missions === null && !failed ? <ActivityIndicator color={theme.link} /> : null}
      {failed ? (
        <Surface padded style={{ gap: 8 }}>
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Planning indisponible pour le moment.</Text>
          <Button kind="outline" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => void load()}>Réessayer</Button>
        </Surface>
      ) : null}

      {missions && view === 'day'
        ? days.map((d) => {
            const list = byDay.get(dayKey(d)) ?? [];
            const today = dayKey(d) === dayKey(new Date());
            return (
              <View key={dayKey(d)} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
                  <Text style={{ fontSize: 12, color: today ? theme.gold : theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.bold }}>
                    {d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}{today ? ' · aujourd\'hui' : ''}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: theme.lineSoft }} />
                  <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{list.length || '—'}</Text>
                </View>
                {list.map((m) => <MissionRow key={m.id} m={m} onAssign={() => setTarget(m)} />)}
              </View>
            );
          })
        : null}

      {missions && view === 'driver' ? (
        <>
          {toAssign.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: theme.bad, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.bold }}>À affecter</Text>
              {toAssign.map((m) => <MissionRow key={m.id} m={m} onAssign={() => setTarget(m)} />)}
            </View>
          ) : null}
          <Surface padded style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 6 }}>
              <Text style={{ flex: 1, fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Convoyeur</Text>
              {days.map((d) => (
                <Text key={dayKey(d)} style={{ width: 26, textAlign: 'center', fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.semibold }}>
                  {d.toLocaleDateString('fr-FR', { weekday: 'narrow' }).toUpperCase()}
                </Text>
              ))}
            </View>
            {drivers === null ? <ActivityIndicator color={theme.link} /> : null}
            {(drivers ?? []).map((dr) => (
              <View key={dr.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.lineSoft }}>
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Avatar name={`${dr.firstName} ${dr.lastName}`} url={dr.avatarUrl} size={28} />
                  <Text style={{ flex: 1, minWidth: 0, fontSize: 13, color: dr.verified === false ? theme.muted : theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                    {dr.firstName} {dr.lastName}
                  </Text>
                </View>
                {days.map((d) => {
                  const n = countFor(dr.id, d);
                  return (
                    <View key={dayKey(d)} style={{ width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: n > 1 ? theme.bad + '33' : n === 1 ? theme.gold + '33' : theme.bgSoft }}>
                      <Text style={{ fontSize: 12, color: n > 1 ? theme.bad : theme.ink, fontFamily: TYPO.weights.bold }}>{n || ''}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
            {drivers && !drivers.length ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}>Aucun convoyeur inscrit.</Text> : null}
            <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 6 }}>
              Chiffre = nombre de missions ce jour-là ; en rouge, plusieurs missions le même jour.
            </Text>
          </Surface>
        </>
      ) : null}

      <AssignSheet
        mission={target}
        drivers={drivers}
        countFor={countFor}
        onClose={() => setTarget(null)}
        onDone={() => { setTarget(null); void load(); }}
      />
    </View>
  );
}

function NavBtn({ label, icon, onPress }: { label: string; icon: 'arrowL' | 'arrow'; onPress: () => void }) {
  const { theme } = useTheme();
  const Ic = Icons[icon];
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: pressed ? theme.bgSoft : theme.surface, alignItems: 'center', justifyContent: 'center' })}>
      <Ic size={16} color={theme.ink} stroke={2} />
    </Pressable>
  );
}

function MissionRow({ m, onAssign }: { m: MissionSummary; onAssign: () => void }) {
  const { theme } = useTheme();
  const missing = needsDriver(m);
  return (
    <Surface padded style={{ gap: 8, borderColor: missing ? theme.bad + '66' : theme.line, opacity: m.status === 'CANCELLED' ? 0.55 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 54, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>{hm(m.pickupAt)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
            {m.pickupCity} → {m.deliveryCity}
          </Text>
          <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
            {m.reference} · {m.vehicle.make} {m.vehicle.model}{m.distanceKm ? ` · ${Math.round(m.distanceKm)} km` : ''}
          </Text>
        </View>
        <StatusBadge status={m.status} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {m.driver ? (
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icons.user size={14} color={theme.muted} stroke={1.8} />
            <Text style={{ flex: 1, minWidth: 0, fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
              {m.driver.firstName} {m.driver.lastName}
            </Text>
          </View>
        ) : (
          <Text style={{ flex: 1, fontSize: 13, color: missing ? theme.bad : theme.muted, fontFamily: TYPO.weights.semibold }}>
            {missing ? 'Aucun convoyeur affecté' : 'Sans convoyeur'}
          </Text>
        )}
        {!DONE.includes(m.status) ? (
          <Button kind={m.driver ? 'outline' : 'gold'} size="sm" onPress={onAssign}>{m.driver ? 'Changer' : 'Affecter'}</Button>
        ) : null}
      </View>
    </Surface>
  );
}

function AssignSheet({
  mission, drivers, countFor, onClose, onDone,
}: {
  mission: MissionSummary | null;
  drivers: DriverOption[] | null;
  countFor: (driverId: string, d: Date) => number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const day = mission ? new Date(mission.pickupAt) : new Date();
  // Libres ce jour-là d'abord, dossiers incomplets en dernier.
  const sorted = [...(drivers ?? [])].sort((a, b) => {
    const score = (d: DriverOption) => (d.verified === false ? 100 : 0) + countFor(d.id, day) * 10;
    return score(a) - score(b) || a.lastName.localeCompare(b.lastName);
  });

  const pick = async (d: DriverOption) => {
    if (!mission || busy) return;
    setBusy(d.id);
    try {
      await assignDriver(mission.id, d.id);
      notify('Mission affectée', `${mission.reference} confiée à ${d.firstName} ${d.lastName}. Il est prévenu sur son téléphone et la retrouve dans « Missions ».`);
      onDone();
    } catch (e) {
      notify('Affectation impossible', e instanceof Error ? e.message : 'Réessaie dans un instant.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={!!mission} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation?.()} style={{ maxHeight: '90%', backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>Affecter un convoyeur</Text>
              {mission ? (
                <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {mission.reference} · {mission.pickupCity} → {mission.deliveryCity} · {day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} {hm(mission.pickupAt)}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.x size={16} color={theme.ink} stroke={2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 8 }}>
            {drivers === null ? <ActivityIndicator color={theme.link} /> : null}
            {drivers && !drivers.length ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}>Aucun convoyeur inscrit pour le moment.</Text> : null}
            {sorted.map((d) => {
              const n = countFor(d.id, day);
              const blocked = d.verified === false;
              const current = mission?.driver?.id === d.id;
              return (
                <Pressable
                  key={d.id}
                  disabled={blocked || !!busy || current}
                  onPress={() => void pick(d)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: RADII.lg, borderWidth: 1.5,
                    borderColor: current ? theme.gold : theme.line,
                    backgroundColor: pressed ? theme.bgSoft : theme.surface,
                    opacity: blocked ? 0.55 : 1,
                  })}
                >
                  <Avatar name={`${d.firstName} ${d.lastName}`} url={d.avatarUrl} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{d.firstName} {d.lastName}</Text>
                    <Text style={{ fontSize: 11.5, color: blocked ? theme.bad : theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={2}>
                      {blocked
                        ? `Dossier incomplet : ${(d.missingDocuments ?? []).join(', ').toLowerCase() || 'pièces à valider'}`
                        : [d.driverProfile?.baseCity, d.phone].filter(Boolean).join(' · ') || 'Convoyeur vérifié'}
                    </Text>
                  </View>
                  {busy === d.id ? <ActivityIndicator color={theme.link} />
                    : current ? <Pill tone="gold">Affecté</Pill>
                    : blocked ? null
                    : n === 0 ? <Pill tone="good">Libre ce jour</Pill>
                    : <Pill tone="warn">{`Déjà ${n} mission${n > 1 ? 's' : ''}`}</Pill>}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
