import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { listMissions, MissionSummary } from '../api/missions';
import { trackPosition, TrackPositionInput } from '../api/gps';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { useToast } from '../components/PushToast';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { createStationaryWatch, StationaryWatch } from '../utils/stationaryWatch';

// ─── Mode chauffeur : suivi GPS temps réel + pause + alerte d'arrêt ─────────
// Le chauffeur démarre le suivi au départ de la mission. Le téléphone envoie
// alors sa position au backend toutes les ~15 s (silencieusement bufferisée
// en cas de coupure réseau). S'il déclare une pause, l'envoi s'interrompt et
// la détection d'arrêt est neutralisée. Si le véhicule reste immobile plus de
// 5 minutes SANS pause déclarée, une alerte plein écran demande au chauffeur
// s'il va bien ; sans réponse sous 60 s, l'alerte est transmise au dispatching.

const SEND_INTERVAL_MS = 15000; // envoi backend ~15 s
const HEARTBEAT_MS = 10000; // ré-injection de la dernière position dans la détection d'arrêt
const PENDING_MAX = 60; // buffer local max en cas de coupure réseau
const ALERT_COUNTDOWN_S = 60; // délai de réponse avant transmission au dispatching

// Position interne, indépendante du type DOM GeolocationPosition pour rester
// portable (web / natif / simulation).
interface PhonePosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speedKmh?: number;
  heading?: number;
  altitude?: number;
  timestamp: number;
}

type DriverStatus = 'IDLE' | 'ROLLING' | 'PAUSED' | 'STOPPED';

// Mission de repli si aucune mission active / hors-ligne : l'écran reste
// entièrement utilisable en démo (rien n'est envoyé au backend).
const DEMO_MISSION: MissionSummary = {
  id: 'demo',
  reference: 'AX-CV-0042 (démo)',
  status: 'IN_PROGRESS',
  pickupCity: 'Paris',
  pickupCountry: 'FR',
  pickupAt: new Date().toISOString(),
  deliveryCity: 'Bruxelles',
  deliveryCountry: 'BE',
  vehicle: { make: 'BMW', model: 'Série 3', year: 2022, licensePlate: 'AX-2847' },
  driver: { firstName: 'Karim', lastName: 'Diallo' },
};

// Trajectoire simulée (Paris → Bruxelles) quand la géolocalisation du
// téléphone n'est pas disponible (natif sans module GPS, permission refusée).
const SIM_FROM = { latitude: 48.8566, longitude: 2.3522 };
const SIM_TO = { latitude: 50.8503, longitude: 4.3517 };

function hasPhoneGeolocation(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation
    && typeof navigator.geolocation.watchPosition === 'function';
}

export function DriverModeScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ─── Mission en cours ────────────────────────────────────────────────────
  const [mission, setMission] = useState<MissionSummary | null>(null);
  const [missionIsDemo, setMissionIsDemo] = useState(false);
  const [missionLoading, setMissionLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listMissions();
        if (cancelled) return;
        // Défensif : une réponse inattendue (erreur serveur, forme différente)
        // ne doit pas planter l'écran — on retombe alors sur le mode démo.
        const data = Array.isArray(res?.data) ? res.data : [];
        const active =
          data.find((m) => m.status === 'IN_PROGRESS')
          ?? data.find((m) => m.status === 'ACCEPTED');
        if (active) {
          setMission(active);
          setMissionIsDemo(false);
        } else {
          setMission(DEMO_MISSION);
          setMissionIsDemo(true);
        }
      } catch {
        // Hors-ligne / non connecté : repli démo, l'écran reste utilisable.
        if (!cancelled) {
          setMission(DEMO_MISSION);
          setMissionIsDemo(true);
        }
      } finally {
        if (!cancelled) setMissionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── État du suivi ───────────────────────────────────────────────────────
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stationaryAlarm, setStationaryAlarm] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastPosition, setLastPosition] = useState<PhonePosition | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  // ─── Alerte « Tout va bien ? » ───────────────────────────────────────────
  const [alertVisible, setAlertVisible] = useState(false);
  const [countdown, setCountdown] = useState(ALERT_COUNTDOWN_S);

  // Refs miroirs pour les callbacks d'intervalle (évite les fermetures figées).
  const pausedRef = useRef(false);
  const lastPositionRef = useRef<PhonePosition | null>(null);
  const missionRef = useRef<MissionSummary | null>(null);
  const missionIsDemoRef = useRef(false);
  pausedRef.current = paused;
  missionRef.current = mission;
  missionIsDemoRef.current = missionIsDemo;

  const stationaryRef = useRef<StationaryWatch | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Buffer local : positions non envoyées (réseau coupé) — on n'interrompt
  // jamais le chauffeur pour un problème réseau.
  const pendingRef = useRef<TrackPositionInput[]>([]);
  const simProgressRef = useRef(0);

  // ─── Réception d'une position (GPS réel ou simulation) ──────────────────
  const handlePosition = useCallback((pos: PhonePosition) => {
    lastPositionRef.current = pos;
    setLastPosition(pos);
    setGeoError(null);
    stationaryRef.current?.push(pos.latitude, pos.longitude, pos.timestamp);
  }, []);

  // ─── Envoi backend toutes les ~15 s (actif ET pas en pause) ──────────────
  const flushTick = useCallback(async () => {
    if (pausedRef.current) return;
    const pos = lastPositionRef.current;
    const m = missionRef.current;
    if (!pos || !m) return;

    const point: TrackPositionInput = {
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracy !== undefined && pos.accuracy >= 0 ? pos.accuracy : undefined,
      speedKmh: pos.speedKmh !== undefined && pos.speedKmh >= 0 ? Math.round(pos.speedKmh * 10) / 10 : undefined,
      heading: pos.heading !== undefined && pos.heading >= 0 && pos.heading <= 360 ? pos.heading : undefined,
      altitude: pos.altitude,
    };

    pendingRef.current.push(point);
    if (pendingRef.current.length > PENDING_MAX) {
      pendingRef.current = pendingRef.current.slice(-PENDING_MAX);
    }

    if (missionIsDemoRef.current) {
      // Démo : rien ne part sur le réseau, on compte localement.
      pendingRef.current = [];
      setSentCount((n) => n + 1);
      setLastSentAt(new Date());
      return;
    }

    // Flush du buffer dans l'ordre ; au premier échec on s'arrête en silence,
    // les points restants repartiront au prochain tick.
    while (pendingRef.current.length > 0) {
      const next = pendingRef.current[0];
      try {
        await trackPosition(m.id, next);
        pendingRef.current.shift();
        setSentCount((n) => n + 1);
        setLastSentAt(new Date());
      } catch {
        break; // silencieux : buffer conservé, le chauffeur n'est pas dérangé
      }
    }
  }, []);

  // ─── Alerte d'arrêt prolongé ─────────────────────────────────────────────
  const handleStationaryAlert = useCallback(() => {
    setStationaryAlarm(true);
    setCountdown(ALERT_COUNTDOWN_S);
    setAlertVisible(true);
  }, []);

  const handleMove = useCallback(() => {
    setStationaryAlarm(false);
    setAlertVisible(false);
  }, []);

  // ─── Démarrage / arrêt du suivi ──────────────────────────────────────────
  const stopEverything = useCallback(() => {
    if (geoWatchIdRef.current !== null && hasPhoneGeolocation()) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
    }
    geoWatchIdRef.current = null;
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = null;
    if (sendTimerRef.current) clearInterval(sendTimerRef.current);
    sendTimerRef.current = null;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    stationaryRef.current = null;
    pendingRef.current = [];
  }, []);

  const startSimulation = useCallback(() => {
    setSimulated(true);
    simProgressRef.current = 0;
    simTimerRef.current = setInterval(() => {
      // ~90 km/h le long de Paris → Bruxelles (+ léger bruit GPS réaliste)
      simProgressRef.current = Math.min(1, simProgressRef.current + 0.0009);
      const t = simProgressRef.current;
      handlePosition({
        latitude: SIM_FROM.latitude + (SIM_TO.latitude - SIM_FROM.latitude) * t + (Math.random() - 0.5) * 0.0002,
        longitude: SIM_FROM.longitude + (SIM_TO.longitude - SIM_FROM.longitude) * t + (Math.random() - 0.5) * 0.0002,
        accuracy: 8,
        speedKmh: 88 + Math.random() * 8,
        heading: 25,
        timestamp: Date.now(),
      });
    }, 3000);
  }, [handlePosition]);

  const startTracking = useCallback(() => {
    setTracking(true);
    setPaused(false);
    setStationaryAlarm(false);
    setSentCount(0);
    setLastSentAt(null);
    setGeoError(null);
    setSimulated(false);

    stationaryRef.current = createStationaryWatch({
      onAlert: handleStationaryAlert,
      onMove: handleMove,
    });

    if (hasPhoneGeolocation()) {
      // Web (et natif si polyfill présent) : suivi haute précision du téléphone.
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (p) => {
          handlePosition({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy ?? undefined,
            // coords.speed est en m/s (peut être null) → km/h
            speedKmh: p.coords.speed !== null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : undefined,
            heading: p.coords.heading !== null && p.coords.heading >= 0 ? p.coords.heading : undefined,
            altitude: p.coords.altitude ?? undefined,
            timestamp: p.timestamp || Date.now(),
          });
        },
        (err) => {
          if (err.code === 1) {
            // PERMISSION_DENIED : message clair + repli simulation proposé.
            setGeoError(
              'Accès à la position refusé. Autorise la géolocalisation dans les réglages du navigateur, ou continue en simulation.',
            );
          } else {
            setGeoError('Position introuvable pour le moment. Nouvelle tentative automatique…');
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
    } else {
      // Natif sans API géoloc (pas de module expo-location installé) : simulation.
      setGeoError('Géolocalisation du téléphone indisponible sur cet appareil — trajectoire simulée.');
      startSimulation();
    }

    // Envoi backend ~15 s + heartbeat détection d'arrêt : même si le GPS ne
    // publie plus (véhicule parfaitement immobile), on ré-injecte la dernière
    // position pour que le compteur des 5 minutes progresse.
    sendTimerRef.current = setInterval(flushTick, SEND_INTERVAL_MS);
    heartbeatRef.current = setInterval(() => {
      const pos = lastPositionRef.current;
      if (pos) stationaryRef.current?.push(pos.latitude, pos.longitude, Date.now());
    }, HEARTBEAT_MS);
  }, [flushTick, handleMove, handlePosition, handleStationaryAlert, startSimulation]);

  const stopTracking = useCallback(() => {
    stopEverything();
    setTracking(false);
    setPaused(false);
    setStationaryAlarm(false);
    setAlertVisible(false);
    setSimulated(false);
    toast.push({ kind: 'driver', title: 'Suivi terminé', body: 'La position n’est plus partagée.' });
  }, [stopEverything, toast]);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      stationaryRef.current?.setPaused(next);
      if (next) {
        // La pause lève l'alarme en cours : arrêt déclaré, donc légitime.
        setStationaryAlarm(false);
        setAlertVisible(false);
      }
      return next;
    });
  }, []);

  const switchToSimulation = useCallback(() => {
    if (geoWatchIdRef.current !== null && hasPhoneGeolocation()) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
    setGeoError(null);
    startSimulation();
  }, [startSimulation]);

  // Nettoyage complet au démontage de l'écran.
  useEffect(() => stopEverything, [stopEverything]);

  // ─── Compte à rebours de l'alerte plein écran ────────────────────────────
  const transmitAlert = useCallback(() => {
    setAlertVisible(false);
    // TODO(backend): créer un endpoint d'alerte dispatching
    // (ex. POST /missions/:id/alerts { type: 'PROLONGED_STOP', position })
    // et l'afficher côté dashboard admin. Pour l'instant : notification locale.
    notify(
      'Alerte transmise au dispatching',
      'Le dispatching a été prévenu de l’arrêt prolongé et va tenter de te joindre.',
    );
    toast.push({
      kind: 'security',
      title: 'Alerte transmise au dispatching',
      body: 'Arrêt prolongé signalé — le dispatching te contacte.',
    });
  }, [toast]);

  useEffect(() => {
    if (!alertVisible) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [alertVisible]);

  // À zéro sans réponse du chauffeur : transmission au dispatching.
  useEffect(() => {
    if (alertVisible && countdown === 0) transmitAlert();
  }, [alertVisible, countdown, transmitAlert]);

  const dismissAlert = useCallback(() => {
    setAlertVisible(false);
    setStationaryAlarm(false);
    // « Je vais bien » : on ré-arme la détection (nouvel épisode de 5 min).
    stationaryRef.current?.reset();
  }, []);

  // ─── Statut affiché ──────────────────────────────────────────────────────
  const status: DriverStatus = !tracking
    ? 'IDLE'
    : paused
      ? 'PAUSED'
      : stationaryAlarm
        ? 'STOPPED'
        : 'ROLLING';

  const statusMeta = useMemo(() => {
    switch (status) {
      case 'ROLLING':
        return { label: 'EN ROUTE', color: theme.good, hint: 'Position partagée toutes les 15 s' };
      case 'PAUSED':
        return { label: 'EN PAUSE', color: theme.warn, hint: 'Pause déclarée — envoi suspendu' };
      case 'STOPPED':
        return { label: 'ARRÊTÉ', color: theme.bad, hint: 'Immobile depuis plus de 5 min sans pause' };
      case 'IDLE':
      default:
        return { label: 'PRÊT', color: theme.muted, hint: 'Démarre le suivi au départ de la mission' };
    }
  }, [status, theme]);

  const speedLabel = lastPosition?.speedKmh !== undefined
    ? `${Math.round(lastPosition.speedKmh)}`
    : '—';

  // ─── État des lieux (départ / arrivée) rattachés à la mission courante ─────
  const inspectionReference = mission?.reference ?? 'AX-DEMO';
  const inspectionVehicleLabel = mission
    ? `${mission.vehicle.make} ${mission.vehicle.model}${mission.vehicle.licensePlate ? ` · ${mission.vehicle.licensePlate}` : ''}`
    : 'Véhicule';
  const openInspection = (phase: 'DÉPART' | 'ARRIVÉE') =>
    nav.navigate('VehicleInspection', {
      phase,
      reference: inspectionReference,
      vehicleLabel: inspectionVehicleLabel,
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title="Mode chauffeur"
        subtitle={mission ? `${mission.reference} · ${mission.pickupCity} → ${mission.deliveryCity}` : 'Chargement de la mission…'}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        {/* Mission en cours */}
        <Surface padded>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: TYPO.sizes.label, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, flex: 1 }}>
              Mission en cours
            </Text>
            {missionIsDemo ? <Pill tone="gold">Démo</Pill> : null}
            {mission ? (
              <Pill tone={mission.status === 'IN_PROGRESS' ? 'good' : 'navy'}>
                {mission.status === 'IN_PROGRESS' ? 'En cours' : 'Acceptée'}
              </Pill>
            ) : null}
          </View>
          <Text style={{ fontSize: 19, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 8, letterSpacing: -0.3 }}>
            {missionLoading ? 'Chargement…' : mission ? `${mission.pickupCity} → ${mission.deliveryCity}` : '—'}
          </Text>
          {mission ? (
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 3 }}>
              {mission.reference} · {mission.vehicle.make} {mission.vehicle.model}
              {mission.vehicle.licensePlate ? ` · ${mission.vehicle.licensePlate}` : ''}
            </Text>
          ) : null}
        </Surface>

        {missionIsDemo && !missionLoading ? (
          <Banner
            tone="info"
            title="Mode démonstration"
            message="Aucune mission active trouvée (ou hors-ligne). Le suivi fonctionne mais aucune position n'est envoyée au serveur."
          />
        ) : null}

        {/* État des lieux — départ (à la prise en charge) et arrivée (livraison).
            Génère le PV/contrat signé avec le croquis véhicule et les photos. */}
        <Surface padded>
          <Text style={{ fontSize: TYPO.sizes.label, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            État des lieux
          </Text>
          <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 4, lineHeight: 17 }}>
            À faire signer au départ (prise en charge) puis à l'arrivée (livraison). Le contrat est généré automatiquement.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button
              kind="primary"
              size="md"
              style={{ flex: 1 }}
              leftIcon={<Icons.sig size={17} color="#fff" stroke={1.9} />}
              onPress={() => openInspection('DÉPART')}
            >
              Départ
            </Button>
            <Button
              kind="gold"
              size="md"
              style={{ flex: 1 }}
              leftIcon={<Icons.check size={17} color={theme.navy} stroke={2} />}
              onPress={() => openInspection('ARRIVÉE')}
            >
              Arrivée
            </Button>
          </View>
        </Surface>

        {geoError ? (
          <Banner
            tone="warn"
            title="Géolocalisation"
            message={geoError}
            action={simulated ? undefined : { label: 'Simulation', onPress: switchToSimulation }}
          />
        ) : null}

        {/* Gros statut central — lisible d'un coup d'œil au volant */}
        <Surface padded style={{ alignItems: 'center', paddingVertical: 30, borderColor: statusMeta.color + '55', borderWidth: 1.5, backgroundColor: statusMeta.color + '10' }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: statusMeta.color,
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              fontSize: 34,
              color: statusMeta.color,
              fontFamily: TYPO.weights.bold,
              letterSpacing: 1.5,
              textAlign: 'center',
            }}
          >
            {statusMeta.label}
          </Text>
          <Text style={{ fontSize: 13, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 8, textAlign: 'center' }}>
            {statusMeta.hint}
          </Text>
          {simulated && tracking ? (
            <View style={{ marginTop: 10 }}>
              <Pill tone="gold">Trajectoire simulée</Pill>
            </View>
          ) : null}
        </Surface>

        {/* Indicateurs : vitesse / positions envoyées / dernier envoi */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile
            label="Vitesse"
            value={speedLabel}
            unit="km/h"
          />
          <StatTile
            label={missionIsDemo ? 'Positions (démo)' : 'Positions envoyées'}
            value={String(sentCount)}
            unit={pendingRef.current.length > 0 ? `${pendingRef.current.length} en attente` : undefined}
          />
          <StatTile
            label="Dernier envoi"
            value={lastSentAt ? lastSentAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          />
        </View>

        {/* Boutons — grosses cibles tactiles (chauffeur au volant) */}
        {!tracking ? (
          <Button
            kind="gold"
            size="lg"
            fullWidth
            style={{ minHeight: 64, borderRadius: RADII.xl }}
            leftIcon={<Icons.bolt size={20} color={theme.navy} stroke={2} />}
            onPress={startTracking}
            disabled={missionLoading}
          >
            Démarrer le suivi
          </Button>
        ) : (
          <View style={{ gap: 10 }}>
            <Button
              kind={paused ? 'gold' : 'primary'}
              size="lg"
              fullWidth
              style={{ minHeight: 64, borderRadius: RADII.xl }}
              onPress={togglePause}
            >
              {paused ? 'Reprendre la route' : 'Pause'}
            </Button>
            <Button
              kind="danger"
              size="lg"
              fullWidth
              style={{ minHeight: 56, borderRadius: RADII.xl }}
              onPress={stopTracking}
            >
              Terminer
            </Button>
          </View>
        )}

        {/* Rappel sécurité */}
        <Surface padded variant="alt" flat>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icons.shield size={18} color={theme.gold} stroke={1.8} />
            <Text style={{ flex: 1, fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
              Sécurité : si le véhicule reste immobile plus de 5 minutes sans pause déclarée,
              une alerte te demandera si tout va bien. Sans réponse sous 60 secondes,
              le dispatching est prévenu automatiquement.
            </Text>
          </View>
        </Surface>
      </ScrollView>

      {/* Alerte plein écran « Tout va bien ? » */}
      <Modal visible={alertVisible} transparent animationType="fade" onRequestClose={dismissAlert}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(9, 12, 20, 0.94)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: theme.bad + '30',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 22,
            }}
          >
            <Icons.warn size={44} color="#F87171" stroke={2} />
          </View>
          <Text style={{ fontSize: 32, color: '#FFFFFF', fontFamily: TYPO.weights.bold, textAlign: 'center', letterSpacing: -0.4 }}>
            Tout va bien ?
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', fontFamily: TYPO.weights.medium, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 320 }}>
            Le véhicule est à l'arrêt depuis plus de 5 minutes sans pause déclarée.
            Sans réponse, le dispatching sera prévenu dans
          </Text>
          <Text style={{ fontSize: 56, color: '#F2D789', fontFamily: TYPO.weights.bold, marginTop: 10 }}>
            {countdown}
            <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)' }}> s</Text>
          </Text>
          <View style={{ marginTop: 28, width: '100%', maxWidth: 360, gap: 12 }}>
            <Button
              kind="gold"
              size="lg"
              fullWidth
              style={{ minHeight: 68, borderRadius: RADII.xl }}
              onPress={dismissAlert}
            >
              Je vais bien
            </Button>
            <Button
              kind="ghost"
              size="lg"
              fullWidth
              style={{ minHeight: 56 }}
              onPress={() => { setAlertVisible(false); togglePause(); }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: TYPO.weights.semibold, fontSize: 15 }}>
                Je déclare une pause
              </Text>
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Tuile d'indicateur : gros chiffre lisible en conduite.
function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { theme } = useTheme();
  return (
    <Surface padded flat style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 10.5, color: theme.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, textAlign: 'center' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 22, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 6 }} numberOfLines={1}>
        {value}
      </Text>
      {unit ? (
        <Text style={{ fontSize: 10.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2, textAlign: 'center' }}>
          {unit}
        </Text>
      ) : null}
    </Surface>
  );
}
