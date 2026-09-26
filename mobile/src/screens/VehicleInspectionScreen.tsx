import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { Surface } from '../components/Surface';
import { Damage, DamageCode, DAMAGE_META, VehicleDiagram, ViewKey } from '../components/VehicleDiagram';
import { RootStackParamList } from '../navigation/types';
import {
  attachInspectionPhoto,
  createInspection,
  DamagePoint,
  Inspection,
  listInspections,
  signInspection,
  submitInspection,
} from '../api/inspections';
import { notify } from '../utils/notify';
import { SHOT_GROUPS, Shot, shotsFor } from '../utils/inspectionShots';
import { capturePhoto } from '../utils/pickImage';
import { MOTO_ZONES, sketchKindFor } from '../utils/vehicleViews';
import { generateContractPdf } from '../utils/pdf';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'top', label: 'Dessus' },
  { key: 'left', label: 'Gauche' },
  { key: 'right', label: 'Droite' },
  { key: 'front', label: 'Avant' },
  { key: 'rear', label: 'Arrière' },
];

const FUEL_LEVELS = [
  { v: 0, label: '0' },
  { v: 0.25, label: '¼' },
  { v: 0.5, label: '½' },
  { v: 0.75, label: '¾' },
  { v: 1, label: '1' },
];

// Type de véhicule convoyé — détermine le croquis d'état des lieux du contrat
// (voiture / utilitaire / poids lourd / moto). Les clés correspondent aux
// catégories reconnues par le générateur PDF (generateContractPdf).
const VEHICLE_TYPES: { key: string; label: string }[] = [
  { key: 'Berline', label: 'Voiture' },
  { key: 'Utilitaire', label: 'Utilitaire' },
  { key: 'Poids lourd', label: 'Poids lourd' },
  { key: 'Moto', label: 'Moto' },
];

const STEPS = ['Véhicule', 'Carrosserie', 'Validation', 'Signatures'];

// Contrôles Oui/Non que le client valide (inspiré du flux moDel — étape 8).
// Adaptés à la phase : prise en charge (départ) vs restitution (arrivée).
const CONTROL_QUESTIONS: Record<'DÉPART' | 'ARRIVÉE', { key: string; label: string; short: string }[]> = {
  'DÉPART': [
    { key: 'clean', label: 'Véhicule propre et présentable', short: 'propreté' },
    { key: 'docs', label: 'Documents de bord présents (carte grise, assurance)', short: 'docs' },
    { key: 'equip', label: 'Équipements présents (roue de secours, gilet, triangle)', short: 'équip.' },
  ],
  'ARRIVÉE': [
    { key: 'cleanInt', label: 'Propre et exempt de dommages intérieurs', short: 'int.' },
    { key: 'cleanExt', label: 'Propre et exempt de dommages extérieurs', short: 'ext.' },
    { key: 'place', label: 'Livré au bon endroit et au bon moment', short: 'lieu' },
  ],
};

// Correspondance avec les étiquettes de photo du serveur (InspectionPhotoTag).

/** Les tracés du pavé de signature, en image SVG transmissible au serveur. */
function svgDataUrl(sig: { paths: string[]; w: number; h: number }): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sig.w}" height="${sig.h}" viewBox="0 0 ${sig.w} ${sig.h}">` +
    sig.paths
      .map((d) => `<path d="${d}" fill="none" stroke="#0B2545" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('') +
    '</svg>';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}


// Persistance entre l'état des lieux de DÉPART et d'ARRIVÉE pour pouvoir
// comparer (km, carburant, dommages déjà signalés au départ).
interface SavedInspection {
  km?: number;
  fuel?: number | null;
  damages: Damage[];
  date: string;
  vehiclePhotos?: Record<string, string>;
  vehicleCategory?: string;
  clientName?: string;
}
const STORAGE_KEY_PREFIX = 'axis.inspection.v1.';
const storageKey = (reference: string, phase: 'DÉPART' | 'ARRIVÉE') =>
  `${STORAGE_KEY_PREFIX}${reference}.${phase}`;

export function VehicleInspectionScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VehicleInspection'>>();
  const driverName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Chauffeur Axis';
  const phase = route.params?.phase ?? 'DÉPART';
  // Sans mission réelle (mode démo du convoyeur), l'état des lieux ne peut
  // être rattaché à rien : il reste local et on le dit.
  const missionId = route.params?.missionId;
  const reference = route.params?.reference ?? route.params?.missionId ?? 'sans-reference';
  const vehicleLabel = route.params?.vehicleLabel ?? 'Véhicule';
  const isArrival = phase === 'ARRIVÉE';

  const [step, setStep] = useState(0);

  // État des lieux de DÉPART (chargé en arrivée)
  const [departureRef, setDepartureRef] = useState<SavedInspection | null>(null);
  // Sa version serveur, qui seule dit si les deux parties l'ont signé.
  const [departureServer, setDepartureServer] = useState<Inspection | null>(null);
  const [sending, setSending] = useState(false);

  // Step 1
  const [vehicleCategory, setVehicleCategory] = useState<string>('Berline');
  const [clientName, setClientName] = useState<string>(route.params?.clientName ?? '');
  const [km, setKm] = useState('');
  const [fuel, setFuel] = useState<number | null>(null);
  const [keys, setKeys] = useState('2');
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, string>>({});

  const captureVehiclePhoto = async (key: string): Promise<boolean> => {
    const uri = await capturePhoto();
    if (uri) setVehiclePhotos((p) => ({ ...p, [key]: uri }));
    return !!uri;
  };
  // Mode guidé : chaque prise de vue est annoncée (où se placer, quoi
  // cadrer) avant d'ouvrir l'appareil photo, puis on enchaîne sur la suivante.
  const [guided, setGuided] = useState<Shot | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const failedPhotosRef = useRef<{ inspectionId: string; items: { uri: string; tag: string; caption: string }[] }>({ inspectionId: '', items: [] });

  // Step 2
  const [view, setView] = useState<ViewKey>('top');
  const shots = shotsFor(sketchKindFor(vehicleCategory));
  const nextMissingShot = (after?: string) => {
    const start = after ? shots.findIndex((x) => x.key === after) + 1 : 0;
    return [...shots.slice(start), ...shots.slice(0, start)].find((x) => !vehiclePhotos[x.key] && x.key !== after) ?? null;
  };
  const [damages, setDamages] = useState<Damage[]>([]);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number; zone?: string } | null>(null);
  const [editing, setEditing] = useState<Damage | null>(null);

  // Step 3 (Validation client) — réponses Oui/Non aux contrôles + acceptation.
  const [controls, setControls] = useState<Record<string, boolean>>({});
  const [clientAccepted, setClientAccepted] = useState(false);
  const controlQuestions = CONTROL_QUESTIONS[phase];

  // Step 4 (Signatures)
  const [driverSigned, setDriverSigned] = useState(false);
  const [clientSigned, setClientSigned] = useState(false);
  const driverPad = useRef<SignaturePadHandle>(null);
  const clientPad = useRef<SignaturePadHandle>(null);

  const sketchKind = sketchKindFor(vehicleCategory);
  // Moto : un seul écran de zones, sans vues.
  const viewDamages = sketchKind === 'moto' ? damages : damages.filter((d) => d.view === view);

  const addDamage = (x: number, y: number, zone?: string) => setPendingPos({ x, y, zone });

  const confirmDamage = async (code: DamageCode, withPhoto: boolean) => {
    const pos = pendingPos;
    if (!pos) return;
    let photoUri: string | undefined;
    if (withPhoto) {
      photoUri = (await capturePhoto()) ?? undefined;
    }
    setDamages((prev) => [
      ...prev,
      { id: `d${Date.now()}`, view: sketchKind === 'moto' ? 'top' : view, x: pos.x, y: pos.y, zone: pos.zone, code, photo: !!photoUri, photoUri },
    ]);
    setPendingPos(null);
  };

  const removeDamage = (id: string) => {
    setDamages((prev) => prev.filter((d) => d.id !== id));
    setEditing(null);
  };

  // Charge le DÉPART au montage si on est en ARRIVÉE.
  //
  // Le serveur fait foi : le départ a pu être fait par un autre convoyeur, ou
  // sur un téléphone qui n'est plus là. Le cache local ne sert que si l'API
  // est injoignable — auparavant il était la seule source, et une arrivée
  // ouverte sur un autre appareil imprimait un PV au départ vide.
  useEffect(() => {
    if (!isArrival) return;
    let cancelled = false;

    const applyLocal = async () => {
      const raw = await AsyncStorage.getItem(storageKey(reference, 'DÉPART')).catch(() => null);
      if (!raw || cancelled) return;
      try {
        const parsed = JSON.parse(raw) as SavedInspection;
        setDepartureRef(parsed);
        if (parsed.vehicleCategory) setVehicleCategory(parsed.vehicleCategory);
        if (!route.params?.clientName && parsed.clientName) setClientName(parsed.clientName);
      } catch { /* cache illisible : on repart de zéro */ }
    };

    (async () => {
      if (!missionId) { await applyLocal(); return; }
      try {
        const list = await listInspections(missionId);
        const dep = list.find((i) => i.type === 'PRE_DEPARTURE');
        if (cancelled) return;
        if (!dep) { await applyLocal(); return; }
        setDepartureServer(dep);
        setDepartureRef({
          km: dep.mileage ?? undefined,
          fuel: dep.fuelLevel != null ? dep.fuelLevel / 100 : null,
          damages: (dep.damages ?? []).map((d, i) => ({
            id: `srv${i}`, view: d.view, x: d.x, y: d.y, zone: d.zone, code: d.code, photo: false,
          })) as Damage[],
          date: new Date(dep.createdAt).toLocaleDateString('fr-FR'),
        });
      } catch {
        await applyLocal();
      }
    })();

    return () => { cancelled = true; };
  }, [isArrival, reference, missionId]);

  /**
   * Transmet l'état des lieux : création, photos, soumission, puis les deux
   * signatures. Chaque étape est tolérante — une photo qui ne passe pas ne
   * doit pas faire perdre le procès-verbal.
   *
   * Renvoie false si le PV n'a pas pu être enregistré côté serveur, pour que
   * le convoyeur en soit informé au lieu de le croire transmis.
   */
  const sendToServer = async (p: {
    kmNum?: number;
    fuelV?: number;
    damagePoints: DamagePoint[];
    finalObs: string;
    driverSig?: { paths: string[]; w: number; h: number } | null;
    clientSig?: { paths: string[]; w: number; h: number } | null;
  }): Promise<boolean> => {
    if (!missionId) return false;
    setSending(true);
    try {
      const inspection = await createInspection(missionId, {
        type: isArrival ? 'POST_DELIVERY' : 'PRE_DEPARTURE',
        mileage: p.kmNum,
        // Le serveur attend un pourcentage, le pad un quart de jauge.
        fuelLevel: p.fuelV != null ? Math.round(p.fuelV * 100) : undefined,
        generalNotes: p.finalObs || undefined,
        damages: p.damagePoints,
        controls,
      });

      // Prises de vue du véhicule, puis photos des dommages. Une photo qui
      // échoue est retentée une fois ; les échecs restants sont signalés au
      // convoyeur au lieu d'être perdus en silence.
      const items = [
        ...shots.filter((x) => vehiclePhotos[x.key]).map((x) => ({ uri: vehiclePhotos[x.key], tag: x.tag, caption: x.label })),
        ...damages.filter((d) => d.photoUri).map((d) => ({ uri: d.photoUri as string, tag: 'DAMAGE', caption: `${DAMAGE_META[d.code].label} · ${damagePlace(d)}` })),
      ];
      const failed: typeof items = [];
      setUploadProgress({ done: 0, total: items.length });
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        const ok = (await attachInspectionPhoto(inspection.id, it.uri, it.tag, it.caption))
          || (await attachInspectionPhoto(inspection.id, it.uri, it.tag, it.caption));
        if (!ok) failed.push(it);
        setUploadProgress({ done: i + 1, total: items.length });
      }
      failedPhotosRef.current = { inspectionId: inspection.id, items: failed };

      await submitInspection(inspection.id);

      // Les deux signatures ont été apposées sur ce même appareil, côte à
      // côte, comme sur un constat papier. Celle du client ne peut être
      // envoyée que si le client est bien le compte connecté ; sinon elle
      // figure sur le PDF et le client contresignera depuis son espace.
      const sigUrl = (sig?: { paths: string[]; w: number; h: number } | null) =>
        sig ? svgDataUrl(sig) : null;
      const driverUrl = sigUrl(p.driverSig);
      if (driverUrl) {
        await signInspection(inspection.id, 'DRIVER', driverUrl).catch(() => undefined);
      }
      const clientUrl = sigUrl(p.clientSig);
      if (clientUrl) {
        await signInspection(inspection.id, 'CLIENT', clientUrl).catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    } finally {
      setUploadProgress(null);
      setSending(false);
    }
  };

  const finish = async () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR');
    const timeStr = today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const kmNum = km ? parseInt(km, 10) : undefined;
    const fuelV = (fuel ?? undefined) as 0 | 0.25 | 0.5 | 0.75 | 1 | undefined;
    const obsText = summarizeDamages(damages);
    // Synthèse des contrôles client Oui/Non → ajoutée aux observations du PV.
    const answered = controlQuestions.filter((q) => controls[q.key] !== undefined);
    const controlSummary = answered.length
      ? `Contrôle client : ${answered.map((q) => `${q.short} ${controls[q.key] ? 'OK' : 'NON'}`).join(' · ')}.`
      : '';
    const finalObs = [controlSummary, obsText].filter(Boolean).join(' ');
    const damagePoints = damages.map((d) => ({ view: d.view, x: d.x, y: d.y, code: d.code, ...(d.zone ? { zone: d.zone } : {}) }));
    // Signatures manuscrites captées sur le pad (rendu vectoriel dans le PDF).
    const driverSig = driverPad.current?.toPaths() ?? undefined;
    const clientSig = clientPad.current?.toPaths() ?? undefined;

    // Persiste l'état des lieux pour cette phase (cache local, comparaison).
    await AsyncStorage.setItem(
      storageKey(reference, phase),
      // Sans les photos : 20 images dépassent la capacité du stockage du
      // navigateur (≈ 5 Mo) et faisaient échouer la finalisation.
      JSON.stringify({ km: kmNum, fuel: fuelV, damages: damages.map(({ photoUri: _p, ...d }) => d), date: dateStr, vehicleCategory, clientName } as SavedInspection),
    );

    // Envoi au serveur : c'est ce qui rend le PV opposable. Sans cela il ne
    // restait que dans le téléphone du convoyeur, invisible du client comme
    // d'Axis, et perdu avec l'appareil.
    const sent = await sendToServer({ kmNum, fuelV, damagePoints, finalObs, driverSig, clientSig });

    if (isArrival) {
      // PV de livraison : embarque DÉPART + ARRIVÉE dans le même contrat.
      await generateContractPdf({
        reference,
        copyLabel: 'EXEMPLAIRE\nCLIENT',
        vehicleCategory,
        driverName,
        clientName,
        vehicleBrandModel: vehicleLabel.split('·')[0].trim(),
        plate: vehicleLabel.split('·')[1]?.trim(),
        pickupDate: departureRef?.date ?? dateStr,
        deliveryDate: dateStr,
        deliveryTime: timeStr,
        // DÉPART récupéré du précédent état des lieux
        departureKm: departureRef?.km,
        departureFuel: (departureRef?.fuel ?? undefined) as 0 | 0.25 | 0.5 | 0.75 | 1 | undefined,
        departureDate: departureRef?.date,
        departureObservations: departureRef ? summarizeDamages(departureRef.damages) : undefined,
        // L'existence d'un relevé de départ ne prouve pas qu'il a été signé :
        // seul le serveur le sait. Sans lui, on n'affirme rien.
        departureClientSigned: !!departureServer?.clientSignedAt,
        departureClientSignedDate: departureServer?.clientSignedAt
          ? new Date(departureServer.clientSignedAt).toLocaleDateString('fr-FR')
          : undefined,
        departureDriverSigned: !!departureServer?.driverSignedAt,
        departureDamages: departureRef?.damages.map((d) => ({ view: d.view, x: d.x, y: d.y, code: d.code, ...(d.zone ? { zone: d.zone } : {}) })) ?? [],
        // ARRIVÉE = ce qui vient d'être saisi
        arrivalKm: kmNum,
        arrivalFuel: fuelV,
        arrivalDate: dateStr,
        arrivalTime: timeStr,
        arrivalObservations: finalObs,
        arrivalClientSigned: clientSigned,
        arrivalClientSignedDate: dateStr,
        arrivalDriverSigned: driverSigned,
        arrivalDamages: damagePoints,
        arrivalDriverSignature: driverSig,
        arrivalClientSignature: clientSig,
      });
      notify(
        'PV de livraison finalisé',
        sent
          ? 'Le PV est transmis à Axis et au client. Le contrat avec les deux états des lieux a été téléchargé.'
          : 'Le contrat a été téléchargé. Le PV n\'a pas pu être transmis : reprends-le une fois la connexion revenue.',
      );
    } else {
      // PV de prise en charge : juste le DÉPART
      await generateContractPdf({
        reference,
        copyLabel: 'EXEMPLAIRE\nCLIENT',
        vehicleCategory,
        driverName,
        clientName,
        vehicleBrandModel: vehicleLabel.split('·')[0].trim(),
        plate: vehicleLabel.split('·')[1]?.trim(),
        pickupDate: dateStr,
        departureKm: kmNum,
        departureFuel: fuelV,
        departureDate: dateStr,
        departureTime: timeStr,
        departureObservations: finalObs,
        departureClientSigned: clientSigned,
        departureClientSignedDate: dateStr,
        departureDriverSigned: driverSigned,
        departureDamages: damagePoints,
        departureDriverSignature: driverSig,
        departureClientSignature: clientSig,
      });
      notify(
        'PV de prise en charge finalisé',
        sent
          ? 'Le PV est transmis à Axis et au client. L\'état des lieux d\'arrivée sera signé à la livraison.'
          : 'Le contrat a été téléchargé. Le PV n\'a pas pu être transmis : reprends-le une fois la connexion revenue.',
      );
    }
    await offerPhotoRetry();
    nav.goBack();
  };

  // Photos non transmises (réseau faible sur le parking) : on propose de
  // réessayer tant que le convoyeur est encore sur l'écran.
  const offerPhotoRetry = async (): Promise<void> => {
    let pending = failedPhotosRef.current;
    while (pending.inspectionId && pending.items.length > 0) {
      const n = pending.items.length;
      const retry = await askYesNo(
        `${n} photo${n > 1 ? 's' : ''} non transmise${n > 1 ? 's' : ''}`,
        'Le PV est enregistré, mais ces photos ne sont pas encore arrivées chez Axis. Réessayer maintenant (de préférence avec du réseau) ?',
        'Réessayer',
      );
      if (!retry) {
        notify('Photos en attente', `${n} photo(s) non transmise(s). Garde-les dans ta galerie et préviens Axis.`);
        return;
      }
      setSending(true);
      const still: typeof pending.items = [];
      setUploadProgress({ done: 0, total: n });
      for (let i = 0; i < n; i += 1) {
        const it = pending.items[i];
        if (!(await attachInspectionPhoto(pending.inspectionId, it.uri, it.tag, it.caption))) still.push(it);
        setUploadProgress({ done: i + 1, total: n });
      }
      setUploadProgress(null);
      setSending(false);
      pending = { inspectionId: pending.inspectionId, items: still };
      failedPhotosRef.current = pending;
    }
  };

  const photosDone = shots.filter((x) => vehiclePhotos[x.key]).length;
  const allVehiclePhotos = photosDone === shots.length;
  const canNext =
    step === 0 ? !!km && fuel !== null && allVehiclePhotos :
    step === 1 ? true :
    step === 2 ? clientAccepted :
    driverSigned && clientSigned;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title={isArrival ? 'État des lieux — ARRIVÉE' : 'État des lieux — DÉPART'}
        subtitle={isArrival ? `${vehicleLabel} · PV de livraison` : `${vehicleLabel} · PV de prise en charge`}
      />

      {/* Stepper */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: i <= step ? theme.gold : theme.bgSoft }} />
            <Text style={{ fontSize: 10.5, color: i === step ? theme.ink : theme.muted, fontFamily: i === step ? TYPO.weights.semibold : TYPO.weights.medium }}>
              {i + 1}. {s}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 24, gap: 14 }}>
        {/* Sans convoyage rattaché, le PV ne part nulle part : il faut le
            dire avant que le convoyeur ne passe vingt minutes à le remplir. */}
        {!missionId ? (
          <Banner
            tone="warn"
            title="État des lieux non rattaché"
            message="Aucun convoyage n'est associé : ce relevé restera sur ce téléphone et ne sera transmis ni au client ni à Axis. Ouvre-le depuis la mission concernée."
          />
        ) : null}

        {/* Bannière comparative DÉPART (uniquement en ARRIVÉE) */}
        {isArrival && departureRef ? (
          <Surface padded flat style={{ padding: 14, backgroundColor: theme.surface2, borderColor: theme.gold + '40', borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icons.shield size={16} color={theme.gold} stroke={1.8} />
              <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.9, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Rappel état des lieux DÉPART · {departureRef.date}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap' }}>
              <RefKv label="Kilométrage" value={departureRef.km ? `${departureRef.km.toLocaleString('fr-FR')} km` : '—'} />
              <RefKv label="Carburant" value={fuelLabel(departureRef.fuel ?? null)} />
              <RefKv label="Dommages" value={`${departureRef.damages.length} signalé${departureRef.damages.length > 1 ? 's' : ''}`} />
            </View>
            {km && departureRef.km ? (
              <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 10 }}>
                Distance parcourue : <Text style={{ fontFamily: TYPO.weights.bold }}>{Math.max(0, parseInt(km, 10) - departureRef.km).toLocaleString('fr-FR')} km</Text>
              </Text>
            ) : null}
          </Surface>
        ) : null}

        {isArrival && !departureRef ? (
          <Surface padded flat style={{ padding: 14, backgroundColor: theme.warn + '15', borderColor: theme.warn + '40', borderWidth: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icons.warn size={18} color={theme.warn} stroke={1.8} />
            <Text style={{ flex: 1, fontSize: 12.5, color: theme.warn, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
              État des lieux de DÉPART non retrouvé pour ce dossier. Le PV de livraison sera généré sans comparaison automatique.
            </Text>
          </Surface>
        ) : null}

        {step === 0 ? (
          <>
            <Surface padded style={{ padding: 16, gap: 14 }}>
              <View>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Type de véhicule
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {VEHICLE_TYPES.map((t) => {
                    const on = vehicleCategory === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => setVehicleCategory(t.key)}
                        style={{ flexGrow: 1, minWidth: '46%', height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: on ? theme.navy : theme.line, backgroundColor: on ? theme.navy : theme.surface, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 14, color: on ? '#F5F1E8' : theme.ink, fontFamily: on ? TYPO.weights.bold : TYPO.weights.semibold }}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 6 }}>
                  Détermine le croquis d'état des lieux sur le contrat.
                </Text>
              </View>
              <Field label="Kilométrage" value={km} onChangeText={setKm} keyboardType="numeric" placeholder="48 230" hint="Relevé au compteur" />
              <View>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Niveau de carburant
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {FUEL_LEVELS.map((f) => {
                    const on = fuel === f.v;
                    return (
                      <Pressable
                        key={f.v}
                        onPress={() => setFuel(f.v)}
                        style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: on ? theme.navy : theme.line, backgroundColor: on ? theme.navy : theme.surface, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 16, color: on ? '#F5F1E8' : theme.ink, fontFamily: TYPO.weights.bold }}>{f.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Field label="Nombre de clés remises" value={keys} onChangeText={setKeys} keyboardType="numeric" />
            </Surface>

            <Surface padded style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Photos du véhicule
                </Text>
                <Pill tone={allVehiclePhotos ? 'good' : 'warn'}>{`${photosDone}/${shots.length}`}</Pill>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.line, overflow: 'hidden' }}>
                <View style={{ width: `${(photosDone / shots.length) * 100}%`, height: '100%', backgroundColor: allVehiclePhotos ? theme.good : theme.gold }} />
              </View>
              <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 16 }}>
                {shots.length} photos obligatoires, au départ comme à l'arrivée : c'est la preuve de l'état du véhicule en cas de litige. Photographie en pleine lumière, véhicule entier dans le cadre.
              </Text>
              {!allVehiclePhotos ? (
                <Button
                  kind="primary"
                  size="md"
                  fullWidth
                  leftIcon={<Icons.camera size={17} color="#fff" stroke={1.9} />}
                  onPress={() => setGuided(nextMissingShot())}
                >
                  {photosDone === 0 ? 'Prendre les photos à la suite' : `Continuer (${shots.length - photosDone} restantes)`}
                </Button>
              ) : null}
              {SHOT_GROUPS.map((g) => {
                const list = shots.filter((x) => x.group === g);
                if (list.length === 0) return null;
                return (
                  <View key={g} style={{ gap: 8 }}>
                    <Text style={{ fontSize: 12, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                      {g} · {list.filter((x) => vehiclePhotos[x.key]).length}/{list.length}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
                      {list.map((a, idx) => {
                        const uri = vehiclePhotos[a.key];
                        return (
                          <Pressable
                            key={a.key}
                            onPress={() => setGuided(a)}
                            style={{ width: '31.5%', marginRight: idx % 3 === 2 ? 0 : '2.75%', aspectRatio: 1, borderRadius: 10, borderWidth: 1.5, borderColor: uri ? theme.good : theme.line, borderStyle: uri ? 'solid' : 'dashed', backgroundColor: theme.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                          >
                            {uri ? (
                              <>
                                <Image source={{ uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
                                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.58)', paddingVertical: 3, paddingHorizontal: 2 }}>
                                  <Text numberOfLines={1} style={{ color: '#fff', fontSize: 10, fontFamily: TYPO.weights.semibold, textAlign: 'center' }}>✓ {a.label}</Text>
                                </View>
                              </>
                            ) : (
                              <>
                                <Icons.camera size={18} color={theme.muted} stroke={1.7} />
                                <Text numberOfLines={2} style={{ fontSize: 10.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 4, textAlign: 'center' }}>{a.label}</Text>
                              </>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </Surface>

            {/* Prise de vue guidée : consigne, puis appareil photo. */}
            <Modal visible={!!guided} transparent animationType="fade" onRequestClose={() => setGuided(null)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.6)', justifyContent: 'flex-end' }}>
                {guided ? (
                  <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28, gap: 12 }}>
                    <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                      Photo {shots.findIndex((x) => x.key === guided.key) + 1} sur {shots.length} · {guided.group}
                    </Text>
                    <Text style={{ fontSize: 20, color: theme.ink, fontFamily: TYPO.weights.bold }}>{guided.label}</Text>
                    <Text style={{ fontSize: 14, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 20 }}>{guided.hint}</Text>
                    {vehiclePhotos[guided.key] ? (
                      <Image source={{ uri: vehiclePhotos[guided.key] }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
                    ) : null}
                    <Button
                      kind="gold"
                      size="lg"
                      fullWidth
                      leftIcon={<Icons.camera size={18} color={theme.navy} stroke={1.9} />}
                      onPress={async () => {
                        const current = guided;
                        const ok = await captureVehiclePhoto(current.key);
                        if (!ok) return;
                        // Enchaîne sur la prochaine photo manquante.
                        const next = shots.find((x, i) => i > shots.findIndex((y) => y.key === current.key) && !vehiclePhotos[x.key] && x.key !== current.key)
                          ?? shots.find((x) => !vehiclePhotos[x.key] && x.key !== current.key)
                          ?? null;
                        setGuided(next);
                      }}
                    >
                      {vehiclePhotos[guided.key] ? 'Reprendre la photo' : 'Prendre la photo'}
                    </Button>
                    <Button kind="ghost" size="md" fullWidth onPress={() => setGuided(null)}>
                      Terminer plus tard
                    </Button>
                  </View>
                ) : null}
              </View>
            </Modal>
            <Surface padded style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icons.shield size={20} color={theme.gold} stroke={1.8} />
              <Text style={{ flex: 1, fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
                Photos, kilométrage et signatures sont horodatés et enregistrés chez Axis : ils font foi en cas de litige.
              </Text>
            </Surface>
          </>
        ) : step === 1 ? (
          <>
            {/* Sélecteur de vue (pas pour une moto : zones) */}
            {sketchKind !== 'moto' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {VIEWS.map((v) => {
                const on = view === v.key;
                const count = damages.filter((d) => d.view === v.key).length;
                return (
                  <Pressable
                    key={v.key}
                    onPress={() => setView(v.key)}
                    style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? theme.select : theme.line, backgroundColor: on ? theme.select : theme.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Text style={{ fontSize: 13, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.medium }}>{v.label}</Text>
                    {count > 0 ? <Text style={{ fontSize: 11, color: on ? theme.selectInk : theme.gold, fontFamily: TYPO.weights.bold }}>{count}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            ) : null}

            <VehicleDiagram kind={sketchKind} view={view} damages={viewDamages} onAdd={addDamage} onMarkerPress={(id) => setEditing(damages.find((d) => d.id === id) ?? null)} height={280} />

            {/* Légende codes */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(DAMAGE_META) as DamageCode[]).map((c) => (
                <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: DAMAGE_META[c].color, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{c}</Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>{DAMAGE_META[c].label}</Text>
                </View>
              ))}
            </View>

            {/* Liste des dommages */}
            {damages.length > 0 ? (
              <Surface padded style={{ padding: 14 }}>
                <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginBottom: 8 }}>
                  {damages.length} dommage{damages.length > 1 ? 's' : ''} enregistré{damages.length > 1 ? 's' : ''}
                </Text>
                {damages.map((d) => (
                  <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.lineSoft }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: DAMAGE_META[d.code].color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{d.code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{DAMAGE_META[d.code].label}</Text>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                        {damagePlace(d)}{d.photoUri ? ' · 📷 photo jointe' : ''}
                      </Text>
                    </View>
                    {d.photoUri ? (
                      <Image source={{ uri: d.photoUri }} style={{ width: 34, height: 34, borderRadius: 8 }} resizeMode="cover" />
                    ) : null}
                    <Pressable onPress={() => removeDamage(d.id)} style={{ padding: 6 }}>
                      <Icons.x size={15} color={theme.muted} stroke={2} />
                    </Pressable>
                  </View>
                ))}
              </Surface>
            ) : (
              <Surface padded style={{ padding: 16, alignItems: 'center', gap: 4 }}>
                <Icons.check size={22} color={theme.good} stroke={2.2} />
                <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Aucun dommage signalé</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
                  Touche le schéma pour marquer un point si tu constates un défaut.
                </Text>
              </Surface>
            )}
          </>
        ) : step === 2 ? (
          <>
            {/* Remise du téléphone au client pour vérification (moDel étape 4-5) */}
            <Surface padded flat style={{ padding: 14, backgroundColor: theme.navy, borderColor: theme.navy, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(201,165,92,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.phone size={20} color={theme.gold} stroke={1.9} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: '#F5F1E8', fontFamily: TYPO.weights.bold }}>Remets le téléphone au client</Text>
                <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.75)', fontFamily: TYPO.weights.medium, marginTop: 2, lineHeight: 16 }}>
                  Le client vérifie l'état relevé avant de signer.
                </Text>
              </View>
            </Surface>

            {/* Récapitulatif de ce que le chauffeur a relevé */}
            <Surface padded style={{ padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Récapitulatif — {isArrival ? 'arrivée' : 'départ'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                <RefKv label="Véhicule" value={vehicleCategory} />
                <RefKv label="Kilométrage" value={km ? `${parseInt(km, 10).toLocaleString('fr-FR')} km` : '—'} />
                <RefKv label="Carburant" value={fuelLabel(fuel)} />
                <RefKv label="Dommages" value={`${damages.length}`} />
                <RefKv label="Photos" value={`${photosDone}/${shots.length}`} />
              </View>
              {damages.length > 0 ? (
                <View style={{ gap: 6, marginTop: 2 }}>
                  {damages.map((d) => (
                    <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: DAMAGE_META[d.code].color, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{d.code}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
                        {DAMAGE_META[d.code].label} · {damagePlace(d)}{d.photoUri ? ' · 📷' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 12.5, color: theme.good, fontFamily: TYPO.weights.semibold }}>
                  Aucun dommage constaté — véhicule en bon état.
                </Text>
              )}
            </Surface>

            {/* Contrôles Oui/Non vérifiés par le client (moDel étape 8) */}
            <Surface padded style={{ padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Contrôles du client
              </Text>
              {controlQuestions.map((q) => {
                const val = controls[q.key];
                return (
                  <View key={q.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ flex: 1, fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>{q.label}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable
                        onPress={() => setControls((c) => ({ ...c, [q.key]: true }))}
                        style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, borderColor: val === true ? theme.good : theme.line, backgroundColor: val === true ? theme.good : theme.surface }}
                      >
                        <Text style={{ fontSize: 12.5, color: val === true ? '#fff' : theme.ink, fontFamily: TYPO.weights.bold }}>Oui</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setControls((c) => ({ ...c, [q.key]: false }))}
                        style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, borderColor: val === false ? theme.bad : theme.line, backgroundColor: val === false ? theme.bad : theme.surface }}
                      >
                        <Text style={{ fontSize: 12.5, color: val === false ? '#fff' : theme.ink, fontFamily: TYPO.weights.bold }}>Non</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </Surface>

            {/* Validation client (case à cocher, moDel étape 8) */}
            <Pressable
              onPress={() => setClientAccepted((v) => !v)}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: RADII.lg, borderWidth: 1.5, borderColor: clientAccepted ? theme.good : theme.line, backgroundColor: clientAccepted ? theme.good + '12' : theme.surface }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: clientAccepted ? theme.good : theme.line, backgroundColor: clientAccepted ? theme.good : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                {clientAccepted ? <Icons.check size={15} color="#fff" stroke={3} /> : null}
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
                Le client confirme avoir vérifié l'état du véhicule (extérieur et intérieur) et
                <Text style={{ fontFamily: TYPO.weights.bold }}> accepte cet état des lieux</Text>.
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <SignatureBlock title="Signature du conducteur" who={driverName} padRef={driverPad} onSign={setDriverSigned} signed={driverSigned} />
            <SignatureBlock title={isArrival ? 'Signature du destinataire' : 'Signature du client'} who={isArrival ? 'Personne qui réceptionne le véhicule' : 'À faire signer au client'} padRef={clientPad} onSign={setClientSigned} signed={clientSigned} />
            <Surface padded style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icons.warn size={18} color={theme.gold} stroke={1.8} />
              <Text style={{ flex: 1, fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
                Les deux signatures valident l'état des lieux. Signature électronique simple au sens du règlement (UE) n° 910/2014 (eIDAS, art. 25) : recevable comme preuve, sans présomption de fiabilité.
              </Text>
            </Surface>
          </>
        )}
      </ScrollView>

      {/* Footer nav */}
      <View style={{ flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface }}>
        {step > 0 ? (
          <Button kind="outline" size="lg" onPress={() => setStep((s) => s - 1)}>Retour</Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button kind="gold" size="lg" style={{ flex: 1 }} disabled={!canNext} onPress={() => setStep((s) => s + 1)} rightIcon={<Icons.arrow size={18} color={theme.navy} stroke={2} />}>
            Continuer
          </Button>
        ) : (
          <Button
            kind="gold"
            size="lg"
            style={{ flex: 1 }}
            disabled={!canNext || sending}
            loading={sending}
            onPress={finish}
            rightIcon={sending ? undefined : <Icons.check size={18} color={theme.navy} stroke={2.4} />}
          >
            {sending
              ? (uploadProgress ? `Envoi des photos ${uploadProgress.done}/${uploadProgress.total}…` : 'Transmission du PV…')
              : isArrival
                ? 'Finaliser le PV de livraison'
                : 'Finaliser le PV de prise en charge'}
          </Button>
        )}
      </View>

      {/* Modal choix dommage */}
      <Modal visible={!!pendingPos} transparent animationType="fade" onRequestClose={() => setPendingPos(null)}>
        <Pressable onPress={() => setPendingPos(null)} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderRadius: 20, padding: 18, gap: 14 }}>
            <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>Nature du dommage</Text>
            <View style={{ gap: 8 }}>
              {(Object.keys(DAMAGE_META) as DamageCode[]).map((c) => (
                <View key={c} style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => confirmDamage(c, false)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: DAMAGE_META[c].color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{c}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{DAMAGE_META[c].label}</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDamage(c, true)} style={{ width: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.camera size={18} color={theme.navy} stroke={1.8} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
              Touche 📷 pour joindre une photo au dommage
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal détail marqueur */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable onPress={() => setEditing(null)} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderRadius: 20, padding: 18, gap: 12 }}>
            {editing ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: DAMAGE_META[editing.code].color, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{editing.code}</Text>
                  </View>
                  <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>{DAMAGE_META[editing.code].label}</Text>
                </View>
                <Button kind="outline" size="lg" fullWidth onPress={() => removeDamage(editing.id)} rightIcon={<Icons.x size={16} color={theme.bad} stroke={2} />}>
                  Supprimer ce dommage
                </Button>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SignatureBlock({ title, who, padRef, onSign, signed }: { title: string; who: string; padRef: React.RefObject<SignaturePadHandle | null>; onSign: (v: boolean) => void; signed: boolean }) {
  const { theme } = useTheme();
  return (
    <Surface padded style={{ padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{title}</Text>
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{who}</Text>
        </View>
        {signed ? <Pill tone="good">✓ Signé</Pill> : null}
      </View>
      <SignaturePad ref={padRef} height={150} onChange={onSign} />
      <Pressable onPress={() => { padRef.current?.clear(); onSign(false); }} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 }}>
        <Icons.x size={14} color={theme.muted} stroke={2} />
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Effacer</Text>
      </Pressable>
    </Surface>
  );
}

function RefKv({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 10, color: '#6F6E6B', letterSpacing: 0.7, textTransform: 'uppercase', fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: '#1B1B1F', fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function fuelLabel(v: number | null): string {
  if (v === null) return '—';
  return v === 0 ? 'Vide' : v === 1 ? 'Plein' : v === 0.25 ? '¼' : v === 0.5 ? '½' : v === 0.75 ? '¾' : `${v}`;
}

/** Question Oui / Non qui attend la réponse (web et téléphone). */
function askYesNo(title: string, message: string, yes: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Plus tard', style: 'cancel', onPress: () => resolve(false) },
      { text: yes, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** « Côté gauche », « Réservoir »… : où se trouve le dommage. */
function damagePlace(d: Damage): string {
  if (d.zone) return MOTO_ZONES.find((z) => z.key === d.zone)?.label ?? d.zone;
  return ({ top: 'Dessus', left: 'Côté gauche', right: 'Côté droit', front: 'Avant', rear: 'Arrière' } as Record<string, string>)[d.view] ?? d.view;
}

function summarizeDamages(damages: Damage[]): string {
  if (damages.length === 0) return 'Aucun dommage constaté. Véhicule en parfait état.';
  const byView: Record<string, string[]> = {};
  damages.forEach((d) => {
    const v = damagePlace(d);
    if (!byView[v]) byView[v] = [];
    byView[v].push(`${DAMAGE_META[d.code].label}${d.photo ? ' (photo)' : ''}`);
  });
  return Object.entries(byView).map(([v, list]) => `${v} : ${list.join(', ')}`).join(' · ');
}
