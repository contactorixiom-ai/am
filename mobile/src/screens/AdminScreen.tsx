// Espace admin — poste de travail de Roger, l'opérateur de la plateforme.
// Trois onglets internes (état local, pas de routes dédiées) :
//   1. Générer   — générateur de documents officiels (formulaire → PDF)
//   2. Envois    — missions + colis à traiter à la main, avec actions rapides
//   3. Documents — historique local des documents, filtré par activité
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { listMissions, MissionSummary } from '../api/missions';
import { addParcelEvent, getParcel, listParcels, ParcelStatus, ParcelSummary, ParcelTrackingEvent } from '../api/parcels';
import { Modal } from 'react-native';
import { AdminDocForm } from '../components/AdminDocForm';
import { AppBar } from '../components/AppBar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import {
  ADMIN_DOC_TYPES,
  AdminActivity,
  AdminDocType,
  AdminHistoryEntry,
  AdminValues,
  adminDocTypeById,
  DOC_PACKS,
  DocPack,
  buildDefaults,
  commitReference,
  generateAdminDocument,
  pushAdminHistory,
  readAdminHistory,
} from '../utils/adminDocs';
import { notify } from '../utils/notify';
import { downloadCsv } from '../utils/csv';

// ─── Onglets internes ────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'generate' | 'shipments' | 'documents';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Tableau' },
  { id: 'generate', label: 'Générer' },
  { id: 'shipments', label: 'Envois' },
  { id: 'documents', label: 'Documents' },
];

const ACTIVITY_LABEL: Record<AdminActivity, string> = {
  convoyage: 'Convoyage',
  colis: 'Colis',
  marchandise: 'Marchandise',
};

// Pipeline colis/marchandise que Roger fait avancer à la main (import-export).
const PARCEL_PIPELINE: { status: ParcelStatus; label: string; hint: string }[] = [
  { status: 'AWAITING_DROP_OFF', label: 'À déposer / enlever', hint: 'En attente de prise en charge' },
  { status: 'RECEIVED', label: 'Reçu au hub', hint: 'Colis réceptionné' },
  { status: 'IN_TRANSIT', label: 'En transit', hint: 'Acheminement vers destination' },
  { status: 'CUSTOMS', label: 'En douane', hint: 'Formalités douanières en cours' },
  { status: 'OUT_FOR_DELIVERY', label: 'En livraison', hint: 'Dernier kilomètre' },
  { status: 'DELIVERED', label: 'Livré', hint: 'Remis au destinataire' },
];
const PARCEL_EXCEPTIONS: { status: ParcelStatus; label: string; hint: string }[] = [
  { status: 'CANCELLED', label: 'Annulé', hint: 'Envoi annulé' },
  { status: 'LOST', label: 'Perdu', hint: 'Colis égaré' },
];
const parcelStatusLabel = (status: string): string =>
  [...PARCEL_PIPELINE, ...PARCEL_EXCEPTIONS].find((s) => s.status === status)?.label ?? status;

// ─── Repli démo (hors-ligne) pour l'onglet Envois ───────────────────────────

const DEMO_MISSIONS: MissionSummary[] = [
  {
    id: 'demo-m1',
    reference: 'MIS-2026-0412',
    status: 'IN_PROGRESS',
    pickupCity: 'Paris',
    pickupCountry: 'FR',
    pickupAt: '2026-07-06T08:30:00.000Z',
    deliveryCity: 'Lisbonne',
    deliveryCountry: 'PT',
    vehicle: { make: 'BMW', model: 'Série 3', year: 2022, licensePlate: 'AB-123-CD' },
    driver: { firstName: 'Karim', lastName: 'Diallo' },
  },
];

const DEMO_PARCELS: ParcelSummary[] = [
  {
    id: 'demo-p1',
    reference: 'AX-2026-8841',
    status: 'IN_TRANSIT',
    originCountry: 'FR',
    originCity: 'Paris',
    destinationCountry: 'SN',
    destinationCity: 'Dakar',
    weightKg: 12.5,
  },
  {
    id: 'demo-p2',
    reference: 'AX-2026-8850',
    status: 'CUSTOMS',
    originCountry: 'FR',
    originCity: 'Lyon',
    destinationCountry: 'CI',
    destinationCity: 'Abidjan',
    weightKg: 4,
  },
];


// ─── Pré-remplissage d'une liasse depuis un envoi réel ───────────────────────
// Les clés couvrent l'ensemble des types de documents : chaque formulaire ne
// retient que les champs qu'il déclare, les autres sont simplement ignorés.
const AXIS_SENDER = {
  senderName: 'Axis Import SAS',
  senderAddress: '14 rue de la Logistique, 75015 Paris, France',
  shipperName: 'Axis Import SAS',
  shipperAddress: '14 rue de la Logistique, 75015 Paris, France',
  exporterName: 'Axis Import SAS',
  exporterAddress: '14 rue de la Logistique, 75015 Paris, France',
};

function prefillFromParcel(p: ParcelSummary): AdminValues {
  const weight = p.weightKg != null ? String(p.weightKg) : '';
  return {
    ...AXIS_SENDER,
    reference: p.reference,
    orderRef: p.reference,
    originCountry: p.originCity ? `${p.originCity}, ${p.originCountry}` : p.originCountry,
    originCity: p.originCity,
    destinationCountry: p.destinationCountry,
    destinationCity: p.destinationCity,
    deliveryLocation: `${p.destinationCity} (${p.destinationCountry})`,
    // Amorce d'adresse destinataire : Roger complète le nom et la rue.
    recipientAddress: `${p.destinationCity}, ${p.destinationCountry}`,
    consigneeAddress: `${p.destinationCity}, ${p.destinationCountry}`,
    portOfDischarge: p.destinationCity,
    airportDestination: p.destinationCity,
    weightKg: weight,
    grossWeight: weight,
    transportInfo: `${p.originCity} - ${p.destinationCity}`,
    route: `${p.originCity} (${p.originCountry}) - ${p.destinationCity} (${p.destinationCountry})`,
  };
}

function prefillFromMission(m: MissionSummary): AdminValues {
  const client = m.client ? `${m.client.firstName} ${m.client.lastName}`.trim() : '';
  const driver = m.driver ? `${m.driver.firstName} ${m.driver.lastName}`.trim() : '';
  const pickup = `${m.pickupCity}, ${m.pickupCountry}`;
  const delivery = `${m.deliveryCity}, ${m.deliveryCountry}`;
  return {
    ...AXIS_SENDER,
    reference: m.reference,
    orderRef: m.reference,
    clientName: client,
    recipientName: client,
    consigneeName: client,
    driverName: driver,
    carrierName: 'Axis Import SAS',
    plate: m.vehicle?.licensePlate ?? '',
    vehicleBrandModel: [m.vehicle?.make, m.vehicle?.model].filter(Boolean).join(' '),
    pickupAddress: pickup,
    deliveryAddress: delivery,
    takingOverPlace: m.pickupCity,
    deliveryPlace: m.deliveryCity,
    pickupLocation: pickup,
    deliveryLocation: delivery,
    pickupDate: m.pickupAt ? new Date(m.pickupAt).toLocaleDateString('fr-FR') : '',
    takingOverDate: m.pickupAt ? new Date(m.pickupAt).toLocaleDateString('fr-FR') : '',
    description: `Convoyage ${m.pickupCity} - ${m.deliveryCity}`,
    route: `${m.pickupCity} - ${m.deliveryCity}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function AdminScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<TabId>('dashboard');

  // Onglet Générer
  const [selectedType, setSelectedType] = useState<AdminDocType | null>(null);
  const [formInitial, setFormInitial] = useState<AdminValues | null>(null);
  const [formActivity, setFormActivity] = useState<AdminActivity | null>(null);
  const [generating, setGenerating] = useState(false);

  // Liasse documentaire ouverte (onglet Générer) + envoi auquel elle est rattachée
  const [selectedPack, setSelectedPack] = useState<DocPack | null>(null);
  const [packShipment, setPackShipment] = useState<{ kind: 'parcel' | 'mission'; id: string } | null>(null);

  // Historique (partagé Générer + Documents)
  const [history, setHistory] = useState<AdminHistoryEntry[]>([]);

  // Onglet Envois
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [parcels, setParcels] = useState<ParcelSummary[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  // Avancement de statut d'un colis (modale)
  const [statusParcel, setStatusParcel] = useState<ParcelSummary | null>(null);
  const [advancing, setAdvancing] = useState(false);
  // Journal de suivi du colis ouvert dans la modale (null = en cours de chargement).
  const [statusEvents, setStatusEvents] = useState<ParcelTrackingEvent[] | null>(null);
  // Lieu / note optionnels ajoutés au prochain changement de statut.
  const [eventLocation, setEventLocation] = useState('');
  const [eventNote, setEventNote] = useState('');

  // Onglet Documents
  const [activityFilter, setActivityFilter] = useState<AdminActivity | 'all'>('all');

  useEffect(() => {
    readAdminHistory().then(setHistory);
  }, []);

  const loadShipments = useCallback(async () => {
    const [mRes, pRes] = await Promise.allSettled([listMissions(), listParcels()]);
    const mOk = mRes.status === 'fulfilled';
    const pOk = pRes.status === 'fulfilled';
    if (!mOk && !pOk) {
      // Hors-ligne : envois d'exemple pour que Roger puisse tester le flux.
      setOffline(true);
      setMissions(DEMO_MISSIONS);
      setParcels(DEMO_PARCELS);
    } else {
      setOffline(false);
      setMissions(mOk ? mRes.value.data : []);
      setParcels(pOk ? pRes.value.data : []);
    }
    setShipmentsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // ─── Sélection d'un type de document (avec pré-remplissage éventuel) ──────
  const openDocForm = useCallback(async (
    type: AdminDocType,
    prefill?: AdminValues,
    activity?: AdminActivity,
  ) => {
    try {
      const defaults = await buildDefaults(type);
      setFormInitial({ ...defaults, ...(prefill ?? {}) });
    } catch {
      setFormInitial({ ...(prefill ?? {}) });
    }
    setSelectedType(type);
    setFormActivity(activity ?? null);
    setTab('generate');
  }, []);

  // ─── Génération depuis le formulaire ──────────────────────────────────────
  const handleGenerate = useCallback(async (values: AdminValues) => {
    if (!selectedType) return;
    setGenerating(true);
    try {
      const reference = await generateAdminDocument(selectedType, values);
      await commitReference(selectedType.id);
      const entry: AdminHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        typeId: selectedType.id,
        typeLabel: selectedType.label,
        reference,
        dateISO: new Date().toISOString(),
        activity: formActivity ?? selectedType.activity,
        values,
      };
      setHistory(await pushAdminHistory(entry));
      notify('Document généré', `${selectedType.label} · ${reference}\nLe PDF a été téléchargé.`);
    } catch {
      notify('Échec de la génération', 'Le PDF n\'a pas pu être créé. Vérifie les champs et réessaie.');
    } finally {
      setGenerating(false);
    }
  }, [selectedType, formActivity]);

  // ─── Régénération depuis l'historique (mêmes données) ─────────────────────
  const regenerate = useCallback(async (entry: AdminHistoryEntry) => {
    const type = adminDocTypeById(entry.typeId);
    if (!type) {
      notify('Type inconnu', 'Ce document ne peut plus être régénéré.');
      return;
    }
    try {
      await generateAdminDocument(type, entry.values);
      notify('Document régénéré', `${entry.typeLabel} · ${entry.reference}`);
    } catch {
      notify('Échec de la régénération', 'Le PDF n\'a pas pu être recréé.');
    }
  }, []);

  // ─── Faire avancer le statut d'un colis (import-export) ────────────────────
  const advanceParcel = useCallback(async (parcel: ParcelSummary, status: ParcelStatus) => {
    if (parcel.status === status) return;
    const location = eventLocation.trim() || undefined;
    const notes = eventNote.trim() || undefined;
    setAdvancing(true);
    try {
      // En mode démo (hors-ligne) on met simplement à jour l'état local pour que
      // Roger puisse dérouler le flux ; sinon on notifie le backend (admin only).
      if (!offline && parcel.id && !parcel.id.startsWith('demo')) {
        await addParcelEvent(parcel.id, { status, location, notes });
      }
      setParcels((prev) => prev.map((p) => (p.id === parcel.id ? { ...p, status } : p)));
      // Modale maintenue ouverte : on met à jour l'étape courante et le journal.
      setStatusParcel((cur) => (cur && cur.id === parcel.id ? { ...cur, status } : cur));
      setStatusEvents((prev) => [...(prev ?? []), { status, location, notes, occurredAt: new Date().toISOString() }]);
      setEventLocation('');
      setEventNote('');
      notify('Statut mis à jour', `${parcel.reference} → ${parcelStatusLabel(status)}`);
    } catch {
      notify('Échec de la mise à jour', 'Le statut n\'a pas pu être enregistré. Vérifie ta connexion et tes droits.');
    } finally {
      setAdvancing(false);
    }
  }, [offline, eventLocation, eventNote]);

  // Charge le journal de suivi du colis ouvert dans la modale.
  useEffect(() => {
    if (!statusParcel) { setStatusEvents(null); return; }
    const p = statusParcel;
    let cancelled = false;
    setStatusEvents(null);
    setEventLocation('');
    setEventNote('');
    (async () => {
      if (offline || !p.id || p.id.startsWith('demo')) {
        if (!cancelled) setStatusEvents(p.trackingEvents ?? []);
        return;
      }
      try {
        const full = await getParcel(p.id);
        if (!cancelled) setStatusEvents(full.trackingEvents ?? []);
      } catch {
        if (!cancelled) setStatusEvents(p.trackingEvents ?? []);
      }
    })();
    return () => { cancelled = true; };
  // On ne dépend que de l'id : rafraîchir sur chaque changement de statut ferait
  // clignoter le journal (déjà mis à jour de façon optimiste par advanceParcel).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusParcel?.id, offline]);

  // ─── Export CSV (ouvrable dans le classeur Excel de suivi) ─────────────────
  const exportConvoyages = () => {
    const headers = ['Date', 'Référence', 'Convoyeur', 'Client', 'Véhicule', 'Départ', 'Arrivée', 'Statut'];
    const rows = missions.map((m) => [
      m.pickupAt ? new Date(m.pickupAt).toLocaleDateString('fr-FR') : '',
      m.reference,
      m.driver ? `${m.driver.firstName} ${m.driver.lastName}` : '',
      m.client ? `${m.client.firstName} ${m.client.lastName}` : '',
      `${m.vehicle.make} ${m.vehicle.model}${m.vehicle.licensePlate ? ` (${m.vehicle.licensePlate})` : ''}`,
      `${m.pickupCity} (${m.pickupCountry})`,
      `${m.deliveryCity} (${m.deliveryCountry})`,
      m.status,
    ]);
    const ok = downloadCsv(`convoyages-axis-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    notify(ok ? 'Export CSV' : 'Export indisponible',
      ok ? `${missions.length} convoyage(s) exporté(s). Ouvre le fichier dans Excel.`
         : 'L\'export CSV est disponible sur la version web / bureau.');
  };

  const exportColis = () => {
    const headers = ['Référence', 'Statut', 'Origine', 'Destination', 'Pays destination', 'Poids (kg)'];
    const rows = parcels.map((p) => [
      p.reference,
      parcelStatusLabel(p.status),
      p.originCity,
      p.destinationCity,
      p.destinationCountry,
      p.weightKg,
    ]);
    const ok = downloadCsv(`colis-axis-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    notify(ok ? 'Export CSV' : 'Export indisponible',
      ok ? `${parcels.length} colis exporté(s). Ouvre le fichier dans Excel.`
         : 'L\'export CSV est disponible sur la version web / bureau.');
  };

  // ─── Actions rapides sur un envoi ──────────────────────────────────────────
  const invoiceFromMission = (m: MissionSummary) => {
    openDocForm(
      adminDocTypeById('invoice')!,
      {
        description: `Convoyage ${m.pickupCity} → ${m.deliveryCity} — réf ${m.reference}`,
        clientName: m.driver ? `${m.driver.firstName} ${m.driver.lastName}` : '',
      },
      'convoyage',
    );
  };

  const invoiceFromParcel = (p: ParcelSummary) => {
    openDocForm(
      adminDocTypeById('invoice')!,
      {
        description: `Envoi colis ${p.originCity} → ${p.destinationCity} (${p.weightKg} kg) — réf ${p.reference}`,
      },
      'colis',
    );
  };

  const contractFromMission = (m: MissionSummary) => {
    openDocForm(
      adminDocTypeById('contract')!,
      {
        reference: m.reference,
        vehicleBrandModel: `${m.vehicle.make} ${m.vehicle.model}`,
        plate: m.vehicle.licensePlate ?? '',
        driverName: m.driver ? `${m.driver.firstName} ${m.driver.lastName}` : '',
        pickupAddress: `${m.pickupCity}, ${m.pickupCountry}`,
        deliveryAddress: `${m.deliveryCity}, ${m.deliveryCountry}`,
        pickupDate: m.pickupAt ? new Date(m.pickupAt).toLocaleDateString('fr-FR') : '',
      },
      'convoyage',
    );
  };

  const labelFromParcel = async (p: ParcelSummary) => {
    const type = adminDocTypeById('shippingLabel')!;
    const values: AdminValues = {
      reference: p.reference,
      originCity: p.originCity,
      destinationCity: p.destinationCity,
      destinationCountry: p.destinationCountry,
      recipientName: '',
      recipientPhone: '',
      weightKg: String(p.weightKg),
      transportMode: '',
    };
    try {
      const reference = await generateAdminDocument(type, values);
      const entry: AdminHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        typeId: type.id,
        typeLabel: type.label,
        reference,
        dateISO: new Date().toISOString(),
        activity: 'colis',
        values,
      };
      setHistory(await pushAdminHistory(entry));
      notify('Étiquette générée', `Réf ${reference} — PDF téléchargé.`);
    } catch {
      notify('Échec', 'L\'étiquette n\'a pas pu être générée.');
    }
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Espace admin" subtitle="Gestion Roger · documents & envois" />

      {/* Onglets internes */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: RADII.pill,
                borderWidth: 1,
                alignItems: 'center',
                borderColor: on ? theme.select : theme.line,
                backgroundColor: on ? theme.select : theme.surface,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: on ? theme.selectInk : theme.ink,
                  fontFamily: TYPO.weights.semibold,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          tab === 'shipments' || tab === 'dashboard'
            ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadShipments(); }}
                tintColor={theme.navy}
              />
            )
            : undefined
        }
      >
        {tab === 'dashboard' && renderDashboardTab()}
        {tab === 'generate' && renderGenerateTab()}
        {tab === 'shipments' && renderShipmentsTab()}
        {tab === 'documents' && renderDocumentsTab()}
      </ScrollView>

      {renderStatusModal()}
    </SafeAreaView>
  );

  // ─── Modale : faire avancer le statut d'un colis ───────────────────────────
  function renderStatusModal() {
    const p = statusParcel;
    return (
      <Modal visible={!!p} transparent animationType="slide" onRequestClose={() => setStatusParcel(null)}>
        <Pressable onPress={() => setStatusParcel(null)} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 12, maxHeight: '90%' }}>
            {p ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                      Statut de l'envoi
                    </Text>
                    <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }} numberOfLines={1}>
                      {p.reference}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                      {p.originCity} → {p.destinationCity} ({p.destinationCountry})
                    </Text>
                  </View>
                  <StatusBadge status={p.status} />
                </View>

                {/* Lieu / note ajoutés au prochain changement de statut (facultatif) */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Lieu (option.)" value={eventLocation} onChangeText={setEventLocation} placeholder="Ex. Hub Marseille" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Note (option.)" value={eventNote} onChangeText={setEventNote} placeholder="Ex. Dédouané" />
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  {PARCEL_PIPELINE.map((s, i) => {
                    const current = p.status === s.status;
                    const idx = PARCEL_PIPELINE.findIndex((x) => x.status === p.status);
                    const done = idx >= 0 && i < idx;
                    return (
                      <Pressable
                        key={s.status}
                        disabled={advancing || current}
                        onPress={() => advanceParcel(p, s.status)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: current ? theme.gold : theme.line, backgroundColor: current ? theme.gold + '18' : theme.surface, opacity: advancing ? 0.6 : 1 }}
                      >
                        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: current ? theme.gold : done ? theme.good : theme.bgSoft }}>
                          {done ? <Icons.check size={14} color="#fff" stroke={3} /> : <Text style={{ fontSize: 12, color: current ? theme.navy : theme.muted, fontFamily: TYPO.weights.bold }}>{i + 1}</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, color: theme.ink, fontFamily: current ? TYPO.weights.bold : TYPO.weights.semibold }}>{s.label}</Text>
                          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{s.hint}</Text>
                        </View>
                        {current ? <Pill tone="gold">Actuel</Pill> : <Icons.arrow size={16} color={theme.muted} stroke={1.8} />}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                  {PARCEL_EXCEPTIONS.map((s) => (
                    <Button key={s.status} kind="outline" size="sm" style={{ flex: 1 }} disabled={advancing || p.status === s.status} onPress={() => advanceParcel(p, s.status)}>
                      {s.label}
                    </Button>
                  ))}
                </View>

                {/* Journal de suivi (ce que le client voit aussi) */}
                <View style={{ marginTop: 6, gap: 8 }}>
                  <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                    Journal de suivi
                  </Text>
                  {statusEvents === null ? (
                    <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Chargement…</Text>
                  ) : statusEvents.length === 0 ? (
                    <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                      Aucun événement pour l'instant. Fais avancer le statut pour créer le premier.
                    </Text>
                  ) : (
                    <View style={{ gap: 0 }}>
                      {[...statusEvents].reverse().map((ev, i, arr) => {
                        const when = new Date(ev.occurredAt);
                        const dateLabel = Number.isNaN(when.getTime())
                          ? ''
                          : when.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' · ' + when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                        const latest = i === 0;
                        return (
                          <View key={`${ev.occurredAt}-${i}`} style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ alignItems: 'center', width: 14 }}>
                              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: latest ? theme.gold : theme.line, marginTop: 3 }} />
                              {i < arr.length - 1 ? <View style={{ flex: 1, width: 1.5, backgroundColor: theme.line, marginVertical: 2 }} /> : null}
                            </View>
                            <View style={{ flex: 1, paddingBottom: 10 }}>
                              <Text style={{ fontSize: 13, color: theme.ink, fontFamily: latest ? TYPO.weights.bold : TYPO.weights.semibold }}>
                                {parcelStatusLabel(ev.status)}
                              </Text>
                              <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                                {dateLabel}{ev.location ? ` · ${ev.location}` : ''}{ev.notes ? ` — ${ev.notes}` : ''}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                <Button kind="ghost" size="md" fullWidth onPress={() => setStatusParcel(null)}>
                  Fermer
                </Button>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ─── Onglet 0 : Tableau de bord (poste de commande de Roger) ───────────────
  function renderDashboardTab() {
    const now = new Date();
    const sameMonth = (iso: string) => {
      const d = new Date(iso);
      return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    const parseAmt = (v: unknown): number => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      if (typeof v !== 'string' || !v) return 0;
      const n = parseFloat(v.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    const isPaid = (v: unknown) => v === true || v === 'true';

    const invoices = history.filter((h) => h.typeId === 'invoice');
    const caMonth = invoices.filter((h) => sameMonth(h.dateISO)).reduce((s, h) => s + parseAmt(h.values.amountEur), 0);
    const toCollect = invoices.filter((h) => !isPaid(h.values.paid)).reduce((s, h) => s + parseAmt(h.values.amountEur), 0);
    const inCustoms = parcels.filter((p) => p.status === 'CUSTOMS').length;
    const activeConvoys = missions.filter((m) => m.status === 'IN_PROGRESS').length;
    const toProcess = missions.length + parcels.length;
    const docsMonth = history.filter((h) => sameMonth(h.dateISO)).length;

    const fmtEuro = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

    // File prioritaire : colis en douane (formalités à faire) puis convoyages actifs.
    const priorityParcels = parcels.filter((p) => p.status === 'CUSTOMS' || p.status === 'IN_TRANSIT').slice(0, 4);

    // Documents les plus utilisés au quotidien.
    const quickDocs = ['invoice', 'contract', 'cmr', 'commercialInvoice', 'shippingLabel']
      .map((id) => adminDocTypeById(id))
      .filter((t): t is AdminDocType => !!t);

    // Activité par convoyeur (agrégée depuis les missions chargées).
    const driverMap = new Map<string, { total: number; active: number; done: number }>();
    missions.forEach((m) => {
      const name = m.driver ? `${m.driver.firstName} ${m.driver.lastName}`.trim() : 'Non affecté';
      const cur = driverMap.get(name) ?? { total: 0, active: 0, done: 0 };
      cur.total += 1;
      if (m.status === 'IN_PROGRESS' || m.status === 'ACCEPTED') cur.active += 1;
      if (m.status === 'DELIVERED' || m.status === 'COMPLETED') cur.done += 1;
      driverMap.set(name, cur);
    });
    const drivers = Array.from(driverMap.entries()).sort((a, b) => b[1].total - a[1].total);

    return (
      <>
        {offline ? (
          <Banner
            tone="warn"
            title="Hors ligne — données de démonstration"
            message="Le serveur est injoignable. Les chiffres ci-dessous s'appuient sur des exemples."
            action={{ label: 'Réessayer', onPress: () => { setRefreshing(true); loadShipments(); } }}
          />
        ) : null}

        {/* Chiffres clés */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <DashTile theme={theme} label="Envois à traiter" value={String(toProcess)} tone="navy" onPress={() => setTab('shipments')} />
          <DashTile theme={theme} label="En douane" value={String(inCustoms)} tone={inCustoms > 0 ? 'warn' : 'plain'} onPress={() => setTab('shipments')} />
          <DashTile theme={theme} label="CA facturé (mois)" value={fmtEuro(caMonth)} tone="gold" />
          <DashTile theme={theme} label="À encaisser" value={fmtEuro(toCollect)} tone={toCollect > 0 ? 'warn' : 'plain'} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <DashMini theme={theme} label="Convoyages actifs" value={String(activeConvoys)} icon={<Icons.truck size={15} color={theme.muted} stroke={1.7} />} />
          <DashMini theme={theme} label="Documents (mois)" value={String(docsMonth)} icon={<Icons.doc size={15} color={theme.muted} stroke={1.7} />} />
        </View>

        {/* Génération rapide */}
        <SectionHead title="Générer rapidement" style={{ marginTop: 6 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {quickDocs.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => openDocForm(t)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 13, borderRadius: RADII.pill, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}
            >
              {renderTypeIcon(t, 15, theme.goldDeep)}
              <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Export des données (à ouvrir dans le classeur Excel de suivi) */}
        <SectionHead title="Exporter les données" style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button kind="outline" size="sm" style={{ flex: 1 }} leftIcon={<Icons.truck size={15} color={theme.navy} stroke={1.8} />} onPress={exportConvoyages}>
            Convoyages (CSV)
          </Button>
          <Button kind="outline" size="sm" style={{ flex: 1 }} leftIcon={<Icons.box size={15} color={theme.navy} stroke={1.8} />} onPress={exportColis}>
            Colis (CSV)
          </Button>
        </View>

        {/* À traiter en priorité */}
        {priorityParcels.length > 0 ? (
          <>
            <SectionHead title="À traiter en priorité" style={{ marginTop: 8 }} />
            <View style={{ gap: 8 }}>
              {priorityParcels.map((p) => (
                <Pressable key={`prio-${p.id}`} onPress={() => setStatusParcel(p)}>
                  <Surface padded flat style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: RADII.sm, backgroundColor: p.status === 'CUSTOMS' ? theme.warn + '22' : theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.box size={16} color={p.status === 'CUSTOMS' ? theme.warn : theme.inkSoft} stroke={1.7} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                          {p.reference} · {p.originCity} → {p.destinationCity}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>
                          {p.status === 'CUSTOMS' ? 'Dédouanement à préparer' : 'En transit'} · {p.weightKg} kg
                        </Text>
                      </View>
                      <StatusBadge status={p.status} />
                    </View>
                  </Surface>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* Activité des convoyeurs */}
        {drivers.length > 0 ? (
          <>
            <SectionHead title="Activité des convoyeurs" style={{ marginTop: 8 }} />
            <View style={{ gap: 8 }}>
              {drivers.map(([name, s], i) => (
                <Surface key={`drv-${name}`} padded flat style={{ padding: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: i === 0 ? theme.gold : theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, color: i === 0 ? theme.navy : theme.muted, fontFamily: TYPO.weights.bold }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{name}</Text>
                      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                        {s.active} en cours · {s.done} livré{s.done > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 18, color: theme.ink, fontFamily: TYPO.weights.bold }}>{s.total}</Text>
                      <Text style={{ fontSize: 10, color: theme.muted, fontFamily: TYPO.weights.medium, textTransform: 'uppercase', letterSpacing: 0.5 }}>convoyages</Text>
                    </View>
                  </View>
                </Surface>
              ))}
            </View>
          </>
        ) : null}

        {/* Activité récente */}
        {history.length > 0 ? (
          <>
            <SectionHead title="Activité récente" style={{ marginTop: 8 }} />
            <View style={{ gap: 8 }}>
              {history.slice(0, 4).map((entry) => renderHistoryRow(entry))}
            </View>
          </>
        ) : null}
      </>
    );
  }

  // ─── Onglet 1 : Générer ────────────────────────────────────────────────────
  function renderGenerateTab() {
    if (selectedType && formInitial) {
      return (
        <>
          <Pressable
            onPress={() => { setSelectedType(null); setFormInitial(null); setFormActivity(null); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}
          >
            <Icons.arrowL size={15} color={theme.muted} stroke={1.8} />
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              {selectedPack ? selectedPack.label : 'Tous les types de documents'}
            </Text>
          </Pressable>

          <Surface padded style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: RADII.md,
                  backgroundColor: theme.gold + '26',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {renderTypeIcon(selectedType, 19, theme.goldDeep)}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                  {selectedType.label}
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                  {selectedType.description}
                </Text>
              </View>
              <Pill tone="gold">{ACTIVITY_LABEL[formActivity ?? selectedType.activity]}</Pill>
            </View>

            <AdminDocForm
              docType={selectedType}
              initialValues={formInitial}
              onSubmit={handleGenerate}
              submitting={generating}
            />
          </Surface>
        </>
      );
    }

    // ── Détail d'une liasse : checklist des documents du corridor ──
    if (selectedPack) {
      const pack = selectedPack;
      const doneIds = new Set(history.map((h) => h.typeId));
      const doneCount = pack.items.filter((i) => doneIds.has(i.typeId)).length;

      // Envois proposés : missions pour le convoyage, colis pour le reste.
      const isConvoy = pack.activity === 'convoyage';
      const shipmentOptions = isConvoy
        ? missions.map((m) => ({ kind: 'mission' as const, id: m.id, ref: m.reference, route: `${m.pickupCity} - ${m.deliveryCity}` }))
        : parcels.map((p) => ({ kind: 'parcel' as const, id: p.id, ref: p.reference, route: `${p.originCity} - ${p.destinationCity}` }));
      const chosen = packShipment && shipmentOptions.find((o) => o.id === packShipment.id) ? packShipment : null;
      const packPrefill: AdminValues | undefined = chosen
        ? (chosen.kind === 'mission'
            ? (() => { const m = missions.find((x) => x.id === chosen.id); return m ? prefillFromMission(m) : undefined; })()
            : (() => { const p2 = parcels.find((x) => x.id === chosen.id); return p2 ? prefillFromParcel(p2) : undefined; })())
        : undefined;
      return (
        <>
          <Pressable
            onPress={() => setSelectedPack(null)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}
          >
            <Icons.arrowL size={15} color={theme.muted} stroke={1.8} />
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              Toutes les liasses
            </Text>
          </Pressable>

          <Surface padded style={{ padding: 16, gap: 6 }}>
            <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold }}>{pack.label}</Text>
            <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{pack.subtitle}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.bgSoft, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((doneCount / pack.items.length) * 100)}%`, height: 6, backgroundColor: theme.gold }} />
              </View>
              <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.semibold }}>
                {doneCount}/{pack.items.length}
              </Text>
            </View>
          </Surface>

          {shipmentOptions.length > 0 ? (
            <>
              <SectionHead title="Rattacher à un envoi" style={{ marginTop: 6 }} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {shipmentOptions.map((o) => {
                  const on = chosen?.id === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => setPackShipment(on ? null : { kind: o.kind, id: o.id })}
                      style={{ paddingVertical: 9, paddingHorizontal: 13, borderRadius: RADII.pill, borderWidth: 1.5, borderColor: on ? theme.navy : theme.line, backgroundColor: on ? theme.navy : theme.surface }}
                    >
                      <Text style={{ fontSize: 12.5, color: on ? '#F5F1E8' : theme.ink, fontFamily: TYPO.weights.semibold }}>{o.ref}</Text>
                      <Text style={{ fontSize: 10.5, color: on ? 'rgba(245,241,232,0.75)' : theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>{o.route}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={{ fontSize: 11.5, color: chosen ? theme.good : theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>
                {chosen
                  ? 'Les documents de cette liasse seront pré-remplis avec cet envoi.'
                  : 'Choisis un envoi pour pré-remplir automatiquement tous les documents.'}
              </Text>
            </>
          ) : null}

          <SectionHead title="Documents de la liasse" style={{ marginTop: 6 }} />
          <View style={{ gap: 8 }}>
            {pack.items.map((item) => {
              const t = adminDocTypeById(item.typeId);
              if (!t) return null;
              const done = doneIds.has(item.typeId);
              return (
                <Pressable key={item.typeId} onPress={() => openDocForm(t, packPrefill, pack.activity)}>
                  <Surface padded flat style={{ padding: 13 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                      <View style={{ width: 32, height: 32, borderRadius: RADII.sm, backgroundColor: done ? theme.good + '22' : theme.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
                        {done
                          ? <Icons.check size={16} color={theme.good} stroke={2.6} />
                          : renderTypeIcon(t, 16, theme.goldDeep)}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                            {t.label}
                          </Text>
                          {item.required
                            ? <Pill tone="gold">Requis</Pill>
                            : <Pill tone="ghost">Optionnel</Pill>}
                        </View>
                        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={2}>
                          {item.note ?? t.description}
                        </Text>
                      </View>
                      <Icons.arrow size={16} color={theme.muted} stroke={1.8} />
                    </View>
                  </Surface>
                </Pressable>
              );
            })}
          </View>

          {pack.externalSteps?.length ? (
            <>
              <SectionHead title="À obtenir en dehors de l'app" style={{ marginTop: 8 }} />
              {pack.externalSteps.map((st) => (
                <Surface key={st.label} padded flat style={{ padding: 14, backgroundColor: theme.warn + '14', borderColor: theme.warn + '44', borderWidth: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <Icons.warn size={17} color={theme.warn} stroke={1.9} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.bold }}>{st.label}</Text>
                      <Text style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 3, lineHeight: 16.5 }}>
                        {st.note}
                      </Text>
                      {st.url ? (
                        <Text style={{ fontSize: 11.5, color: theme.goldDeep, fontFamily: TYPO.weights.semibold, marginTop: 4 }}>
                          {st.url}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Surface>
              ))}
            </>
          ) : null}
        </>
      );
    }

    return (
      <>
        <SectionHead title="Liasses — par type d'opération" />
        <View style={{ gap: 8 }}>
          {DOC_PACKS.map((pack) => {
            const doneIds = new Set(history.map((h) => h.typeId));
            const done = pack.items.filter((i) => doneIds.has(i.typeId)).length;
            return (
              <Pressable key={pack.id} onPress={() => setSelectedPack(pack)}>
                <Surface padded flat style={{ padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                    <View style={{ width: 36, height: 36, borderRadius: RADII.md, backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.doc size={18} color={theme.gold} stroke={1.8} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                        {pack.label}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }} numberOfLines={1}>
                        {pack.subtitle}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.semibold }}>
                      {done}/{pack.items.length}
                    </Text>
                    <Icons.arrow size={16} color={theme.muted} stroke={1.8} />
                  </View>
                </Surface>
              </Pressable>
            );
          })}
        </View>

        <SectionHead title="Tous les documents" style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {ADMIN_DOC_TYPES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => openDocForm(t)}
              style={{ width: '48%', flexGrow: 1 }}
            >
              <Surface padded style={{ padding: 12, gap: 8, minHeight: 108 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: RADII.md,
                    backgroundColor: theme.gold + '26',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderTypeIcon(t, 17, theme.goldDeep)}
                </View>
                <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                  {t.label}
                </Text>
                <Text
                  style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 15 }}
                  numberOfLines={2}
                >
                  {t.description}
                </Text>
              </Surface>
            </Pressable>
          ))}
        </View>

        {history.length > 0 ? (
          <>
            <SectionHead title="Derniers documents" style={{ marginTop: 8 }} />
            <View style={{ gap: 8 }}>
              {history.slice(0, 5).map((entry) => renderHistoryRow(entry))}
            </View>
          </>
        ) : null}
      </>
    );
  }

  // ─── Onglet 2 : Envois ─────────────────────────────────────────────────────
  function renderShipmentsTab() {
    const total = missions.length + parcels.length;
    return (
      <>
        {offline ? (
          <Banner
            tone="warn"
            title="Hors ligne — données de démonstration"
            message="Impossible de joindre le serveur. Les envois affichés sont des exemples."
            action={{ label: 'Réessayer', onPress: () => { setShipmentsLoading(true); loadShipments(); } }}
          />
        ) : null}

        <SectionHead title={`Envois à traiter · ${total}`} />

        {shipmentsLoading ? (
          <Skeleton variant="card" count={3} />
        ) : total === 0 ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="box"
              title="Aucun envoi"
              subtitle="Les missions de convoyage et les colis en cours apparaîtront ici pour le traitement manuel."
            />
          </Surface>
        ) : (
          <View style={{ gap: 10 }}>
            {missions.map((m) => (
              <Surface key={`m-${m.id}`} padded style={{ padding: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icons.truck size={16} color={theme.muted} stroke={1.7} />
                  <Text style={{ flex: 1, fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                    {m.reference}
                  </Text>
                  <StatusBadge status={m.status} />
                </View>
                <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
                  {m.pickupCity} → {m.deliveryCity} · {m.vehicle.make} {m.vehicle.model}
                  {m.driver ? ` · ${m.driver.firstName} ${m.driver.lastName}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button kind="outline" size="sm" style={{ flex: 1 }} onPress={() => invoiceFromMission(m)}>
                    Facture
                  </Button>
                  <Button kind="outline" size="sm" style={{ flex: 1 }} onPress={() => contractFromMission(m)}>
                    Contrat
                  </Button>
                </View>
              </Surface>
            ))}

            {parcels.map((p) => (
              <Surface key={`p-${p.id}`} padded style={{ padding: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icons.box size={16} color={theme.muted} stroke={1.7} />
                  <Text style={{ flex: 1, fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                    {p.reference}
                  </Text>
                  <StatusBadge status={p.status} />
                </View>
                <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
                  {p.originCity} → {p.destinationCity} ({p.destinationCountry}) · {p.weightKg} kg
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button kind="primary" size="sm" style={{ flex: 1 }} onPress={() => setStatusParcel(p)}>
                    Statut
                  </Button>
                  <Button kind="outline" size="sm" style={{ flex: 1 }} onPress={() => invoiceFromParcel(p)}>
                    Facture
                  </Button>
                  <Button kind="outline" size="sm" style={{ flex: 1 }} onPress={() => labelFromParcel(p)}>
                    Étiquette
                  </Button>
                </View>
              </Surface>
            ))}
          </View>
        )}
      </>
    );
  }

  // ─── Onglet 3 : Documents (historique par activité) ────────────────────────
  function renderDocumentsTab() {
    const filtered = activityFilter === 'all'
      ? history
      : history.filter((h) => h.activity === activityFilter);

    return (
      <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {([
            { id: 'all', label: 'Tous' },
            { id: 'convoyage', label: 'Convoyage' },
            { id: 'colis', label: 'Colis' },
            { id: 'marchandise', label: 'Marchandise' },
          ] as { id: AdminActivity | 'all'; label: string }[]).map((f) => {
            const on = activityFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setActivityFilter(f.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: RADII.pill,
                  borderWidth: 1,
                  borderColor: on ? theme.select : theme.line,
                  backgroundColor: on ? theme.select : theme.surface,
                }}
              >
                <Text style={{ fontSize: 13, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.medium }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHead title={`Documents générés · ${filtered.length}`} style={{ marginTop: 4 }} />

        {filtered.length === 0 ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="doc"
              title="Aucun document"
              subtitle={
                activityFilter === 'all'
                  ? 'Génère un premier document depuis l\'onglet « Générer » : il apparaîtra ici.'
                  : `Aucun document ${ACTIVITY_LABEL[activityFilter as AdminActivity].toLowerCase()} pour l'instant.`
              }
              cta={{ label: 'Générer un document', onPress: () => setTab('generate') }}
            />
          </Surface>
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map((entry) => renderHistoryRow(entry))}
          </View>
        )}
      </>
    );
  }

  // ─── Ligne d'historique (partagée Générer / Documents) ─────────────────────
  function renderHistoryRow(entry: AdminHistoryEntry) {
    const type = adminDocTypeById(entry.typeId);
    const when = new Date(entry.dateISO);
    const dateLabel = Number.isNaN(when.getTime())
      ? ''
      : when.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
      <Surface key={entry.id} padded flat style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: RADII.sm,
              backgroundColor: theme.bgSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {type ? renderTypeIcon(type, 16, theme.inkSoft) : <Icons.doc size={16} color={theme.inkSoft} stroke={1.7} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
              {entry.typeLabel} · {entry.reference}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <Pill tone="ghost">{ACTIVITY_LABEL[entry.activity]}</Pill>
              <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                {dateLabel}
              </Text>
            </View>
          </View>
          <Button kind="outline" size="sm" onPress={() => regenerate(entry)}>
            Régénérer
          </Button>
        </View>
      </Surface>
    );
  }

  function renderTypeIcon(type: AdminDocType, size: number, color: string) {
    const IconComp = Icons[type.icon];
    return <IconComp size={size} color={color} stroke={1.7} />;
  }
}

// ─── Tuiles du tableau de bord ───────────────────────────────────────────────

type DashTone = 'navy' | 'gold' | 'warn' | 'plain';

function DashTile({
  theme,
  label,
  value,
  tone,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>['theme'];
  label: string;
  value: string;
  tone: DashTone;
  onPress?: () => void;
}) {
  const bg =
    tone === 'navy' ? theme.navy
      : tone === 'gold' ? theme.gold
        : tone === 'warn' ? theme.warn + '18'
          : theme.surface;
  const fg =
    tone === 'navy' ? '#F1ECDC'
      : tone === 'gold' ? theme.navy
        : tone === 'warn' ? theme.warn
          : theme.ink;
  const sub = tone === 'navy' ? 'rgba(241,236,220,0.7)' : tone === 'gold' ? 'rgba(11,37,69,0.7)' : theme.muted;
  const Container: React.ComponentType<any> = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={{
        width: '47%',
        flexGrow: 1,
        padding: 14,
        borderRadius: RADII.lg,
        backgroundColor: bg,
        borderWidth: tone === 'plain' || tone === 'warn' ? 1 : 0,
        borderColor: tone === 'warn' ? theme.warn + '40' : theme.line,
      }}
    >
      <Text style={{ fontSize: 10.5, color: sub, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
        {label}
      </Text>
      <Text style={{ fontSize: 24, color: fg, fontFamily: TYPO.weights.bold, marginTop: 6, letterSpacing: -0.5 }} numberOfLines={1}>
        {value}
      </Text>
    </Container>
  );
}

function DashMini({
  theme,
  label,
  value,
  icon,
}: {
  theme: ReturnType<typeof useTheme>['theme'];
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADII.md, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 18, color: theme.ink, fontFamily: TYPO.weights.bold }}>{value}</Text>
        <Text style={{ fontSize: 10.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}
