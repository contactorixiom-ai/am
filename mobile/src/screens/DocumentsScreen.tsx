import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { PaymentSheet } from '../components/PaymentSheet';
import { Pill } from '../components/Pill';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { Surface } from '../components/Surface';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { generateContractPdf, generateInvoicePdf } from '../utils/pdf';

// Espace « Documents » CLIENT — volontairement simple : le client n'a que
//   1. ses contrats à signer,
//   2. ses factures à régler / télécharger.
// Toute la gestion documentaire douanière (dossier, bordereaux, déclarations)
// se fait côté admin (Roger), pas ici.

const CONTRACTS_KEY = 'axis.contracts.v1';
const INVOICE_STORAGE_KEY = 'axis.docs.v1';

interface ContractDoc {
  id: number;
  title: string;
  ref: string;
  kind: 'mission' | 'parcel';
  signed: boolean;
  signedAt?: string;
}

interface Invoice {
  id: number;
  title: string;
  ref: string;
  date: string;
  amountEur: number;
  paid: boolean;
}

const INITIAL_CONTRACTS: ContractDoc[] = [
  { id: 1, title: 'Contrat de convoyage', ref: 'Paris → Bruxelles · AX-2847', kind: 'mission', signed: false },
  { id: 2, title: 'Contrat de transport', ref: 'Fret 4 palettes → Dakar · AX-2026-8841', kind: 'parcel', signed: false },
];

const INITIAL_INVOICES: Invoice[] = [
  { id: 5, title: 'FA-2026-0184', ref: 'Convoyage Paris → Bruxelles', date: '14 mai 2026', amountEur: 512, paid: true },
  { id: 6, title: 'FA-2026-0179', ref: 'Fret 4 palettes → Dakar', date: '08 mai 2026', amountEur: 1240, paid: false },
];

export function DocumentsScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const clientName = user ? `${user.firstName} ${user.lastName}` : 'Client Axis Import';
  const clientEmail = user?.email;

  // ─── Contrats ─────────────────────────────────────────────────────────────
  const [contracts, setContracts] = useState<ContractDoc[]>(INITIAL_CONTRACTS);
  useEffect(() => {
    AsyncStorage.getItem(CONTRACTS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Record<number, { signed?: boolean; signedAt?: string }>;
        setContracts((prev) => prev.map((c) => (saved[c.id] ? { ...c, signed: !!saved[c.id].signed, signedAt: saved[c.id].signedAt } : c)));
      } catch { /* ignore */ }
    });
  }, []);

  const persistContracts = (next: ContractDoc[]) => {
    const toSave: Record<number, { signed: boolean; signedAt?: string }> = {};
    next.forEach((c) => { toSave[c.id] = { signed: c.signed, signedAt: c.signedAt }; });
    AsyncStorage.setItem(CONTRACTS_KEY, JSON.stringify(toSave)).catch(() => {});
  };

  // ─── Factures ─────────────────────────────────────────────────────────────
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

  // ─── Signature ────────────────────────────────────────────────────────────
  const [signing, setSigning] = useState<ContractDoc | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const openSign = (c: ContractDoc) => { setHasInk(false); setSigning(c); };

  const confirmSign = async () => {
    if (!signing) return;
    if (padRef.current?.isEmpty()) {
      notify('Signature vide', 'Trace ta signature dans le cadre avant de valider.');
      return;
    }
    const url = padRef.current?.toDataUrl() ?? undefined;
    const at = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const c = signing;
    setSigning(null);
    setContracts((prev) => {
      const next = prev.map((x) => (x.id === c.id ? { ...x, signed: true, signedAt: at } : x));
      persistContracts(next);
      return next;
    });
    try {
      await generateContractPdf({
        reference: c.ref.split('·').pop()?.trim() || `2026-${Math.floor(1000 + Math.random() * 8999)}`,
        copyLabel: 'EXEMPLAIRE\nCLIENT',
        clientName,
        departureClientSigned: true,
        departureClientSignedDate: at,
        signatureDataUrl: url,
        signedDate: at,
      });
    } catch { /* le statut signé est déjà enregistré */ }
    notify('Contrat signé', 'Ta signature est enregistrée. Le PDF signé a été téléchargé.');
  };

  const downloadContract = async (c: ContractDoc) => {
    await generateContractPdf({
      reference: c.ref.split('·').pop()?.trim() || '2026-0001',
      copyLabel: 'EXEMPLAIRE\nCLIENT',
      clientName,
      departureClientSigned: c.signed,
      departureClientSignedDate: c.signedAt,
      signedDate: c.signedAt,
    });
    notify('Contrat téléchargé', `${c.title}.pdf enregistré dans tes fichiers.`);
  };

  const downloadInvoice = async (inv: Invoice) => {
    await generateInvoicePdf({
      number: inv.title, date: inv.date, amountEur: inv.amountEur, paid: inv.paid,
      description: inv.ref, clientName, clientEmail,
    });
    notify('Facture téléchargée', `${inv.title}.pdf enregistré dans tes fichiers.`);
  };

  const payInvoice = (inv: Invoice) => {
    setInvoices((prev) => {
      const next = prev.map((i) => (i.id === inv.id ? { ...i, paid: true } : i));
      persistInvoices(next);
      return next;
    });
    notify('Paiement enregistré', `La facture ${inv.title} est réglée.`);
  };

  const toSignCount = contracts.filter((c) => !c.signed).length;
  const toPayCount = invoices.filter((i) => !i.paid).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Mes documents" subtitle="Contrats à signer & factures" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}>
        {/* ─── Contrats ─── */}
        <SectionLabel icon="sig" label={`Contrats${toSignCount ? ` · ${toSignCount} à signer` : ''}`} theme={theme} />
        {contracts.map((c) => (
          <Surface key={c.id} padded style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.sig size={20} color={theme.navy} stroke={1.7} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Pill tone={c.signed ? 'good' : 'warn'}>{c.signed ? 'Signé' : 'À signer'}</Pill>
                <Text style={{ fontSize: 14, color: theme.ink, marginTop: 6, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{c.title}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {c.signed ? `Signé le ${c.signedAt}` : c.ref}
                </Text>
              </View>
              {c.signed ? (
                <IconBtn onPress={() => downloadContract(c)} theme={theme}>
                  <Icons.arrow size={15} color={theme.ink} stroke={2} />
                </IconBtn>
              ) : (
                <Button kind="gold" size="sm" onPress={() => openSign(c)} rightIcon={<Icons.sig size={15} color={theme.navy} stroke={2} />}>
                  Signer
                </Button>
              )}
            </View>
          </Surface>
        ))}

        {/* ─── Factures ─── */}
        <SectionLabel icon="euro" label={`Factures${toPayCount ? ` · ${toPayCount} à régler` : ''}`} theme={theme} style={{ marginTop: 8 }} />
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
                <IconBtn onPress={() => downloadInvoice(inv)} theme={theme}>
                  <Icons.arrow size={15} color={theme.ink} stroke={2} />
                </IconBtn>
              ) : (
                <Button kind="gold" size="sm" onPress={() => setPaying(inv)} rightIcon={<Icons.card size={15} color={theme.navy} stroke={2} />}>
                  Régler
                </Button>
              )}
            </View>
          </Surface>
        ))}

        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center', marginTop: 8, lineHeight: 16 }}>
          Les documents douaniers (bordereaux, déclarations, packing list…) sont préparés par Axis. Tu n'as rien à gérer de ce côté.
        </Text>
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
                <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>Signer le contrat</Text>
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

function SectionLabel({ icon, label, theme, style }: { icon: keyof typeof Icons; label: string; theme: ReturnType<typeof useTheme>['theme']; style?: object }) {
  const Ic = Icons[icon];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }, style]}>
      <Ic size={15} color={theme.muted} stroke={1.8} />
      <Text style={{ fontSize: 11.5, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
    </View>
  );
}

function IconBtn({ onPress, theme, children }: { onPress: () => void; theme: ReturnType<typeof useTheme>['theme']; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: theme.line,
        backgroundColor: pressed ? theme.bgSoft : theme.surface, alignItems: 'center', justifyContent: 'center',
      })}
    >
      {children}
    </Pressable>
  );
}
