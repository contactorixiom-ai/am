import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { Surface } from '../components/Surface';
import { notify } from '../utils/notify';
import { generateContractPdf, generateInvoicePdf } from '../utils/pdf';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

type FilterId = 'all' | 'contrat' | 'fact' | 'cmr' | 'douane';

interface Doc {
  id: number;
  cat: Exclude<FilterId, 'all'>;
  type: string;
  tone: PillTone;
  title: string;
  ref: string;
  date: string;
  size: string;
  iconKey: keyof typeof Icons;
  needsSignature?: boolean;
  signatureUrl?: string;
  signedAt?: string;
  amountEur?: number;
  paid?: boolean;
}

const INITIAL_DOCS: Doc[] = [
  { id: 1, cat: 'contrat', type: 'À signer', tone: 'warn', title: 'Contrat de convoyage', ref: 'AX-2847 · BMW Série 3', date: '22 mai 2026', size: '178 ko', iconKey: 'sig', needsSignature: true },
  { id: 2, cat: 'contrat', type: 'Contrat', tone: 'navy', title: 'État des lieux — départ', ref: 'AX-2847 · BMW Série 3', date: '22 mai 2026', size: '2,1 Mo', iconKey: 'doc' },
  { id: 3, cat: 'cmr', type: 'CMR', tone: 'gold', title: 'Lettre de voiture internationale', ref: 'AX-2811 · 4 palettes', date: '18 mai 2026', size: '320 ko', iconKey: 'globe' },
  { id: 4, cat: 'douane', type: 'Douane', tone: 'gold', title: 'Déclaration export — Sénégal', ref: 'AX-2811', date: '17 mai 2026', size: '440 ko', iconKey: 'globe' },
  { id: 5, cat: 'fact', type: 'Facture', tone: 'good', title: 'FA-2026-0184', ref: 'Convoyage Paris → Bruxelles', date: '14 mai 2026', size: '64 ko', iconKey: 'euro', amountEur: 512, paid: true },
  { id: 6, cat: 'fact', type: 'Facture', tone: 'warn', title: 'FA-2026-0179', ref: 'Fret 4 palettes → Dakar', date: '08 mai 2026', size: '68 ko', iconKey: 'euro', amountEur: 1240, paid: false },
];

const STORAGE_KEY = 'axis.docs.v1';

export function DocumentsScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const [tab, setTab] = useState<FilterId>('all');
  const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);

  // Restore signed / paid state from local storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<Record<number, Partial<Doc>>>;
        setDocs((prev) =>
          prev.map((d) => {
            const patch = saved[d.id];
            if (!patch) return d;
            return { ...d, ...patch };
          }),
        );
      } catch {
        // ignore corrupted state
      }
    });
  }, []);

  // Persist any change
  useEffect(() => {
    const toSave: Record<number, Partial<Doc>> = {};
    docs.forEach((d) => {
      if (d.signedAt || d.signatureUrl || d.paid !== INITIAL_DOCS.find((i) => i.id === d.id)?.paid) {
        toSave[d.id] = {
          signedAt: d.signedAt,
          signatureUrl: d.signatureUrl,
          paid: d.paid,
          needsSignature: d.needsSignature,
          tone: d.tone,
          type: d.type,
        };
      }
    });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [docs]);

  const [signing, setSigning] = useState<Doc | null>(null);
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const clientName = user ? `${user.firstName} ${user.lastName}` : 'Client Axis Import';
  const clientEmail = user?.email;

  const downloadPdf = (d: Doc) => {
    if (d.cat === 'fact' && d.amountEur) {
      generateInvoicePdf({
        number: d.title,
        date: d.date,
        amountEur: d.amountEur,
        paid: !!d.paid,
        description: d.ref,
        clientName,
        clientEmail,
      });
      notify('Facture téléchargée', `${d.title}.pdf a été enregistré dans tes fichiers.`);
      return;
    }
    // Contrat / état des lieux / CMR / douane → format contrat officiel
    const missionRef = d.ref.split('·')[0].trim();
    const vehicle = d.ref.split('·')[1]?.trim();
    generateContractPdf({
      reference: `2026-${missionRef.replace(/[^0-9]/g, '').padStart(4, '0')}-FE12`,
      copyLabel: 'EXEMPLAIRE\nCLIENT',
      vehicleCategory: vehicle?.toLowerCase().includes('utilit') ? 'Utilitaire' : 'Berline',
      driverName: 'Karim Diallo',
      driverPhone: '+33 6 12 34 56 78',
      driverLicense: 'B · 12AB34567',
      estimatedKm: 312,
      estimatedDuration: '4 h 30',
      missionReference: missionRef,
      clientName,
      vehicleBrandModel: vehicle ?? 'BMW Série 3',
      plate: 'AX-2847-AI',
      pickupDate: d.date,
      pickupTime: '08h30',
      pickupContact: '+33 6 11 22 33 44',
      pickupAddress: '14 rue de Vaugirard, 75015 Paris',
      deliveryDate: d.date,
      deliveryTime: '14h32',
      deliveryContact: '+32 471 22 33 44',
      deliveryAddress: 'Avenue Louise 250, 1050 Bruxelles',
      departureKm: 48230,
      departureFuel: 0.75,
      departureDate: d.date,
      departureTime: '08h32',
      departureObservations: 'Véhicule en parfait état. Rayure légère portière avant droite (R).',
      departureClientSigned: !!d.signatureUrl,
      departureClientSignedDate: d.signedAt,
      departureDriverSigned: !!d.signatureUrl,
    });
    notify('Document téléchargé', `Le PDF de "${d.title}" a été enregistré dans tes fichiers.`);
  };

  const pendingSignature = docs.find((d) => d.needsSignature && !d.signedAt);

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: docs.length, contrat: 0, fact: 0, cmr: 0, douane: 0 };
    docs.forEach((d) => { c[d.cat] += 1; });
    return c;
  }, [docs]);

  const visible = tab === 'all' ? docs : docs.filter((d) => d.cat === tab);

  const openSign = (doc: Doc) => {
    setHasInk(false);
    setSigning(doc);
  };

  const confirmSign = () => {
    if (!signing) return;
    if (padRef.current?.isEmpty()) {
      notify('Signature vide', 'Trace ta signature dans le cadre avant de valider.');
      return;
    }
    const url = padRef.current?.toDataUrl() ?? undefined;
    const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    setDocs((prev) =>
      prev.map((d) =>
        d.id === signing.id
          ? { ...d, signedAt: now, signatureUrl: url, type: 'Signé', tone: 'good' as PillTone, needsSignature: false }
          : d,
      ),
    );
    setSigning(null);
    notify('Document signé', 'Ta signature a été enregistrée. Le PDF signé est disponible dans tes documents.');
  };

  const payInvoice = (doc: Doc) => {
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, paid: true, tone: 'good' as PillTone } : d)));
    setViewing((v) => (v && v.id === doc.id ? { ...v, paid: true } : v));
    notify('Paiement enregistré', `La facture ${doc.title} est marquée comme réglée.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title="Documents"
        subtitle="Signature, factures, douane"
        trailing={
          <Pressable
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: pressed ? theme.line : theme.bgSoft,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Icons.search size={18} color={theme.ink} stroke={1.8} />
          </Pressable>
        }
      />

      {/* Filtres */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 16, gap: 8 }}>
          {([
            { id: 'all', label: 'Tous' },
            { id: 'contrat', label: 'Contrats' },
            { id: 'fact', label: 'Factures' },
            { id: 'cmr', label: 'CMR' },
            { id: 'douane', label: 'Douane' },
          ] as { id: FilterId; label: string }[]).map((f) => {
            const on = tab === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setTab(f.id)}
                style={{
                  flexShrink: 0, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                  borderWidth: 1, borderColor: on ? theme.select : theme.line,
                  backgroundColor: on ? theme.select : theme.surface,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.medium }}>{f.label}</Text>
                <Text style={{ fontSize: 11, color: on ? theme.selectInk : theme.muted, opacity: 0.8, fontFamily: TYPO.weights.semibold }}>{counts[f.id]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
        {/* Carte "à signer" */}
        {pendingSignature ? (
          <Surface padded flat style={{ padding: 14, backgroundColor: theme.navy, borderColor: theme.navy }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.gold + '2E', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.sig size={22} color={theme.goldHi} stroke={1.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 0.9, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>À signer</Text>
                <Text style={{ fontSize: 14.5, color: '#F5F1E8', lineHeight: 18, marginTop: 2, fontFamily: TYPO.weights.semibold }}>
                  {pendingSignature.title} {pendingSignature.ref.split('·')[0].trim()}
                </Text>
              </View>
              <Button kind="gold" size="sm" onPress={() => openSign(pendingSignature)}>Signer</Button>
            </View>
          </Surface>
        ) : null}

        {/* Liste */}
        {visible.map((d) => {
          const IconComp = Icons[d.iconKey];
          const isInvoice = d.cat === 'fact';
          return (
            <Pressable key={d.id} onPress={() => (isInvoice ? setViewing(d) : d.needsSignature && !d.signedAt ? openSign(d) : setViewing(d))}>
              <Surface padded style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <IconComp size={22} color={theme.navy} stroke={1.6} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Pill tone={d.signedAt ? 'good' : isInvoice ? (d.paid ? 'good' : 'warn') : d.tone}>
                        {d.signedAt ? 'Signé' : isInvoice ? (d.paid ? 'Payé' : 'À régler') : d.type}
                      </Pill>
                      {d.signatureUrl ? (
                        <Image source={{ uri: d.signatureUrl }} style={{ width: 56, height: 22 }} resizeMode="contain" />
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 14, color: theme.ink, marginTop: 6, fontFamily: TYPO.weights.semibold }}>{d.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }}>
                      {isInvoice && d.amountEur ? `${d.amountEur.toLocaleString('fr-FR')} € · ${d.ref}` : d.ref}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>{d.signedAt ?? d.date}</Text>
                      <Text style={{ fontSize: 11, color: theme.muted }}>·</Text>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>{d.size}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); downloadPdf(d); }}
                    style={({ pressed }) => ({
                      width: 34, height: 34, borderRadius: 10,
                      borderWidth: 1, borderColor: theme.line,
                      backgroundColor: pressed ? theme.bgSoft : theme.surface,
                      alignItems: 'center', justifyContent: 'center',
                    })}
                  >
                    <Icons.arrow size={15} color={theme.ink} stroke={2} />
                  </Pressable>
                </View>
              </Surface>
            </Pressable>
          );
        })}
      </ScrollView>

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
                <Text numberOfLines={1} style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{signing?.title}</Text>
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

      {/* ─── Modal détail document / facture ─── */}
      <Modal visible={!!viewing} transparent animationType="slide" onRequestClose={() => setViewing(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Pill tone={viewing?.signedAt ? 'good' : viewing?.cat === 'fact' ? (viewing?.paid ? 'good' : 'warn') : viewing?.tone ?? 'navy'}>
                  {viewing?.signedAt ? 'Signé' : viewing?.cat === 'fact' ? (viewing?.paid ? 'Payé' : 'À régler') : viewing?.type ?? ''}
                </Pill>
                <Text style={{ fontSize: 18, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 8 }}>{viewing?.title}</Text>
                <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>{viewing?.ref}</Text>
              </View>
              <Pressable onPress={() => setViewing(null)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.x size={16} color={theme.ink} stroke={2} />
              </Pressable>
            </View>

            {viewing?.cat === 'fact' && viewing?.amountEur ? (
              <Surface padded style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Montant TTC</Text>
                  <Text style={{ fontSize: 26, color: theme.ink, fontFamily: TYPO.weights.bold, fontVariant: ['tabular-nums'] }}>
                    {viewing.amountEur.toLocaleString('fr-FR')} €
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 12 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Statut</Text>
                  <Text style={{ fontSize: 12.5, color: viewing.paid ? theme.good : theme.warn, fontFamily: TYPO.weights.semibold }}>
                    {viewing.paid ? '✓ Réglée' : 'En attente de règlement'}
                  </Text>
                </View>
              </Surface>
            ) : null}

            {viewing?.signatureUrl ? (
              <Surface padded style={{ padding: 14 }}>
                <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>Signature</Text>
                <Image source={{ uri: viewing.signatureUrl }} style={{ width: '100%', height: 80, marginTop: 8 }} resizeMode="contain" />
                <Text style={{ fontSize: 11.5, color: theme.good, fontFamily: TYPO.weights.semibold, marginTop: 6 }}>Signé le {viewing.signedAt}</Text>
              </Surface>
            ) : null}

            <View style={{ gap: 10 }}>
              {viewing?.cat === 'fact' && !viewing?.paid ? (
                <Button kind="gold" size="lg" fullWidth onPress={() => viewing && payInvoice(viewing)} rightIcon={<Icons.card size={18} color={theme.navy} stroke={2} />}>
                  Régler la facture
                </Button>
              ) : null}
              {viewing?.needsSignature && !viewing?.signedAt ? (
                <Button kind="gold" size="lg" fullWidth onPress={() => { const d = viewing; setViewing(null); if (d) openSign(d); }} rightIcon={<Icons.sig size={18} color={theme.navy} stroke={2} />}>
                  Signer le document
                </Button>
              ) : null}
              <Button kind="outline" size="lg" fullWidth onPress={() => viewing && downloadPdf(viewing)} rightIcon={<Icons.doc size={18} color={theme.navy} stroke={1.8} />}>
                Télécharger le PDF
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
