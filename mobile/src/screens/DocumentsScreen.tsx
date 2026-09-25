import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { listMissions } from '../api/missions';
import { listParcels } from '../api/parcels';
import { AppBar } from '../components/AppBar';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { PaymentSheet } from '../components/PaymentSheet';
import { listPayments } from '../api/payments';
import { contractVerifyUrl, DocumentRecord, listDocuments, signMissionContract } from '../api/documents';
import { Pill } from '../components/Pill';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { Surface } from '../components/Surface';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import {
  ContractDoc,
  contractsFrom,
  CONTRACTS_KEY,
  Invoice,
  invoicesFrom,
  INVOICE_STORAGE_KEY,
  safeParse,
} from '../utils/clientDocs';
import { generateContractPdf, generateInvoicePdf, PdfProof, signatureFromSvgDataUrl } from '../utils/pdf';

// Espace « Documents » CLIENT — volontairement simple : le client n'a que
//   1. ses contrats à signer,
//   2. ses factures à régler / télécharger.
// Toute la gestion documentaire douanière (dossier, bordereaux, déclarations)
// se fait côté admin (Roger), pas ici.

export function DocumentsScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  // Client pro : la facture est au nom de la société, avec SIREN, TVA et
  // adresse (mentions obligatoires entre professionnels).
  const isPro = user?.accountType === 'PROFESSIONAL' && !!user.companyName;
  const clientName = user
    ? isPro ? `${user.companyName} (${user.firstName} ${user.lastName})` : `${user.firstName} ${user.lastName}`
    : 'Client Axis Import';
  const clientEmail = user?.email;
  const clientBilling = {
    clientAddress: (isPro ? user?.companyAddress || user?.billingAddress : user?.billingAddress) || undefined,
    clientSiren: isPro && user?.companySiret ? user.companySiret.slice(0, 9) : undefined,
    clientVat: isPro ? user?.companyVatId || undefined : undefined,
  };

  // ─── Contrats et factures, dérivés des envois réels du client ────────────
  // Le règlement et la signature font foi côté serveur (tables Payment et
  // Document) : c'est ce qui permet de les retrouver sur un autre téléphone,
  // et à Roger de savoir qui a réglé et qui a signé. Le cache local ne sert
  // plus que de repli hors ligne.
  const [contracts, setContracts] = useState<ContractDoc[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Invoice | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [mRes, pRes, payRes, docRes, signedRaw, paidRaw] = await Promise.all([
          listMissions().catch(() => null),
          listParcels().catch(() => null),
          listPayments().catch(() => null),
          listDocuments({ category: 'CONTRACT' }).catch(() => null),
          AsyncStorage.getItem(CONTRACTS_KEY).catch(() => null),
          AsyncStorage.getItem(INVOICE_STORAGE_KEY).catch(() => null),
        ]);
        if (cancelled) return;

        const missions = mRes?.data ?? [];
        const parcels = pRes?.data ?? [];
        const signed = safeParse<Record<string, { signed?: boolean; signedAt?: string }>>(signedRaw);
        const paid = safeParse<Record<string, { paid?: boolean }>>(paidRaw);

        // Dossiers réglés d'après le serveur — seule source de vérité, avec le
        // numéro de facture légal attribué au règlement.
        const settled = new Map<string, { invoiceNumber?: string | null; paidAt?: string | null }>();
        (payRes?.data ?? [])
          .filter((r) => r.status === 'PAID')
          .forEach((r) => {
            const info = { invoiceNumber: r.invoiceNumber, paidAt: r.paidAt };
            if (r.missionId) settled.set(`m-${r.missionId}`, info);
            if (r.parcelId) settled.set(`p-${r.parcelId}`, info);
          });

        // Contrats signés d'après le serveur — source de vérité.
        const serverSigned = new Map<string, DocumentRecord>();
        (docRes ?? [])
          .filter((d) => d.signedAt && d.missionId)
          .forEach((d) => serverSigned.set(d.missionId as string, d));

        setContracts(
          contractsFrom(missions).map((c) => {
            const rec = serverSigned.get(c.id);
            if (rec?.signedAt) {
              const d = new Date(rec.signedAt);
              return {
                ...c,
                signed: true,
                signedAt: Number.isNaN(d.getTime())
                  ? undefined
                  : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
                signatureUrl: rec.signatureUrl ?? undefined,
                proof: rec.contentHash
                  ? { hash: rec.contentHash, signedAt: rec.signedAt, verifyUrl: contractVerifyUrl(rec.id) }
                  : undefined,
              };
            }
            return signed[c.id] ? { ...c, signed: !!signed[c.id].signed, signedAt: signed[c.id].signedAt } : c;
          }),
        );
        setInvoices(
          invoicesFrom(missions, parcels).map((i) => {
            const s = settled.get(i.id);
            if (!s) return i;
            return {
              ...i,
              paid: true,
              title: s.invoiceNumber ?? i.title,
              date: s.paidAt ? new Date(s.paidAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : i.date,
            };
          }),
        );
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, []),
  );

  const persistContracts = (next: ContractDoc[]) => {
    const toSave: Record<string, { signed: boolean; signedAt?: string }> = {};
    next.forEach((c) => { toSave[c.id] = { signed: c.signed, signedAt: c.signedAt }; });
    AsyncStorage.setItem(CONTRACTS_KEY, JSON.stringify(toSave)).catch(() => {});
  };

  const persistInvoices = (next: Invoice[]) => {
    const toSave: Record<string, { paid: boolean }> = {};
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
    // Les tracés vectoriels servent au rendu du PDF ; la data URL, à la preuve
    // conservée côté serveur. On les capture avant de fermer le pavé.
    const strokes = padRef.current?.toPaths() ?? undefined;
    if (!url) {
      notify('Signature illisible', 'Recommence ta signature dans le cadre.');
      return;
    }
    const at = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const c = signing;

    // La signature part d'abord au serveur : c'est elle qui fait foi et c'est
    // ce qui permet à Roger de la voir. Tant qu'elle n'est pas transmise, on
    // ne déclare pas le contrat signé — sinon le client croirait avoir signé
    // un contrat que personne n'a reçu.
    // La preuve imprimée sur le PDF vient du serveur : empreinte des termes
    // du dossier et horodatage de la signature. Rien n'est fabriqué ici.
    let proof: PdfProof | undefined;
    try {
      const res = await signMissionContract(c.id, url);
      if (res.contentHash && res.signedAt) {
        proof = { hash: res.contentHash, signedAt: res.signedAt, verifyUrl: contractVerifyUrl(res.id) };
      }
    } catch (e) {
      const already = e instanceof ApiError && e.status === 400;
      if (!already) {
        notify(
          'Signature non transmise',
          'Impossible de joindre Axis pour l\'instant. Vérifie ta connexion et réessaie.',
        );
        return;
      }
      // 400 = déjà signé côté serveur : on s'aligne au lieu de bloquer.
    }

    setSigning(null);
    setContracts((prev) => {
      const next = prev.map((x) => (x.id === c.id ? { ...x, signed: true, signedAt: at } : x));
      persistContracts(next);
      return next;
    });
    try {
      await generateContractPdf({
        ...contractPdfBase(c),
        departureClientSigned: true,
        departureClientSignedDate: at,
        departureClientSignature: strokes,
        signatureDataUrl: url,
        signedDate: at,
        proof,
      });
    } catch { /* la signature est enregistrée côté serveur, le PDF est secondaire */ }
    notify('Contrat signé', 'Ta signature est transmise à Axis. Le PDF signé a été téléchargé.');
  };

  // Données communes aux deux usages du PDF (signature et téléchargement).
  const contractPdfBase = (c: ContractDoc) => ({
    reference: c.reference,
    copyLabel: 'EXEMPLAIRE\nCLIENT',
    clientName,
    driverName: c.driverName,
    vehicleBrandModel: c.vehicleLabel,
    plate: c.plate,
    vehicleCategory: c.vehicleCategory,
    pickupDate: c.pickupDate,
  });

  const downloadContract = async (c: ContractDoc) => {
    await generateContractPdf({
      ...contractPdfBase(c),
      departureClientSigned: c.signed,
      departureClientSignedDate: c.signedAt,
      departureClientSignature: signatureFromSvgDataUrl(c.signatureUrl),
      signedDate: c.signedAt,
      proof: c.proof,
    });
    notify('Contrat téléchargé', `${c.title}.pdf enregistré dans tes fichiers.`);
  };

  const downloadInvoice = async (inv: Invoice) => {
    await generateInvoicePdf({
      number: inv.title, date: inv.date, amountEur: inv.amountEur, paid: inv.paid,
      description: inv.ref, clientName, clientEmail, ...clientBilling,
    });
    notify(inv.paid ? 'Facture téléchargée' : 'Bon de commande téléchargé', `${inv.title}.pdf enregistré dans tes fichiers.`);
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
        {loading ? <Skeleton variant="card" count={2} /> : null}
        {!loading && contracts.length === 0 ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="sig"
              title="Aucun contrat"
              subtitle="Ton contrat de convoyage apparaîtra ici dès qu'une mission sera ouverte."
            />
          </Surface>
        ) : null}
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
        {loading ? <Skeleton variant="card" count={1} /> : null}
        {!loading && invoices.length === 0 ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="euro"
              title="Aucune facture"
              subtitle="Tes factures apparaîtront ici une fois le prix de l'envoi confirmé par Axis."
            />
          </Surface>
        ) : null}
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
                  {`${inv.amountEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · ${inv.ref}`}
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
        missionId={paying?.kind === 'mission' ? paying.shipmentId : undefined}
        parcelId={paying?.kind === 'parcel' ? paying.shipmentId : undefined}
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
