// Onglet « Inscrits » de l'espace admin (administrateur uniquement).
//
// La base des comptes de l'application, lisible par Roger : particuliers,
// professionnels, convoyeurs et équipe, avec leur activité (convoyages,
// colis, sommes réglées), une fiche détaillée et un export CSV.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import {
  DirectoryAddress,
  DirectoryEntry,
  DirectorySegment,
  DirectoryStats,
  DirectoryUser,
  getDirectoryEntry,
  getDirectoryStats,
  listDirectory,
} from '../api/directory';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { downloadCsv } from '../utils/csv';
import { notify } from '../utils/notify';
import { roleLabel } from '../utils/roles';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field } from './Field';
import { Icons } from './Icons';
import { Pill, PillTone } from './Pill';
import { StatusBadge } from './StatusBadge';
import { Surface } from './Surface';

interface Props {
  /** Ouvre la fenêtre « lien d'accès » (WhatsApp / SMS / copier). */
  onSendAccess: (target: { userId: string; name: string }) => void;
}

const PAGE_SIZE = 50;

const SEGMENTS: { id: DirectorySegment; label: string; count: (s: DirectoryStats) => number }[] = [
  { id: 'all', label: 'Tous', count: (s) => s.total },
  { id: 'individual', label: 'Particuliers', count: (s) => s.individual },
  { id: 'pro', label: 'Professionnels', count: (s) => s.pro },
  { id: 'driver', label: 'Convoyeurs', count: (s) => s.driver },
  { id: 'staff', label: 'Équipe', count: (s) => s.staff },
];

const KYC_LABEL: Record<string, string> = {
  IDENTITY_CARD: 'Pièce d\'identité',
  PASSPORT: 'Passeport',
  DRIVER_LICENSE: 'Permis de conduire',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  COMPANY_REGISTRATION: 'Kbis',
  VAT_CERTIFICATE: 'Attestation de TVA',
  INSURANCE: 'Assurance',
  OTHER: 'Autre document',
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtEur = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const formatAddress = (a: DirectoryAddress) => {
  const place = [a.postalCode, a.city].filter(Boolean).join(' ');
  const parts = [a.line, place && !a.line.includes(place) ? place : '', a.country && a.country !== 'FR' ? a.country : ''];
  return parts.filter(Boolean).join(', ');
};
const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

function typeOf(u: Pick<DirectoryUser, 'role' | 'accountType'>): { label: string; tone: PillTone } {
  if (u.role === 'ADMIN' || u.role === 'MANAGER') return { label: roleLabel(u.role), tone: 'gold' };
  if (u.role === 'DRIVER') return { label: 'Convoyeur', tone: 'navy' };
  return u.accountType === 'PROFESSIONAL' ? { label: 'Professionnel', tone: 'navy' } : { label: 'Particulier', tone: 'default' };
}

function openLink(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (url.startsWith('http')) window.open(url, '_blank', 'noopener');
    else window.location.href = url;
    return;
  }
  Linking.openURL(url).catch(() => notify('Impossible d\'ouvrir', url));
}

const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '').replace(/^00/, '')}`;

export function DirectoryPanel({ onSendAccess }: Props) {
  const { theme } = useTheme();
  const [stats, setStats] = useState<DirectoryStats | null>(null);
  const [segment, setSegment] = useState<DirectorySegment>('all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<DirectoryUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const reqRef = useRef(0);

  const load = useCallback(async (seg: DirectorySegment, q: string) => {
    const req = ++reqRef.current;
    setFailed(false);
    setRows(null);
    try {
      const res = await listDirectory({ segment: seg, q, page: 1, pageSize: PAGE_SIZE });
      if (req !== reqRef.current) return;
      setRows(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      setPage(1);
    } catch {
      if (req === reqRef.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    getDirectoryStats().then(setStats).catch(() => setStats(null));
  }, []);

  // Recherche : on attend que la saisie se calme avant d'interroger le serveur.
  useEffect(() => {
    const t = setTimeout(() => { void load(segment, query); }, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [segment, query, load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await listDirectory({ segment, q: query, page: page + 1, pageSize: PAGE_SIZE });
      setRows((prev) => [...(prev ?? []), ...res.data]);
      setPage(page + 1);
    } catch {
      notify('Chargement impossible', 'Réessaie dans un instant.');
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: DirectoryUser[] = [];
      for (let p = 1; p <= 50; p += 1) {
        const res = await listDirectory({ segment, q: query, page: p, pageSize: 100 });
        all.push(...res.data);
        if (res.data.length < 100) break;
      }
      const headers = ['Inscrit le', 'Type', 'Prénom', 'Nom', 'Société', 'SIRET', 'N° TVA', 'E-mail', 'Téléphone',
        'Adresse', 'Code postal', 'Ville', 'Pays', 'Origine de l\'adresse',
        'Dernière connexion', 'Convoyages', 'Colis', 'Missions convoyeur', 'Réglé (EUR)', 'Statut'];
      const lines = all.map((u) => [
        new Date(u.createdAt).toLocaleDateString('fr-FR'),
        typeOf(u).label,
        u.firstName,
        u.lastName,
        u.companyName ?? '',
        u.companySiret ?? '',
        u.companyVatId ?? '',
        u.email,
        u.phone ?? '',
        u.address?.line ?? '',
        u.address?.postalCode ?? '',
        u.address?.city ?? '',
        u.address?.country ?? '',
        u.address?.source ?? '',
        u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais',
        u.missionsCount,
        u.parcelsCount,
        u.driverMissionsCount,
        (u.paidCents / 100).toFixed(2).replace('.', ','),
        u.status === 'SUSPENDED' ? 'Suspendu' : 'Actif',
      ]);
      const ok = downloadCsv(`inscrits-axis-${new Date().toISOString().slice(0, 10)}`, headers, lines);
      notify(ok ? 'Export CSV' : 'Export indisponible',
        ok ? `${all.length} inscrit(s) exporté(s). Ouvre le fichier dans Excel.` : 'L\'export CSV est disponible sur la version web / bureau.');
    } catch {
      notify('Export impossible', 'Réessaie dans un instant.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Chiffres clés */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { label: 'Inscrits', value: stats?.total },
          { label: 'Nouveaux (7 j)', value: stats?.new7 },
          { label: 'Actifs (30 j)', value: stats?.active30 },
        ].map((t) => (
          <Surface key={t.label} padded flat style={{ flex: 1, padding: 12, gap: 2 }}>
            <Text style={{ fontSize: 20, color: theme.ink, fontFamily: TYPO.weights.bold, fontVariant: ['tabular-nums'] }}>
              {t.value ?? '–'}
            </Text>
            <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>{t.label}</Text>
          </Surface>
        ))}
      </View>

      <Field
        label="Rechercher"
        value={query}
        onChangeText={setQuery}
        placeholder="Nom, e-mail, téléphone, société, SIRET"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {SEGMENTS.map((s) => {
          const on = s.id === segment;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSegment(s.id)}
              style={{
                paddingHorizontal: 12,
                height: 32,
                borderRadius: 16,
                justifyContent: 'center',
                backgroundColor: on ? theme.select : theme.surface,
                borderWidth: 1,
                borderColor: on ? theme.select : theme.line,
              }}
            >
              <Text style={{ fontSize: 12.5, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.semibold }}>
                {s.label}{stats ? ` · ${s.count(stats)}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, flex: 1 }}>
          {rows ? `${total} compte${total > 1 ? 's' : ''}${query ? ` pour « ${query.trim()} »` : ''}` : ' '}
        </Text>
        <Button kind="outline" size="sm" loading={exporting} onPress={exportCsv}>Exporter (CSV)</Button>
      </View>

      {rows === null && !failed ? <ActivityIndicator color={theme.link} style={{ marginVertical: 20 }} /> : null}
      {failed ? (
        <Surface padded style={{ gap: 8 }}>
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>Annuaire indisponible pour le moment.</Text>
          <Button kind="outline" size="sm" onPress={() => load(segment, query)} style={{ alignSelf: 'flex-start' }}>Réessayer</Button>
        </Surface>
      ) : null}
      {rows && rows.length === 0 ? (
        <Surface padded>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 13 }}>Aucun compte ne correspond.</Text>
        </Surface>
      ) : null}

      {(rows ?? []).map((u) => {
        const type = typeOf(u);
        const activity = [
          u.missionsCount ? `${u.missionsCount} convoyage${u.missionsCount > 1 ? 's' : ''}` : '',
          u.parcelsCount ? `${u.parcelsCount} colis` : '',
          u.driverMissionsCount ? `${u.driverMissionsCount} mission${u.driverMissionsCount > 1 ? 's' : ''} convoyeur` : '',
          u.paidCents ? `${fmtEur(u.paidCents)} réglés` : '',
        ].filter(Boolean).join(' · ');
        return (
          <Pressable key={u.id} onPress={() => setOpenId(u.id)}>
            <Surface padded style={{ gap: 8, opacity: u.status === 'SUSPENDED' ? 0.7 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={fullName(u)} size={40} tone={type.tone === 'gold' ? 'gold' : 'navy'} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                    {u.companyName ? `${u.companyName} · ` : ''}{fullName(u)}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                    {u.email}{u.phone ? ` · ${u.phone}` : ''}
                  </Text>
                </View>
                <Icons.chev size={16} color={theme.faint} stroke={1.8} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Pill tone={type.tone}>{type.label}</Pill>
                <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                  {`Inscrit le ${fmtDate(u.createdAt)} · ${u.lastLoginAt ? `vu le ${fmtDate(u.lastLoginAt)}` : 'jamais connecté'}`}
                </Text>
                {u.status === 'SUSPENDED' ? <Pill tone="bad">Suspendu</Pill> : null}
                {u.role === 'DRIVER' && u.kyc.pending > 0 ? <Pill tone="warn">{`${u.kyc.pending} pièce(s) à vérifier`}</Pill> : null}
              </View>
              {u.address ? (
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {formatAddress(u.address)}
                </Text>
              ) : null}
              {activity ? (
                <Text style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.semibold }}>{activity}</Text>
              ) : null}
            </Surface>
          </Pressable>
        );
      })}

      {rows && rows.length < total ? (
        <Button kind="outline" size="md" fullWidth loading={loadingMore} onPress={loadMore}>
          {`Afficher plus (${total - rows.length} restant${total - rows.length > 1 ? 's' : ''})`}
        </Button>
      ) : null}

      {stats && stats.deleted > 0 ? (
        <Text style={{ fontSize: 11.5, color: theme.faint, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
          {`${stats.deleted} compte${stats.deleted > 1 ? 's' : ''} supprimé${stats.deleted > 1 ? 's' : ''} à la demande des utilisateurs (données effacées).`}
        </Text>
      ) : null}

      <DirectorySheet id={openId} onClose={() => setOpenId(null)} onSendAccess={onSendAccess} />
    </View>
  );
}

function DirectorySheet({ id, onClose, onSendAccess }: { id: string | null; onClose: () => void } & Props) {
  const { theme } = useTheme();
  const [entry, setEntry] = useState<DirectoryEntry | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setEntry(null);
    setFailed(false);
    getDirectoryEntry(id)
      .then((e) => { if (!cancelled) setEntry(e); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [id]);

  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Text style={{ width: 120, fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>{label}</Text>
        <Text style={{ flex: 1, fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} selectable>{value}</Text>
      </View>
    ) : null;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>{title}</Text>
      {children}
    </View>
  );

  const Line = ({ left, sub, status, right }: { left: string; sub: string; status: string; right?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.lineSoft }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{left}</Text>
        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>{sub}</Text>
      </View>
      {right ? <Text style={{ fontSize: 12, color: theme.ink, fontFamily: TYPO.weights.semibold, fontVariant: ['tabular-nums'] }}>{right}</Text> : null}
      <StatusBadge status={status} />
    </View>
  );

  const e = entry;
  const type = e ? typeOf(e) : null;

  return (
    <Modal visible={!!id} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '90%', backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
              Fiche inscrit
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.x size={16} color={theme.ink} stroke={2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 18 }}>
            {!e && !failed ? <ActivityIndicator color={theme.link} style={{ marginVertical: 30 }} /> : null}
            {failed ? <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Fiche indisponible. Réessaie dans un instant.</Text> : null}
            {e && type ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={fullName(e)} size={52} tone={type.tone === 'gold' ? 'gold' : 'navy'} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={{ fontSize: 19, color: theme.ink, fontFamily: TYPO.weights.bold }} numberOfLines={2}>{fullName(e)}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Pill tone={type.tone}>{type.label}</Pill>
                      {e.status === 'SUSPENDED' ? <Pill tone="bad">Suspendu</Pill> : null}
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {e.phone ? (
                    <Button kind="outline" size="sm" style={{ flexGrow: 1 }} leftIcon={<Icons.phone size={14} color={theme.ink} stroke={1.8} />} onPress={() => openLink(`tel:${e.phone}`)}>
                      Appeler
                    </Button>
                  ) : null}
                  {e.phone ? (
                    <Button kind="outline" size="sm" style={{ flexGrow: 1 }} leftIcon={<Icons.chat size={14} color={theme.ink} stroke={1.8} />} onPress={() => openLink(waLink(e.phone!))}>
                      WhatsApp
                    </Button>
                  ) : null}
                  <Button kind="outline" size="sm" style={{ flexGrow: 1 }} onPress={() => openLink(`mailto:${e.email}`)}>E-mail</Button>
                  {e.role === 'CLIENT' || e.role === 'DRIVER' ? (
                    <Button kind="outline" size="sm" style={{ flexGrow: 1 }} onPress={() => { onClose(); onSendAccess({ userId: e.id, name: fullName(e) }); }}>
                      Lien d'accès
                    </Button>
                  ) : null}
                </View>

                <Surface padded style={{ gap: 8 }}>
                  <Row label="E-mail" value={e.email} />
                  <Row label="Téléphone" value={e.phone} />
                  <Row label="Société" value={e.companyName} />
                  <Row label="SIRET" value={e.companySiret} />
                  <Row label="N° TVA" value={e.companyVatId} />
                  <Row label="Adresse" value={e.address ? `${formatAddress(e.address)}\n(${e.address.source.toLowerCase()})` : null} />
                  <Row label="Inscrit le" value={fmtDate(e.createdAt)} />
                  <Row label="Dernière visite" value={e.lastLoginAt ? fmtDate(e.lastLoginAt) : 'Jamais connecté'} />
                  <Row label="E-mail confirmé" value={e.emailVerifiedAt ? `Oui, le ${fmtDate(e.emailVerifiedAt)}` : 'Non'} />
                  <Row label="CGU acceptées" value={e.termsAcceptedAt ? `Le ${fmtDate(e.termsAcceptedAt)}${e.termsVersion ? ` (version ${e.termsVersion})` : ''}` : 'Non'} />
                </Surface>

                {e.driverProfile ? (
                  <Section title="Convoyeur">
                    <Surface padded style={{ gap: 8 }}>
                      <Row label="Ville" value={e.driverProfile.baseCity} />
                      <Row label="Permis" value={e.driverProfile.licenseNumber} />
                      <Row label="Permis valable" value={`Jusqu'au ${fmtDate(e.driverProfile.licenseExpiresAt)}`} />
                      <Row label="Missions faites" value={String(e.driverProfile.completedMissions)} />
                      <Row label="Disponible" value={e.driverProfile.isAvailable ? 'Oui' : 'Non'} />
                    </Surface>
                  </Section>
                ) : null}

                {e.kycDocuments.length ? (
                  <Section title="Pièces envoyées">
                    <Surface padded style={{ gap: 6 }}>
                      {e.kycDocuments.map((k) => (
                        <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ flex: 1, fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{KYC_LABEL[k.type] ?? k.type}</Text>
                          <Pill tone={k.status === 'APPROVED' ? 'good' : k.status === 'REJECTED' ? 'bad' : 'warn'}>
                            {k.status === 'APPROVED' ? 'Validée' : k.status === 'REJECTED' ? 'Refusée' : 'À vérifier'}
                          </Pill>
                        </View>
                      ))}
                    </Surface>
                  </Section>
                ) : null}

                {e.ownedVehicles.length ? (
                  <Section title="Véhicules">
                    <Surface padded style={{ gap: 4 }}>
                      {e.ownedVehicles.map((v) => (
                        <Text key={v.id} style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                          {`${v.make} ${v.model} · ${v.licensePlate}`}
                        </Text>
                      ))}
                    </Surface>
                  </Section>
                ) : null}

                {e.missions.length ? (
                  <Section title="Convoyages commandés">
                    <Surface padded style={{ gap: 0, paddingVertical: 6 }}>
                      {e.missions.map((m) => (
                        <Line key={m.id} left={m.reference} sub={`${m.pickupCity} → ${m.deliveryCity} · ${fmtDate(m.createdAt)}`} status={m.status}
                          right={m.priceCents ? fmtEur(m.priceCents) : undefined} />
                      ))}
                    </Surface>
                  </Section>
                ) : null}

                {e.parcels.length ? (
                  <Section title="Colis et envois">
                    <Surface padded style={{ gap: 0, paddingVertical: 6 }}>
                      {e.parcels.map((p) => (
                        <Line key={p.id} left={p.reference} sub={`${p.originCity} → ${p.destinationCity} · ${fmtDate(p.createdAt)}`} status={p.status}
                          right={p.priceCents ? fmtEur(p.priceCents) : undefined} />
                      ))}
                    </Surface>
                  </Section>
                ) : null}

                {e.driverMissions.length ? (
                  <Section title="Missions en tant que convoyeur">
                    <Surface padded style={{ gap: 0, paddingVertical: 6 }}>
                      {e.driverMissions.map((m) => (
                        <Line key={m.id} left={m.reference} sub={`${m.pickupCity} → ${m.deliveryCity} · ${fmtDate(m.createdAt)}`} status={m.status} />
                      ))}
                    </Surface>
                  </Section>
                ) : null}

                {e.payments.length ? (
                  <Section title="Règlements">
                    <Surface padded style={{ gap: 0, paddingVertical: 6 }}>
                      {e.payments.map((p) => (
                        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.lineSoft }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                              {p.invoiceNumber ?? p.reference ?? 'Règlement'}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{fmtDate(p.paidAt ?? p.createdAt)}</Text>
                          </View>
                          <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.bold, fontVariant: ['tabular-nums'] }}>{fmtEur(p.amountCents)}</Text>
                          <Pill tone={p.status === 'PAID' ? 'good' : p.status === 'REFUNDED' ? 'ghost' : p.status === 'PENDING' ? 'warn' : 'bad'}>
                            {p.status === 'PAID' ? 'Payé' : p.status === 'REFUNDED' ? 'Remboursé' : p.status === 'PENDING' ? 'En attente' : p.status === 'CANCELLED' ? 'Abandonné' : 'Échoué'}
                          </Pill>
                        </View>
                      ))}
                    </Surface>
                  </Section>
                ) : null}

                {!e.missions.length && !e.parcels.length && !e.driverMissions.length ? (
                  <View style={{ padding: 14, borderRadius: RADII.md, backgroundColor: theme.surface2 }}>
                    <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Aucune commande pour le moment.</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
