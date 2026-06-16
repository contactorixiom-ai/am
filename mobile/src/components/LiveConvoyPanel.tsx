import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { LiveConvoyMap } from './LiveConvoyMap';
import { Pill } from './Pill';
import { Surface } from './Surface';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
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
}

// Panneau de suivi convoyage temps réel — carte interactive + état du chauffeur
// (en route / pause / arrêt) qui évolue automatiquement pour la démo.
export function LiveConvoyPanel({ from, to, fromLabel, toLabel, driverName, vehicleLabel }: Props) {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const baseProgressRef = useRef(0);
  const phaseStartRef = useRef<number>(Date.now());
  const pulse = useRef(new Animated.Value(0)).current;

  const phase = SCRIPT[phaseIdx];

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

  const statusColor =
    phase.state === 'ROLLING' ? theme.good :
    phase.state === 'PAUSE'   ? '#E0A04D' :
    phase.state === 'STOP'    ? theme.gold :
                                theme.navy;

  const totalKm = 312;
  const doneKm = Math.round(totalKm * progress);
  const remainKm = totalKm - doneKm;
  const etaMin = Math.max(0, Math.round((1 - progress) * 200));
  const eta = new Date(Date.now() + etaMin * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const since = (() => {
    const sec = Math.floor((Date.now() - phaseStartRef.current) / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)} min`;
  })();

  return (
    <View style={{ gap: 12 }}>
      <LiveConvoyMap
        from={from}
        to={to}
        progress={progress}
        paused={phase.state !== 'ROLLING' && phase.state !== 'ARRIVED'}
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
              {phase.state === 'PAUSE' ? (
                <Text style={{ color: '#fff', fontSize: 13 }}>⏸</Text>
              ) : phase.state === 'STOP' ? (
                <Icons.fuel size={14} color="#fff" stroke={2.2} />
              ) : phase.state === 'ARRIVED' ? (
                <Icons.check size={14} color="#fff" stroke={3} />
              ) : (
                <Icons.car size={14} color="#fff" stroke={2} />
              )}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pill tone={phase.state === 'ROLLING' ? 'good' : phase.state === 'PAUSE' ? 'warn' : phase.state === 'ARRIVED' ? 'gold' : 'navy'}>
                {phase.label}
              </Pill>
              <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                · depuis {since}
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 4 }}>
              {phase.detail}
            </Text>
          </View>
        </View>

        {/* Ligne de progression km */}
        <View style={{ marginTop: 14 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.bgSoft, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: theme.gold }} />
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
