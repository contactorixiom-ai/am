import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { LiveConvoyMap } from './LiveConvoyMap';
import { Pill } from './Pill';
import { Surface } from './Surface';
import { getLatestPosition, GpsPoint } from '../api/gps';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { distanceMeters } from '../utils/stationaryWatch';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

type DriverState = 'ROLLING' | 'PAUSE' | 'STOP' | 'ARRIVED';

interface Phase {
  state: DriverState;
  label: string;
  detail: string;
  durationMs: number; // durée simulée de la phase
  progressDelta: number; // avancement (0..1) consommé pendant la phase
}

// Scénario de démo : route → pause repas → route → pause carburant → route → arrivée
const SCRIPT: Phase[] = [
  { state: 'ROLLING', label: 'En route',             detail: 'Vitesse moyenne 92 km/h · autoroute A1',         durationMs: 9000,  progressDelta: 0.18 },
  { state: 'PAUSE',   label: 'Pause repas',          detail: 'Aire de Ressons-sur-Matz · 25 min réglementaire', durationMs: 8000,  progressDelta: 0.00 },
  { state: 'ROLLING', label: 'En route',             detail: 'Vitesse moyenne 88 km/h · A1 vers Lille',         durationMs: 10000, progressDelta: 0.22 },
  { state: 'STOP',    label: 'Arrêt carburant',      detail: 'Station BP Roye · plein effectué',                durationMs: 6000,  progressDelta: 0.00 },
  { state: 'ROLLING', label: 'En route',             detail: 'Vitesse moyenne 95 km/h · approche Bruxelles',    durationMs: 9000,  progressDelta: 0.30 },
  { state: 'ARRIVED', label: 'Arrivé à destination', detail: 'Préparation état des lieux d\'arrivée',           durationMs: 999999, progressDelta: 0.30 },
];

interface Props {
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
  fromLabel?: string;
  toLabel?: string;
  driverName?: string;
  vehicleLabel?: string;
  /**
   * Id de la mission backend : si fourni, on interroge la vraie position GPS
   * (GET /missions/:id/gps/latest) toutes les 10 s. Dès qu'une position
   * réelle existe, elle remplace l'animation de démo ; sinon (pas encore de
   * point, hors-ligne, erreur) la démo continue de tourner.
   */
  missionId?: string;
}

// Interroge la dernière position GPS réelle de la mission toutes les 10 s.
// Silencieux en cas d'échec : on retombe simplement sur l'animation démo.
function useLiveGps(missionId?: string): GpsPoint | null {
  const [point, setPoint] = useState<GpsPoint | null>(null);
  useEffect(() => {
    // 'demo' = mission de repli locale (DriverModeScreen) : rien côté backend.
    if (!missionId || missionId === 'demo') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const p = await getLatestPosition(missionId);
        if (!cancelled && p && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
          setPoint(p);
        }
      } catch {
        // Réseau/droits : silencieux, l'animation démo reste affichée.
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [missionId]);
  return point;
}

// Panneau de suivi convoyage temps réel — carte interactive + état du chauffeur
// (en route / pause / arrêt). Si `missionId` est fourni et que le chauffeur a
// émis des positions GPS réelles, elles sont affichées ; sinon la scène de
// démo évolue automatiquement.
export function LiveConvoyPanel({ from, to, fromLabel, toLabel, driverName, vehicleLabel, missionId }: Props) {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  // tick force un re-render chaque seconde pour rafraîchir "depuis Xs" et l'ETA
  // même pendant les phases PAUSE/STOP où rien d'autre ne bouge.
  const [, setTick] = useState(0);
  const baseProgressRef = useRef(0);
  const phaseStartRef = useRef<number>(Date.now());
  const pulse = useRef(new Animated.Value(0)).current;

  const phase = SCRIPT[phaseIdx];
  const livePoint = useLiveGps(missionId);

  // Valeurs dérivées de la vraie position GPS (si le chauffeur en a émis).
  // Progression = distance parcourue depuis le départ, projetée sur le trajet.
  const live = livePoint
    ? (() => {
        const routeM = Math.max(1, distanceMeters(from.latitude, from.longitude, to.latitude, to.longitude));
        const doneM = distanceMeters(from.latitude, from.longitude, livePoint.latitude, livePoint.longitude);
        const speed = livePoint.speedKmh ?? null;
        return {
          prog: Math.min(1, Math.max(0, doneM / routeM)),
          totalKm: Math.max(1, Math.round(routeM / 1000)),
          speed,
          moving: (speed ?? 0) > 5,
          ageSec: Math.max(0, Math.floor((Date.now() - new Date(livePoint.recordedAt).getTime()) / 1000)),
        };
      })()
    : null;

  // Tick de rafraîchissement : 1 fois par seconde, indépendant des phases.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Animation de progression : pour la phase ROLLING on interpole linéairement
  // entre baseProgress et baseProgress + delta sur la durée. Pour les autres,
  // on reste figé.
  useEffect(() => {
    phaseStartRef.current = Date.now();
    if (phase.state !== 'ROLLING') return;
    const start = baseProgressRef.current;
    const end = start + phase.progressDelta;
    const tick = () => {
      const elapsed = Date.now() - phaseStartRef.current;
      const t = Math.min(1, elapsed / phase.durationMs);
      setProgress(start + (end - start) * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phaseIdx, phase.state, phase.progressDelta, phase.durationMs]);

  // Passage à la phase suivante
  useEffect(() => {
    if (phaseIdx >= SCRIPT.length - 1) return;
    const id = setTimeout(() => {
      baseProgressRef.current += phase.progressDelta;
      setProgress(baseProgressRef.current);
      setPhaseIdx((i) => i + 1);
    }, phase.durationMs);
    return () => clearTimeout(id);
  }, [phaseIdx, phase.durationMs, phase.progressDelta]);

  // Pulsation du voyant statut
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Valeurs affichées : GPS réel prioritaire, sinon scénario de démo.
  const displayState: DriverState = live ? (live.moving ? 'ROLLING' : 'STOP') : phase.state;
  const displayProgress = live ? live.prog : progress;
  const displayLabel = live
    ? (live.moving ? 'En route' : 'Véhicule à l\'arrêt')
    : phase.label;
  const displayDetail = live
    ? (live.speed !== null
        ? `GPS temps réel · ${Math.round(live.speed)} km/h`
        : 'GPS temps réel · position transmise par le chauffeur')
    : phase.detail;

  const statusColor =
    displayState === 'ROLLING' ? theme.good :
    displayState === 'PAUSE'   ? '#E0A04D' :
    displayState === 'STOP'    ? (live ? '#E0A04D' : theme.gold) :
                                 theme.navy;

  const totalKm = live ? live.totalKm : 312;
  const doneKm = Math.round(totalKm * displayProgress);
  const remainKm = totalKm - doneKm;
  // ETA : vitesse GPS réelle si le véhicule roule, sinon moyenne 85 km/h
  // (autoroute mixte UE). En démo, on ajoute le temps de pause restant.
  const avgSpeedKmh = live && live.speed !== null && live.speed > 20 ? live.speed : 85;
  const driveMin = (remainKm / avgSpeedKmh) * 60;
  const phaseRemainMs = Math.max(0, phase.durationMs - (Date.now() - phaseStartRef.current));
  const pauseRemainMin = !live && (phase.state === 'PAUSE' || phase.state === 'STOP') ? phaseRemainMs / 60000 : 0;
  const etaMin = Math.max(0, Math.round(driveMin + pauseRemainMin));
  const eta = !live && phase.state === 'ARRIVED'
    ? 'Arrivé'
    : new Date(Date.now() + etaMin * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const fmtDuration = (sec: number) => {
    if (sec < 60) return `${sec} s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    if (min < 60) return rem > 0 && min < 5 ? `${min} min ${rem} s` : `${min} min`;
    const h = Math.floor(min / 60);
    return `${h} h ${min % 60} min`;
  };

  // Démo : « depuis Xs » (durée de la phase). GPS réel : fraîcheur du point.
  const sinceLabel = live
    ? `· MAJ il y a ${fmtDuration(live.ageSec)}`
    : `· depuis ${fmtDuration(Math.floor((Date.now() - phaseStartRef.current) / 1000))}`;

  return (
    <View style={{ gap: 12 }}>
      <LiveConvoyMap
        from={from}
        to={to}
        progress={displayProgress}
        paused={displayState !== 'ROLLING' && displayState !== 'ARRIVED'}
        height={260}
        fromLabel={fromLabel}
        toLabel={toLabel}
      />

      {/* Carte statut chauffeur */}
      <Surface padded style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View
              style={{
                position: 'absolute',
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: statusColor,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.35] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
              }}
            />
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: statusColor, alignItems: 'center', justifyContent: 'center' }}>
              {displayState === 'PAUSE' ? (
                <Text style={{ color: '#fff', fontSize: 13 }}>⏸</Text>
              ) : displayState === 'STOP' ? (
                live
                  ? <Icons.pin size={14} color="#fff" stroke={2.2} />
                  : <Icons.fuel size={14} color="#fff" stroke={2.2} />
              ) : displayState === 'ARRIVED' ? (
                <Icons.check size={14} color="#fff" stroke={3} />
              ) : (
                <Icons.car size={14} color="#fff" stroke={2} />
              )}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pill tone={displayState === 'ROLLING' ? 'good' : displayState === 'PAUSE' ? 'warn' : displayState === 'ARRIVED' ? 'gold' : live ? 'warn' : 'navy'}>
                {displayLabel}
              </Pill>
              {live ? <Pill tone="gold">Live</Pill> : null}
              <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                {sinceLabel}
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 4 }}>
              {displayDetail}
            </Text>
          </View>
        </View>

        {/* Ligne de progression km */}
        <View style={{ marginTop: 14 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.bgSoft, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(displayProgress * 100)}%`, height: '100%', backgroundColor: theme.gold }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.semibold }}>
              {doneKm} km parcourus
            </Text>
            <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.semibold }}>
              {remainKm} km restants · ETA {eta}
            </Text>
          </View>
        </View>

        {/* Chauffeur + actions rapides */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.line }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.navy, fontFamily: TYPO.weights.bold, fontSize: 13 }}>
              {(driverName ?? 'KD').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
              {driverName ?? 'Karim Diallo'}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              {vehicleLabel ?? 'BMW Série 3 · AX-2847'} · 4,9 ★
            </Text>
          </View>
          <Pressable
            onPress={() => notify('Appel chauffeur', `Mise en relation avec ${driverName ?? 'le chauffeur'} dans la version finale.`)}
            style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: pressed ? theme.bgSoft : theme.surface, alignItems: 'center', justifyContent: 'center' })}
          >
            <Icons.phone size={16} color={theme.ink} stroke={1.8} />
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('Messaging', { driverName: driverName ?? 'Karim Diallo', subtitle: `En route · ${vehicleLabel ?? ''}`.trim() })}
            style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, backgroundColor: pressed ? theme.navyDeep : theme.navy, alignItems: 'center', justifyContent: 'center' })}
          >
            <Icons.chat size={16} color="#F5F1E8" stroke={1.8} />
          </Pressable>
        </View>
      </Surface>
    </View>
  );
}
