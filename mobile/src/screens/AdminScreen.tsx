// Espace admin — poste de travail de Roger, l'opérateur de la plateforme.
// Trois onglets internes (état local, pas de routes dédiées) :
//   1. Générer   — générateur de documents officiels (formulaire → PDF)
//   2. Envois    — missions + colis à traiter à la main, avec actions rapides
//   3. Documents — historique local des documents, filtré par activité
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import {
  adminCreateMission,
  assignDriver,
  ClientOption,
  DriverOption,
  listClients,
  listDrivers,
  listMissions,
  MissionSummary,
} from '../api/missions';
import { addParcelEvent, getParcel, listParcels, ParcelStatus, ParcelSummary, ParcelTrackingEvent } from '../api/parcels';
import { getPaymentsSummary, listPayments, PaymentRecord, PaymentsSummary } from '../api/payments';
import { contractVerifyUrl, DocumentRecord, listDocuments } from '../api/documents';
import { companyAddress } from '../config/company';
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
  ISSUER_LABEL,
} from '../utils/adminDocs';
import { notify } from '../utils/notify';
import { buildFollowUps } from '../utils/followUps';
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
// Brouillon de prise de commande (Roger saisit au téléphone).
interface OrderDraft {
  clientId: string;          // '' = nouveau client
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehiclePlate: string;
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode: string;
  pickupCountry: string;
  pickupAt: string;          // JJ/MM/AAAA
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  price: string;             // EUR TTC
  driverId: string;          // '' = pas d'affectation immédiate
  notes: string;
}

const EMPTY_ORDER: OrderDraft = {
  clientId: '', clientFirstName: '', clientLastName: '', clientEmail: '', clientPhone: '',
  vehicleMake: '', vehicleModel: '', vehicleYear: '', vehiclePlate: '',
  pickupAddress: '', pickupCity: '', pickupPostalCode: '', pickupCountry: 'FR', pickupAt: '',
  deliveryAddress: '', deliveryCity: '', deliveryPostalCode: '', deliveryCountry: 'FR',
  price: '', driverId: '', notes: '',
};

// « 15/10/2026 » ou « 2026-10-15 » -> ISO. Renvoie null si illisible.
function parseFrDate(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const fr = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) {
    const d = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]), 9, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const iso = new Date(v);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

const AXIS_SENDER = {
  senderName: 'Axis Import SAS',
  senderAddress: companyAddress(),
  shipperName: 'Axis Import SAS',
  shipperAddress: companyAddress(),
  exporterName: 'Axis Import SAS',
  exporterAddress: companyAddress(),
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
  // Date d'arrivée prévue : Roger la corrige quand un navire prend du retard.
  const [eventEta, setEventEta] = useState('');
  // Numéro de suivi du transporteur du premier tronçon, quand il le communique.
  const [eventTracking, setEventTracking] = useState('');

  // Affectation d'un convoyeur (modale)
  const [assignMission, setAssignMission] = useState<MissionSummary | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[] | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Prise de commande (modale)
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[] | null>(null);
  const [order, setOrder] = useState<OrderDraft>(EMPTY_ORDER);

  // Encaissements réels (table Payment côté serveur). Null tant qu'on n'a pas
  // de réponse : on n'affiche pas un « 0 € » qui serait faux.
  const [payments, setPayments] = useState<PaymentsSummary | null>(null);
  const [paymentList, setPaymentList] = useState<PaymentRecord[]>([]);
  // Contrats signés par les clients, indexés par mission : Roger voit qui a
  // signé et récupère la signature sur son exemplaire du contrat.
  const [signedContracts, setSignedContracts] = useState<Map<string, DocumentRecord>>(new Map());

  // Onglet Documents
  const [activityFilter, setActivityFilter] = useState<AdminActivity | 'all'>('all');

  useEffect(() => {
    readAdminHistory().then(setHistory);
  }, []);

  const loadShipments = useCallback(async () => {
    getPaymentsSummary().then(setPayments).catch(() => setPayments(null));
    listPayments().then((r) => setPaymentList(r.data)).catch(() => setPaymentList([]));
    listDocuments({ category: 'CONTRACT' })
      .then((docs) => {
        const map = new Map<string, DocumentRecord>();
        docs.forEach((d) => { if (d.missionId && d.signedAt) map.set(d.missionId, d); });
        setSignedContracts(map);
      })
      .catch(() => setSignedContracts(new Map()));
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
      const eta = parseFrDate(eventEta);
      if (eventEta.trim() && !eta) {
        notify('Date invalide', 'Utilise le format JJ/MM/AAAA pour l\'arrivée prévue.');
        setAdvancing(false);
        return;
      }
      if (!offline && parcel.id && !parcel.id.startsWith('demo')) {
        await addParcelEvent(parcel.id, {
          status, location, notes,
          estimatedDelivery: eta ?? undefined,
          partnerTracking: eventTracking.trim() || undefined,
        });
      }
      setParcels((prev) => prev.map((p) => (p.id === parcel.id ? { ...p, status } : p)));
      // Modale maintenue ouverte : on met à jour l'étape courante et le journal.
      setStatusParcel((cur) => (cur && cur.id === parcel.id ? { ...cur, status } : cur));
      setStatusEvents((prev) => [...(prev ?? []), { status, location, notes, occurredAt: new Date().toISOString() }]);
      setEventLocation('');
      setEventNote('');
      setEventEta('');
      setEventTracking('');
      notify('Statut mis à jour', `${parcel.reference} → ${parcelStatusLabel(status)}`);
    } catch {
      notify('Échec de la mise à jour', 'Le statut n\'a pas pu être enregistré. Vérifie ta connexion et tes droits.');
    } finally {
      setAdvancing(false);
    }
  }, [offline, eventLocation, eventNote, eventEta, eventTracking]);

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
        description: `Envoi colis ${p.originCity} → ${p.destinationCity} (${p.weightKg.toLocaleString('fr-FR')} kg) — réf ${p.reference}`,
      },
      'colis',
    );
  };

  const contractFromMission = (m: MissionSummary) => {
    const signed = signedContracts.get(m.id);
    const signedAt = signed?.signedAt ? new Date(signed.signedAt) : null;
    openDocForm(
      adminDocTypeById('contract')!,
      {
        reference: m.reference,
        // Reprise de la signature du client si le contrat est déjà signé.
        clientSignatureDataUrl: signed?.signatureUrl ?? '',
        clientSignedDate:
          signedAt && !Number.isNaN(signedAt.getTime())
            ? signedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            : '',
        proofHash: signed?.contentHash ?? '',
        proofSignedAt: signed?.signedAt ?? '',
        proofUrl: signed ? contractVerifyUrl(signed.id) : '',
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
      {renderAssignModal()}
      {renderOrderModal()}
    </SafeAreaView>
  );

  // ─── Affectation d'un convoyeur ────────────────────────────────────────────
  function openAssign(m: MissionSummary) {
    if (offline) {
      notify('Hors ligne', "L'affectation d'un convoyeur nécessite une connexion au serveur.");
      return;
    }
    setAssignMission(m);
    if (drivers === null) {
      listDrivers()
        .then(setDrivers)
        .catch(() => setDrivers([]));
    }
  }

  async function confirmAssign(driverId: string) {
    const m = assignMission;
    if (!m || assigning) return;
    setAssigning(true);
    try {
      const updated = await assignDriver(m.id, driverId);
      setMissions((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...updated } : x)));
      setAssignMission(null);
      const d = (drivers ?? []).find((x) => x.id === driverId);
      notify('Convoyeur affecté', d ? `${m.reference} confié à ${d.firstName} ${d.lastName}.` : m.reference);
    } catch (e) {
      notify('Affectation impossible', e instanceof Error ? e.message : 'Réessaie dans un instant.');
    } finally {
      setAssigning(false);
    }
  }

  // ─── Prise de commande ─────────────────────────────────────────────────────
  function openOrder() {
    if (offline) {
      notify('Hors ligne', 'La prise de commande nécessite une connexion au serveur.');
      return;
    }
    setOrder(EMPTY_ORDER);
    setOrderError(null);
    setOrderOpen(true);
    if (clients === null) listClients().then(setClients).catch(() => setClients([]));
    if (drivers === null) listDrivers().then(setDrivers).catch(() => setDrivers([]));
  }

  // Déclaration de fonction (hoistée) : ces helpers vivent après le `return`
  // du composant, comme les autres `render*`.
  function setOrderField(key: keyof OrderDraft) {
    return (v: string) => setOrder((prev) => ({ ...prev, [key]: v }));
  }

  async function submitOrder() {
    if (orderSaving) return;
    const o = order;

    // Validation : ce qui manque bloque la création côté serveur.
    if (!o.clientId && !o.clientEmail.trim()) {
      setOrderError('Choisis un client existant ou saisis son e-mail.');
      return;
    }
    if (!o.clientId && (!o.clientFirstName.trim() || !o.clientLastName.trim())) {
      setOrderError('Nom et prénom requis pour un nouveau client.');
      return;
    }
    if (!o.vehicleMake.trim() || !o.vehicleModel.trim() || !o.vehiclePlate.trim()) {
      setOrderError('Marque, modèle et immatriculation du véhicule requis.');
      return;
    }
    if (!o.pickupAddress.trim() || !o.pickupCity.trim()) {
      setOrderError('Adresse et ville de départ requises.');
      return;
    }
    if (!o.deliveryAddress.trim() || !o.deliveryCity.trim()) {
      setOrderError("Adresse et ville d'arrivée requises.");
      return;
    }
    const pickupAt = parseFrDate(o.pickupAt);
    if (!pickupAt) {
      setOrderError('Date de départ invalide (format JJ/MM/AAAA).');
      return;
    }

    const priceEur = Number(o.price.replace(',', '.'));
    setOrderError(null);
    setOrderSaving(true);
    try {
      const created = await adminCreateMission({
        clientId: o.clientId || undefined,
        clientEmail: o.clientId ? undefined : o.clientEmail.trim(),
        clientFirstName: o.clientId ? undefined : o.clientFirstName.trim(),
        clientLastName: o.clientId ? undefined : o.clientLastName.trim(),
        clientPhone: o.clientId ? undefined : o.clientPhone.trim() || undefined,
        vehicleMake: o.vehicleMake.trim(),
        vehicleModel: o.vehicleModel.trim(),
        vehicleYear: o.vehicleYear ? Number(o.vehicleYear) : undefined,
        vehiclePlate: o.vehiclePlate.trim(),
        driverId: o.driverId || undefined,
        pickupAddress: o.pickupAddress.trim(),
        pickupCity: o.pickupCity.trim(),
        pickupPostalCode: o.pickupPostalCode.trim() || undefined,
        pickupCountry: (o.pickupCountry || 'FR').slice(0, 2).toUpperCase(),
        pickupAt,
        deliveryAddress: o.deliveryAddress.trim(),
        deliveryCity: o.deliveryCity.trim(),
        deliveryPostalCode: o.deliveryPostalCode.trim() || undefined,
        deliveryCountry: (o.deliveryCountry || 'FR').slice(0, 2).toUpperCase(),
        deliveryNotes: o.notes.trim() || undefined,
        priceCents: Number.isFinite(priceEur) && priceEur > 0 ? Math.round(priceEur * 100) : undefined,
      });
      setMissions((prev) => [created, ...prev]);
      setOrderOpen(false);
      setTab('shipments');
      notify('Commande enregistrée', `${created.reference} — ${created.pickupCity} vers ${created.deliveryCity}.`);
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie dans un instant.');
    } finally {
      setOrderSaving(false);
    }
  }

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
                    <Field label="Lieu (facultatif)" value={eventLocation} onChangeText={setEventLocation} placeholder="Ex. Hub Marseille" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Note (facultatif)" value={eventNote} onChangeText={setEventNote} placeholder="Ex. Dédouané" />
                  </View>
                </View>
                {/* La date d'arrivée est ce que le client regarde en premier :
                    laissée vide, elle se resserre automatiquement selon l'étape. */}
                <Field
                  label="Arrivée prévue (facultatif)"
                  value={eventEta}
                  onChangeText={setEventEta}
                  placeholder={p.estimatedDelivery ? new Date(p.estimatedDelivery).toLocaleDateString('fr-FR') : 'JJ/MM/AAAA'}
                  hint="Vide = date recalculée selon l'étape. Renseigne-la si un navire a du retard."
                />
                <Field
                  label="N° de suivi transporteur (facultatif)"
                  value={eventTracking}
                  onChangeText={setEventTracking}
                  placeholder={p.partnerTracking ?? 'Ex. XX061953784FR'}
                  autoCapitalize="characters"
                  hint="Celui du premier tronçon (Chronopost, Geodis…). Le client pourra le suivre chez eux."
                />

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

  // ─── Modale : affecter un convoyeur ────────────────────────────────────────
  function renderAssignModal() {
    const m = assignMission;
    return (
      <Modal visible={!!m} transparent animationType="slide" onRequestClose={() => setAssignMission(null)}>
        <Pressable onPress={() => setAssignMission(null)} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 12, maxHeight: '90%' }}>
            {m ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                <View>
                  <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                    Affecter un convoyeur
                  </Text>
                  <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }} numberOfLines={1}>
                    {m.reference}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                    {m.pickupCity} → {m.deliveryCity} · {m.vehicle.make} {m.vehicle.model}
                  </Text>
                </View>

                {m.driver ? (
                  <Banner
                    tone="info"
                    title={`Actuellement : ${m.driver.firstName} ${m.driver.lastName}`}
                    message="Choisir un autre convoyeur remplacera l'affectation en cours."
                  />
                ) : null}

                {drivers === null ? (
                  <Skeleton variant="card" count={3} />
                ) : drivers.length === 0 ? (
                  <Surface padded style={{ padding: 4 }}>
                    <EmptyState
                      iconKey="user"
                      title="Aucun convoyeur"
                      subtitle="Ajoute d'abord des comptes convoyeurs pour pouvoir les affecter."
                    />
                  </Surface>
                ) : (
                  <View style={{ gap: 8 }}>
                    {drivers.map((d) => {
                      const current = m.driver
                        ? `${m.driver.firstName} ${m.driver.lastName}` === `${d.firstName} ${d.lastName}`
                        : false;
                      const initials = `${d.firstName?.[0] ?? ''}${d.lastName?.[0] ?? ''}`.toUpperCase();
                      return (
                        <Pressable
                          key={d.id}
                          disabled={assigning}
                          onPress={() => confirmAssign(d.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: current ? theme.gold : theme.line, backgroundColor: current ? theme.gold + '18' : theme.surface, opacity: assigning ? 0.6 : 1 }}
                        >
                          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgSoft }}>
                            <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.bold }}>{initials || '?'}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                              {d.firstName} {d.lastName}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                              {[d.driverProfile?.baseCity, d.phone].filter(Boolean).join(' · ') || 'Convoyeur Axis'}
                            </Text>
                          </View>
                          {current ? <Pill tone="gold">Affecté</Pill> : <Icons.arrow size={16} color={theme.muted} stroke={1.8} />}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <Button kind="ghost" size="md" fullWidth onPress={() => setAssignMission(null)}>
                  Fermer
                </Button>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ─── Modale : prise de commande (Roger saisit pour un client) ──────────────
  function renderOrderModal() {
    const newClient = !order.clientId;
    return (
      <Modal visible={orderOpen} transparent animationType="slide" onRequestClose={() => setOrderOpen(false)}>
        <Pressable onPress={() => setOrderOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 12, maxHeight: '92%' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
              <View>
                <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                  Nouvelle commande
                </Text>
                <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }}>
                  Convoyage de véhicule
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                  Saisis la commande reçue par téléphone. Le client et le véhicule sont créés automatiquement.
                </Text>
              </View>

              {orderError ? <Banner tone="warn" title="Champs à compléter" message={orderError} /> : null}

              {/* 1. Client */}
              <SectionHead title="1 · Client" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable
                  onPress={() => setOrder((p) => ({ ...p, clientId: '' }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.md, borderWidth: 1.5, borderColor: newClient ? theme.gold : theme.line, backgroundColor: newClient ? theme.gold + '18' : theme.surface }}
                >
                  <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Nouveau client</Text>
                </Pressable>
                {(clients ?? []).map((c) => {
                  const active = order.clientId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setOrder((p) => ({ ...p, clientId: c.id }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.md, borderWidth: 1.5, borderColor: active ? theme.gold : theme.line, backgroundColor: active ? theme.gold + '18' : theme.surface }}
                    >
                      <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                        {c.companyName || `${c.firstName} ${c.lastName}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {newClient ? (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Field label="Prénom" value={order.clientFirstName} onChangeText={setOrderField('clientFirstName')} placeholder="Marc" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Nom" value={order.clientLastName} onChangeText={setOrderField('clientLastName')} placeholder="Dupont" />
                    </View>
                  </View>
                  <Field label="E-mail" value={order.clientEmail} onChangeText={setOrderField('clientEmail')} placeholder="marc.dupont@email.fr" autoCapitalize="none" keyboardType="email-address" hint="Sert d'identifiant : le client y accède via « mot de passe oublié »." />
                  <Field label="Téléphone" value={order.clientPhone} onChangeText={setOrderField('clientPhone')} placeholder="+33 6 12 34 56 78" keyboardType="phone-pad" />
                </View>
              ) : null}

              {/* 2. Véhicule */}
              <SectionHead title="2 · Véhicule" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Marque" value={order.vehicleMake} onChangeText={setOrderField('vehicleMake')} placeholder="Renault" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Modèle" value={order.vehicleModel} onChangeText={setOrderField('vehicleModel')} placeholder="Master" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Immatriculation" value={order.vehiclePlate} onChangeText={setOrderField('vehiclePlate')} placeholder="AB-123-CD" autoCapitalize="characters" />
                </View>
                <View style={{ width: 110 }}>
                  <Field label="Année" value={order.vehicleYear} onChangeText={setOrderField('vehicleYear')} placeholder="2021" keyboardType="number-pad" />
                </View>
              </View>

              {/* 3. Trajet */}
              <SectionHead title="3 · Trajet" />
              <Field label="Adresse de départ" value={order.pickupAddress} onChangeText={setOrderField('pickupAddress')} placeholder="12 rue des Lilas" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Ville départ" value={order.pickupCity} onChangeText={setOrderField('pickupCity')} placeholder="Paris" />
                </View>
                <View style={{ width: 100 }}>
                  <Field label="CP" value={order.pickupPostalCode} onChangeText={setOrderField('pickupPostalCode')} placeholder="75015" />
                </View>
                <View style={{ width: 72 }}>
                  <Field label="Pays" value={order.pickupCountry} onChangeText={setOrderField('pickupCountry')} placeholder="FR" autoCapitalize="characters" maxLength={2} />
                </View>
              </View>
              <Field label="Date d'enlèvement" value={order.pickupAt} onChangeText={setOrderField('pickupAt')} placeholder="15/10/2026" hint="Format JJ/MM/AAAA" />

              <Field label="Adresse d'arrivée" value={order.deliveryAddress} onChangeText={setOrderField('deliveryAddress')} placeholder="8 avenue du Port" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Ville arrivée" value={order.deliveryCity} onChangeText={setOrderField('deliveryCity')} placeholder="Marseille" />
                </View>
                <View style={{ width: 100 }}>
                  <Field label="CP" value={order.deliveryPostalCode} onChangeText={setOrderField('deliveryPostalCode')} placeholder="13002" />
                </View>
                <View style={{ width: 72 }}>
                  <Field label="Pays" value={order.deliveryCountry} onChangeText={setOrderField('deliveryCountry')} placeholder="FR" autoCapitalize="characters" maxLength={2} />
                </View>
              </View>

              {/* 4. Prix + convoyeur */}
              <SectionHead title="4 · Prix et convoyeur" />
              <Field label="Prix convenu (EUR TTC)" value={order.price} onChangeText={setOrderField('price')} placeholder="690" keyboardType="decimal-pad" hint="Facultatif — sert à la facturation et au chiffre d'affaires." />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable
                  onPress={() => setOrder((p) => ({ ...p, driverId: '' }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.md, borderWidth: 1.5, borderColor: !order.driverId ? theme.gold : theme.line, backgroundColor: !order.driverId ? theme.gold + '18' : theme.surface }}
                >
                  <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Affecter plus tard</Text>
                </Pressable>
                {(drivers ?? []).map((d) => {
                  const active = order.driverId === d.id;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => setOrder((p) => ({ ...p, driverId: d.id }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.md, borderWidth: 1.5, borderColor: active ? theme.gold : theme.line, backgroundColor: active ? theme.gold + '18' : theme.surface }}
                    >
                      <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                        {d.firstName} {d.lastName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Field label="Consignes (facultatif)" value={order.notes} onChangeText={setOrderField('notes')} placeholder="Remise des clés à l'accueil" multiline />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Button kind="ghost" size="md" style={{ flex: 1 }} onPress={() => setOrderOpen(false)}>
                  Annuler
                </Button>
                <Button kind="primary" size="md" style={{ flex: 1 }} loading={orderSaving} onPress={submitOrder}>
                  Enregistrer
                </Button>
              </View>
            </ScrollView>
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

    // Encaissements : la table Payment du serveur fait foi (elle enregistre
    // les règlements Stripe). À défaut de réponse — serveur injoignable — on
    // retombe sur les factures que Roger a lui-même éditées depuis l'app.
    const invoices = history.filter((h) => h.typeId === 'invoice');
    const localCaMonth = invoices.filter((h) => sameMonth(h.dateISO)).reduce((s, h) => s + parseAmt(h.values.amountEur), 0);
    const localToCollect = invoices.filter((h) => !isPaid(h.values.paid)).reduce((s, h) => s + parseAmt(h.values.amountEur), 0);
    const caMonth = payments ? Math.round(payments.collectedMonthCents / 100) : localCaMonth;
    const toCollect = payments ? Math.round(payments.pendingCents / 100) : localToCollect;
    const inCustoms = parcels.filter((p) => p.status === 'CUSTOMS').length;
    const activeConvoys = missions.filter((m) => m.status === 'IN_PROGRESS').length;
    const toProcess = missions.length + parcels.length;
    const docsMonth = history.filter((h) => sameMonth(h.dateISO)).length;

    const fmtEuro = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

    // Relances : ce qui n'avance plus et qu'il faut traiter aujourd'hui.
    const followUps = buildFollowUps(missions, parcels);
    const urgentCount = followUps.filter((f) => f.level === 'urgent').length;

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
          <DashTile theme={theme} label={payments ? 'Encaissé (mois)' : 'CA facturé (mois)'} value={fmtEuro(caMonth)} tone="gold" />
          <DashTile theme={theme} label="À encaisser" value={fmtEuro(toCollect)} tone={toCollect > 0 ? 'warn' : 'plain'} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <DashMini theme={theme} label="Convoyages actifs" value={String(activeConvoys)} icon={<Icons.truck size={15} color={theme.muted} stroke={1.7} />} />
          <DashMini theme={theme} label="Documents (mois)" value={String(docsMonth)} icon={<Icons.doc size={15} color={theme.muted} stroke={1.7} />} />
        </View>

        {/* Relances — tout en haut : c'est ce qui coûte de l'argent si on
            l'oublie (surestaries, stockage, client qui appelle). */}
        {followUps.length > 0 ? (
          <>
            <SectionHead
              title={`À relancer · ${followUps.length}${urgentCount > 0 ? ` · ${urgentCount} urgent${urgentCount > 1 ? 's' : ''}` : ''}`}
              style={{ marginTop: 6 }}
            />
            <View style={{ gap: 8 }}>
              {followUps.slice(0, 5).map((f) => {
                const urgent = f.level === 'urgent';
                const tone = urgent ? theme.bad : theme.warn;
                return (
                  <Pressable
                    key={`fu-${f.kind}-${f.id}`}
                    onPress={() => {
                      if (f.kind === 'parcel') {
                        const p = parcels.find((x) => x.id === f.id);
                        if (p) setStatusParcel(p);
                        return;
                      }
                      const m = missions.find((x) => x.id === f.id);
                      if (m) openAssign(m);
                    }}
                  >
                    <Surface
                      padded
                      flat
                      style={{ padding: 12, borderWidth: 1, borderColor: tone + '4D', backgroundColor: tone + '12' }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: RADII.sm, backgroundColor: tone + '22', alignItems: 'center', justifyContent: 'center' }}>
                          {f.kind === 'parcel'
                            ? <Icons.box size={16} color={tone} stroke={1.9} />
                            : <Icons.truck size={16} color={tone} stroke={1.9} />}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                            {f.reference} · {f.route}
                          </Text>
                          <Text style={{ fontSize: 12, color: tone, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={2}>
                            {f.reason}
                          </Text>
                        </View>
                        <Icons.arrow size={16} color={theme.muted} stroke={1.8} />
                      </View>
                    </Surface>
                  </Pressable>
                );
              })}
              {followUps.length > 5 ? (
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
                  et {followUps.length - 5} autre{followUps.length - 5 > 1 ? 's' : ''} dans l'onglet Envois
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Règlements reçus — Roger voit enfin qui a payé. Avant, le paiement
            ne vivait que dans le téléphone du client. */}
        {paymentList.length > 0 ? (
          <>
            <SectionHead title="Derniers règlements" style={{ marginTop: 6 }} />
            <View style={{ gap: 8 }}>
              {paymentList.slice(0, 5).map((pay) => {
                const done = pay.status === 'PAID';
                const tone = done ? theme.good : pay.status === 'PENDING' ? theme.warn : theme.bad;
                const who = pay.client ? `${pay.client.firstName} ${pay.client.lastName}`.trim() : 'Client';
                const dossier = pay.mission?.reference ?? pay.parcel?.reference ?? pay.reference ?? 'Sans dossier';
                const when = new Date(pay.paidAt ?? pay.createdAt);
                return (
                  <Surface key={pay.id} padded flat style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: RADII.sm, backgroundColor: tone + '22', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.card size={16} color={tone} stroke={1.9} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                          {who} · {dossier}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={1}>
                          {Number.isNaN(when.getTime())
                            ? ''
                            : when.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          {pay.provider === 'simulation' ? ' · simulation (aucun débit)' : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.bold, fontVariant: ['tabular-nums'] }}>
                          {fmtEuro(Math.round(pay.amountCents / 100))}
                        </Text>
                        <Text style={{ fontSize: 11, color: tone, fontFamily: TYPO.weights.semibold, marginTop: 1 }}>
                          {done ? 'Réglé' : pay.status === 'PENDING' ? 'En attente' : 'Échoué'}
                        </Text>
                      </View>
                    </View>
                  </Surface>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Prise de commande — première action du quotidien de Roger */}
        <SectionHead title="Prendre une commande" style={{ marginTop: 6 }} />
        <Button
          kind="primary"
          size="md"
          fullWidth
          leftIcon={<Icons.truck size={16} color="#fff" stroke={1.9} />}
          onPress={openOrder}
        >
          Nouveau convoyage
        </Button>

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
                          {p.status === 'CUSTOMS' ? 'Dédouanement à préparer' : 'En transit'} · {p.weightKg.toLocaleString('fr-FR')} kg
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
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: -2, marginBottom: 2, lineHeight: 16 }}>
            Touche un document pour le générer. « Obligatoire » = exigé pour cette
            opération. « Émis par Axis » = le PDF fait foi tel quel ; sinon, il sert à
            préparer le dossier, et l'original vient du transporteur, d'un organisme
            officiel ou du fabricant.
          </Text>
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
                        {/* Titre sur sa propre ligne : avec deux badges à
                            côté, il était tronqué à trois lettres. */}
                        <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                          {t.label}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                          {/* Badges d'information, pas des boutons : le premier
                              dit si la douane exige ce document, le second qui
                              en délivre l'original. */}
                          {item.required
                            ? <Pill tone="warn">Obligatoire</Pill>
                            : <Pill tone="ghost">Facultatif</Pill>}
                          <Pill tone={t.issuer === 'axis' ? 'good' : 'default'}>
                            {ISSUER_LABEL[t.issuer]}
                          </Pill>
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

        <Button kind="primary" size="md" fullWidth onPress={openOrder}>
          + Nouvelle commande de convoyage
        </Button>

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
                {signedContracts.has(m.id) ? (
                  <View style={{ flexDirection: 'row' }}>
                    <Pill tone="good">Contrat signé par le client</Pill>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button kind="primary" size="sm" style={{ flex: 1 }} onPress={() => openAssign(m)}>
                    {m.driver ? 'Changer' : 'Affecter'}
                  </Button>
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
                  {p.originCity} → {p.destinationCity} ({p.destinationCountry}) · {p.weightKg.toLocaleString('fr-FR')} kg
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
