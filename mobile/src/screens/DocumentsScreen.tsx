import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { AutoDossierCard } from '../components/AutoDossierCard';
import { ComplianceChecklist } from '../components/ComplianceChecklist';
import { DocumentHub, DocStatusEntry } from '../components/DocumentHub';
import { PaymentSheet } from '../components/PaymentSheet';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { notify } from '../utils/notify';
import {
  generateCommercialInvoicePdf,
  generateContractPdf,
  generateCustomsMandatePdf,
  generateExportDeclarationPdf,
  generateInsuranceCertificatePdf,
  generateInvoicePdf,
  generatePackingListPdf,
} from '../utils/pdf';
import {
  CatalogDoc,
  ShipmentKind,
  catalogByKind,
} from '../utils/documentCatalog';
import {
  CARGO_TYPE_LABEL,
  CountryRequirements,
  getDemoRequirements,
  getRequirements,
} from '../api/customs';
import { ShipmentInput, buildDossierPlan } from '../utils/dossierAuto';
import {
  SHIPMENT_INFO_KEY,
  ShipmentInfoForm,
  shipmentInfoToInput,
} from './ShipmentInfoScreen';
import { COUNTRY_SUMMARIES, groupCountriesByZone } from '../utils/countryRegulations';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

// Destination + type d'envoi par défaut (cf. cahier des charges).
const DEFAULT_COUNTRY = 'SN';
const DEFAULT_KIND: ShipmentKind = 'commercial';

// Clé de persistance des statuts de documents du centre de conformité.
const HUB_STORAGE_KEY = 'axis.compliance.v1';
// Clé de persistance des factures (héritée de l'écran existant).
const INVOICE_STORAGE_KEY = 'axis.docs.v1';

const KIND_OPTIONS: { id: ShipmentKind; label: string; icon: keyof typeof Icons }[] = [
  { id: 'parcel', label: 'Colis', icon: 'box' },
  { id: 'commercial', label: 'Marchandise', icon: 'pallet' },
  { id: 'vehicle', label: 'Véhicule', icon: 'car' },
];

// ─── Factures (section paiement existante, conservée) ───────────────────────
interface Invoice {
  id: number;
  title: string;
  ref: string;
  date: string;
  amountEur: number;
  paid: boolean;
}

const INITIAL_INVOICES: Invoice[] = [
  { id: 5, title: 'FA-2026-0184', ref: 'Convoyage Paris → Bruxelles', date: '14 mai 2026', amountEur: 512, paid: true },
  { id: 6, title: 'FA-2026-0179', ref: 'Fret 4 palettes → Dakar', date: '08 mai 2026', amountEur: 1240, paid: false },
];

type StatusMap = Record<string, DocStatusEntry>;

export function DocumentsScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const clientName = user ? `${user.firstName} ${user.lastName}` : 'Client Axis Import';
  const clientEmail = user?.email;

  // ─── Sélection destination + type d'envoi ─────────────────────────────────
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [kind, setKind] = useState<ShipmentKind>(DEFAULT_KIND);
  // Infos d'envoi saisies par l'utilisateur (rechargées à chaque focus écran).
  const [shipmentInfo, setShipmentInfo] = useState<ShipmentInfoForm | null>(null);
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(SHIPMENT_INFO_KEY)
      .then((raw) => { if (raw) { try { setShipmentInfo(JSON.parse(raw)); } catch { /* ignore */ } } })
      .catch(() => {});
  }, []));
  const [pickerOpen, setPickerOpen] = useState(false);

  // ─── Réglementation pays (API + repli démo gracieux) ──────────────────────
  const [req, setReq] = useState<CountryRequirements | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let active = true;
    setReq(null);
    (async () => {
      try {
        const r = await getRequirements(country);
        if (active) { setReq(r); setDemoMode(false); }
      } catch {
        if (active) {
          const demo = getDemoRequirements(country);
          // Repli ultime : enveloppe minimale si le pays n'est pas dans la matrice démo.
          setReq(demo ?? fallbackRequirements(country));
          setDemoMode(true);
        }
      }
    })();
    return () => { active = false; };
  }, [country]);

  // ─── Statuts des documents (persistés par pays + kind + docKey) ───────────
  const [status, setStatus] = useState<StatusMap>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HUB_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try { setStatus(JSON.parse(raw)); } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(status)).catch(() => {});
  }, [status]);

  const statusKey = (doc: CatalogDoc) => `${country}:${kind}:${doc.key}`;

  // ─── Factures (paiement) ──────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [paying, setPaying] = useState<Invoice | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(INVOICE_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Record<number, { paid?: boolean }>;
        setInvoices((prev) => prev.map((inv) => (saved[inv.id]?.paid != null ? { ...inv, paid: !!saved[inv.id].paid } : inv)));
      } catch { /* ignore */ }
    });
  }, []);

  const persistInvoices = (next: Invoice[]) => {
    const toSave: Record<number, { paid: boolean }> = {};
    next.forEach((inv) => { toSave[inv.id] = { paid: inv.paid }; });
    AsyncStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  };

  // ─── Liste des documents requis pour la destination/kind ──────────────────
  const requiredDocs = useMemo(() => buildRequiredDocs(kind, req), [kind, req]);

  // ─── Conformité globale : X/Y documents conformes ─────────────────────────
  const conformCount = useMemo(
    () => requiredDocs.filter((d) => status[statusKey(d)]?.state === 'ready').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requiredDocs, status, country, kind],
  );

  const trackingLabel = req?.cargoTrackingType ? CARGO_TYPE_LABEL[req.cargoTrackingType] : null;
  const countryName = req?.countryName ?? COUNTRY_SUMMARIES.find((c) => c.code === country)?.name ?? country;

  // ─── Plan d'auto-dossier : « saisir une fois, tout générer » ──────────────
  // On dérive un ShipmentInput de la sélection courante + du profil client ;
  // le reste (valeurs marchandise, poids…) retombe sur des replis démo.
  const dossierPlan = useMemo(() => {
    // Base : sélection courante + profil client.
    const base: ShipmentInput = {
      kind,
      destinationCountry: countryName,
      destinationCode: country,
      currency: req?.currency,
      recipient: { name: clientName, email: clientEmail, country: countryName },
    };
    // Surcouche : infos d'envoi saisies par l'utilisateur (prioritaires).
    const input: ShipmentInput = shipmentInfo
      ? {
          ...base,
          ...shipmentInfoToInput(shipmentInfo),
          kind,
          destinationCountry: countryName,
          destinationCode: country,
          // on garde le destinataire saisi s'il existe, sinon le profil
          recipient: {
            name: shipmentInfo.recipientName || clientName,
            email: clientEmail,
            address: shipmentInfo.recipientAddress || undefined,
            country: countryName,
          },
        }
      : base;
    return buildDossierPlan(input, req);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, country, countryName, req, clientName, clientEmail, shipmentInfo]);

  const hasShipmentInfo = !!(shipmentInfo && (shipmentInfo.goodsDesignation || shipmentInfo.declaredValue || shipmentInfo.recipientName));

  // ─── Signature (modal existant réutilisé) ─────────────────────────────────
  const [signing, setSigning] = useState<CatalogDoc | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const markReady = (doc: CatalogDoc, patch?: Partial<DocStatusEntry>) => {
    const at = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    setStatus((prev) => ({ ...prev, [statusKey(doc)]: { state: 'ready', at, ...patch } }));
  };

  // Marque « prêts » les documents générés en lot par l'auto-dossier, pour que
  // la liste détaillée reflète instantanément les PDF produits.
  const markKeysReady = (docKeys: string[]) => {
    const at = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    setStatus((prev) => {
      const next = { ...prev };
      docKeys.forEach((k) => { next[`${country}:${kind}:${k}`] = { state: 'ready', at }; });
      return next;
    });
  };

  // ─── Génération PDF : map doc.generator → fonction ────────────────────────
  const handleGenerate = async (doc: CatalogDoc) => {
    setBusyKey(statusKey(doc));
    try {
      await runGenerator(doc, { countryName, clientName, clientEmail, currency: req?.currency });
      markReady(doc);
      notify('Document généré', `Le PDF « ${doc.label} » a été enregistré dans tes fichiers.`);
    } catch {
      notify('Génération impossible', 'Le document n\'a pas pu être généré. Réessaie.');
    } finally {
      setBusyKey(null);
    }
  };

  // ─── Téléversement (file picker web, fallback natif) ──────────────────────
  const handleUpload = (doc: CatalogDoc) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // Natif : pas de picker configuré dans cette version → dépôt simulé pour la démo.
      markReady(doc);
      notify('Document ajouté', `« ${doc.label} » a été marqué comme fourni.`);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const isImage = (file.type || '').startsWith('image/');
        markReady(doc, { uri: isImage ? dataUrl : undefined });
        notify('Document ajouté', `« ${doc.label} » a été téléversé.`);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ─── Signature ────────────────────────────────────────────────────────────
  const handleSign = (doc: CatalogDoc) => {
    setHasInk(false);
    setSigning(doc);
  };

  const confirmSign = async () => {
    if (!signing) return;
    if (padRef.current?.isEmpty()) {
      notify('Signature vide', 'Trace ta signature dans le cadre avant de valider.');
      return;
    }
    const url = padRef.current?.toDataUrl() ?? undefined;
    const at = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const doc = signing;
    setSigning(null);
    setStatus((prev) => ({ ...prev, [statusKey(doc)]: { state: 'ready', at, uri: url } }));
    // Régénère le PDF signé quand un générateur est associé (mandat, contrat…).
    if (doc.generator) {
      try {
        await runGenerator(doc, { countryName, clientName, clientEmail, currency: req?.currency, signatureDataUrl: url, signedDate: at });
      } catch { /* le statut signé est déjà enregistré */ }
    }
    notify('Document signé', 'Ta signature a été enregistrée. Le PDF signé est disponible dans tes documents.');
  };

  // ─── Factures ─────────────────────────────────────────────────────────────
  const downloadInvoice = async (inv: Invoice) => {
    await generateInvoicePdf({
      number: inv.title, date: inv.date, amountEur: inv.amountEur, paid: inv.paid,
      description: inv.ref, clientName, clientEmail,
    });
    notify('Facture téléchargée', `${inv.title}.pdf a été enregistré dans tes fichiers.`);
  };

  const payInvoice = (inv: Invoice) => {
    setInvoices((prev) => {
      const next = prev.map((i) => (i.id === inv.id ? { ...i, paid: true } : i));
      persistInvoices(next);
      return next;
    });
    notify('Paiement enregistré', `La facture ${inv.title} est marquée comme réglée.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Documents" subtitle="Centre de conformité import / export" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}>
        {/* ─── Sélecteur destination + type d'envoi ─── */}
        <Surface padded style={{ padding: 14, gap: 12 }}>
          <View>
            <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginBottom: 6 }}>
              Destination
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10,
                borderWidth: 1, borderColor: theme.line,
                backgroundColor: pressed ? theme.bgSoft : theme.surface2,
              })}
            >
              <Icons.globe size={18} color={theme.navy} stroke={1.7} />
              <Text style={{ flex: 1, fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{countryName}</Text>
              <Pill tone="ghost">{country}</Pill>
              <Icons.chev size={16} color={theme.muted} stroke={2.2} />
            </Pressable>
          </View>

          <View>
            <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginBottom: 6 }}>
              Type d'envoi
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {KIND_OPTIONS.map((opt) => {
                const on = kind === opt.id;
                const KIcon = Icons[opt.icon];
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setKind(opt.id)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10,
                      borderWidth: 1, borderColor: on ? theme.select : theme.line,
                      backgroundColor: on ? theme.select : theme.surface,
                      alignItems: 'center', gap: 5,
                    }}
                  >
                    <KIcon size={18} color={on ? theme.selectInk : theme.navy} stroke={1.7} />
                    <Text style={{ fontSize: 12.5, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.semibold }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Surface>

        {/* ─── Infos d'envoi (saisie unique → documents pré-remplis) ─── */}
        <Pressable
          onPress={() => nav.navigate('ShipmentInfo')}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 12,
            padding: 14, borderRadius: RADII.lg, borderWidth: 1,
            borderColor: hasShipmentInfo ? theme.good : theme.gold + '66',
            backgroundColor: pressed ? theme.bgSoft : theme.surface,
          })}
        >
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: hasShipmentInfo ? theme.good + '1F' : theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.edit size={18} color={hasShipmentInfo ? theme.good : theme.navy} stroke={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
              {hasShipmentInfo ? 'Infos d\'envoi renseignées' : 'Renseigner les infos d\'envoi'}
            </Text>
            <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
              {hasShipmentInfo ? 'Touche pour modifier · documents pré-remplis' : 'Marchandise, valeur, parties — saisis une fois'}
            </Text>
          </View>
          <Icons.chev size={18} color={theme.muted} stroke={2} />
        </Pressable>

        {/* ─── Auto-dossier : « saisir une fois, tout générer » ─── */}
        <AutoDossierCard
          plan={dossierPlan}
          demo={demoMode}
          onGenerated={markKeysReady}
        />

        {/* ─── Conformité globale ─── */}
        <ComplianceChecklist
          countryName={countryName}
          trackingLabel={trackingLabel}
          authority={req?.authority}
          conform={conformCount}
          total={requiredDocs.length}
          demo={demoMode}
          onSeeRegulation={() => nav.navigate('CustomsRequirements', { countryCode: country, kind })}
        />

        {/* ─── Documents requis groupés ─── */}
        <DocumentHub
          docs={requiredDocs}
          status={status}
          statusKey={statusKey}
          busyKey={busyKey}
          onGenerate={handleGenerate}
          onUpload={handleUpload}
          onSign={handleSign}
        />

        {/* ─── Factures (paiement) ─── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Icons.euro size={15} color={theme.muted} stroke={1.8} />
          <Text style={{ fontSize: 11.5, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            Factures
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
        </View>
        {invoices.map((inv) => (
          <Surface key={inv.id} padded style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.euro size={22} color={theme.navy} stroke={1.6} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Pill tone={inv.paid ? 'good' : 'warn'}>{inv.paid ? 'Payé' : 'À régler'}</Pill>
                <Text style={{ fontSize: 14, color: theme.ink, marginTop: 6, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{inv.title}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {`${inv.amountEur.toLocaleString('fr-FR')} € · ${inv.ref}`}
                </Text>
              </View>
              {inv.paid ? (
                <Pressable
                  onPress={() => downloadInvoice(inv)}
                  style={({ pressed }) => ({
                    width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: theme.line,
                    backgroundColor: pressed ? theme.bgSoft : theme.surface, alignItems: 'center', justifyContent: 'center',
                  })}
                >
                  <Icons.arrow size={15} color={theme.ink} stroke={2} />
                </Pressable>
              ) : (
                <Button kind="gold" size="sm" onPress={() => setPaying(inv)} rightIcon={<Icons.card size={15} color={theme.navy} stroke={2} />}>
                  Régler
                </Button>
              )}
            </View>
          </Surface>
        ))}
      </ScrollView>

      {/* ─── Modal sélecteur de pays ─── */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingBottom: 24, maxHeight: '82%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ flex: 1, fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>Pays de destination</Text>
              <Pressable onPress={() => setPickerOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.x size={16} color={theme.ink} stroke={2} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 14 }}>
              {groupCountriesByZone().map((group) => (
                <View key={group.zone} style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, paddingHorizontal: 4 }}>
                    {group.label}
                  </Text>
                  {group.items.map((c) => {
                    const on = c.code === country;
                    return (
                      <Pressable
                        key={c.code}
                        onPress={() => { setCountry(c.code); setPickerOpen(false); }}
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10,
                          borderWidth: 1, borderColor: on ? theme.select : theme.line,
                          backgroundColor: on ? theme.select : pressed ? theme.bgSoft : theme.surface,
                        })}
                      >
                        <Text style={{ flex: 1, fontSize: 14, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.semibold }}>{c.name}</Text>
                        <Text style={{ fontSize: 11.5, color: on ? theme.selectInk : theme.muted, fontFamily: TYPO.weights.semibold }}>{c.code}</Text>
                        {on ? <Icons.check size={16} color={theme.selectInk} stroke={2.4} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Modal signature ─── */}
      <Modal visible={!!signing} transparent animationType="slide" onRequestClose={() => setSigning(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.sig size={20} color={theme.goldHi} stroke={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>Signer le document</Text>
                <Text numberOfLines={1} style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{signing?.label}</Text>
              </View>
              <Pressable onPress={() => setSigning(null)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.x size={16} color={theme.ink} stroke={2} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              Trace ta signature dans le cadre ci-dessous avec ton doigt.
            </Text>

            <SignaturePad ref={padRef} height={200} onChange={setHasInk} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => { padRef.current?.clear(); setHasInk(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 }}>
                <Icons.x size={15} color={theme.muted} stroke={2} />
                <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Effacer</Text>
              </Pressable>
              <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, flex: 1, textAlign: 'right', marginLeft: 12 }}>
                Valeur juridique d'une signature manuscrite (eIDAS).
              </Text>
            </View>

            <Button kind="gold" size="lg" fullWidth disabled={!hasInk} onPress={confirmSign} rightIcon={<Icons.check size={18} color={theme.navy} stroke={2.4} />}>
              Valider et signer
            </Button>
          </View>
        </View>
      </Modal>

      {/* ─── Paiement Stripe / Apple Pay ─── */}
      <PaymentSheet
        visible={!!paying}
        amountEur={paying?.amountEur ?? 0}
        reference={paying?.title}
        description={paying?.ref}
        onClose={() => setPaying(null)}
        onPaid={() => { if (paying) payInvoice(paying); }}
      />
    </SafeAreaView>
  );
}

// ─── Logique : documents requis pour une destination + type d'envoi ─────────
// On part du catalogue filtré par type d'envoi, puis on garde :
//  - les documents obligatoires par défaut (baseline) ;
//  - ceux explicitement listés par la réglementation du pays ;
//  - le bordereau de suivi seulement si le pays en exige un.
function buildRequiredDocs(kind: ShipmentKind, req: CountryRequirements | null): CatalogDoc[] {
  const base = catalogByKind(kind);
  const regKeys = new Set((req?.checklist ?? []).map((i) => i.key));
  const hasTracking = !!req?.cargoTrackingType;

  return base.filter((doc) => {
    if (doc.key === 'cargo_tracking_note') return hasTracking;
    if (doc.mandatory) return true;
    return regKeys.has(doc.key);
  });
}

// Enveloppe minimale si le pays n'est ni dans l'API ni dans la matrice démo.
function fallbackRequirements(code: string): CountryRequirements {
  const summary = COUNTRY_SUMMARIES.find((c) => c.code === code.toUpperCase());
  return {
    countryCode: code.toUpperCase(),
    countryName: summary?.name ?? code.toUpperCase(),
    cargoTrackingType: summary?.trackingType ?? null,
    cargoMandatory: !!summary?.trackingType,
    authority: summary?.authority ?? null,
    currency: summary?.currency ?? 'EUR',
    customsNotes: null,
    checklist: [],
    cargoNote: null,
  };
}

// ─── Mapping doc.generator → générateur PDF ─────────────────────────────────
interface GenCtx {
  countryName: string;
  clientName: string;
  clientEmail?: string;
  currency?: string;
  signatureDataUrl?: string;
  signedDate?: string;
}

async function runGenerator(doc: CatalogDoc, ctx: GenCtx): Promise<void> {
  switch (doc.generator) {
    case 'commercialInvoice':
    case 'proformaInvoice':
      await generateCommercialInvoicePdf({
        currency: ctx.currency,
        destinationCountry: ctx.countryName,
        recipient: { country: ctx.countryName },
        number: doc.generator === 'proformaInvoice' ? `PRO-${new Date().getFullYear()}-0001` : undefined,
      });
      return;
    case 'packingList':
      await generatePackingListPdf({});
      return;
    case 'exportDeclaration':
      await generateExportDeclarationPdf({ destinationCountry: ctx.countryName, currency: ctx.currency });
      return;
    case 'insuranceCertificate':
      await generateInsuranceCertificatePdf({
        currency: ctx.currency,
        route: `Le Havre (FR) → ${ctx.countryName}, maritime`,
        insured: ctx.clientName,
      });
      return;
    case 'customsMandate':
      await generateCustomsMandatePdf({
        principal: { name: ctx.clientName },
        destinationCountry: ctx.countryName,
        signatureDataUrl: ctx.signatureDataUrl,
        signedDate: ctx.signedDate,
      });
      return;
    case 'cmr':
    case 'contract':
    case 'inspectionReport':
    default:
      // Documents véhicule / transport → format contrat officiel existant.
      await generateContractPdf({
        reference: `2026-${Math.floor(1000 + Math.random() * 8999)}-FE12`,
        copyLabel: 'EXEMPLAIRE\nCLIENT',
        clientName: ctx.clientName,
        departureClientSigned: !!ctx.signatureDataUrl,
        departureClientSignedDate: ctx.signedDate,
        signatureDataUrl: ctx.signatureDataUrl,
        signedDate: ctx.signedDate,
      });
      return;
  }
}
