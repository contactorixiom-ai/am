// Onglet « Personnel » : convoyeurs et salariés d'Axis.
//
// Selon le compte :
//  - administrateur, exploitation, secrétariat, RH : déposer billets de
//    train, de bus et réservations d'hébergement dans l'espace d'un convoyeur ;
//  - RH et administrateur : dossier complet (pièces justificatives, documents
//    reçus), envoi de contrats, assurances, fiches de paie, demandes de pièces ;
//  - comptabilité : justificatifs de frais de chacun.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  addPersonFile,
  cancelRequest,
  getPerson,
  listPeople,
  PersonDetail,
  PersonRow,
  removeStaffFile,
  requestDocument,
} from '../api/staffSpace';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { SHEET_GUTTER } from '../theme/layout';
import { TYPO } from '../theme/tokens';
import { askYesNo, confirmAction, notify } from '../utils/notify';
import { roleLabel } from '../utils/roles';
import { AuthImage } from './AuthImage';
import { Avatar } from './Avatar';
import { kycDocLabel } from './KycReviewPanel';
import { reviewKycDocument } from '../api/kyc';
import { formatAccountNo } from '../api/auth';
import { Button } from './Button';
import { Field } from './Field';
import { Icons } from './Icons';
import { Pill } from './Pill';
import { Chips, FileRow, fmtDay, parseDay, SectionTitle, UploadSheet, openStaffFile } from './StaffWidgets';
import { Surface } from './Surface';

const KYC_LABEL: Record<string, string> = {
  IDENTITY_CARD: 'Pièce d\'identité',
  PASSPORT: 'Passeport',
  DRIVER_LICENSE: 'Permis de conduire',
  HEALTH_INSURANCE_RIGHTS: 'Attestation de droits (assurance maladie)',
  VITALE_CARD: 'Carte Vitale',
  BANK_DETAILS: 'RIB',
  HOSTING_CERTIFICATE: 'Attestation d\'hébergement',
  HOST_IDENTITY: 'Pièce d\'identité de l\'hébergeant',
  SELFIE: 'Photo faciale',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  OTHER: 'Autre pièce',
};
const KYC_STATUS: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' | 'default' }> = {
  APPROVED: { label: 'Validé', tone: 'good' },
  PENDING: { label: 'À vérifier', tone: 'warn' },
  REJECTED: { label: 'Refusé', tone: 'bad' },
  MISSING: { label: 'Manquant', tone: 'bad' },
};

type Filter = 'all' | 'DRIVER' | 'team' | 'todo';

export function PersonnelPanel() {
  const { theme } = useTheme();
  const { user: me } = useSession();
  const role = me?.role;
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setFailed(false);
    try {
      setRows(await listPeople(term));
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { void load(q); }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const shown = useMemo(() => (rows ?? []).filter((r) => {
    if (filter === 'DRIVER') return r.role === 'DRIVER';
    if (filter === 'team') return r.role !== 'DRIVER';
    if (filter === 'todo') return r.pendingExpenses > 0 || r.newDocuments > 0 || r.openRequests > 0 || (r.compliance && !r.compliance.complete);
    return true;
  }), [rows, filter]);

  const intro =
    role === 'ACCOUNTANT'
      ? 'Les justificatifs de frais de chaque convoyeur et salarié.'
      : role === 'SECRETARY'
        ? 'Dépose ici les billets de train, de bus et les réservations d\'hébergement : le convoyeur les retrouve dans « Mon espace » et reçoit une notification.'
        : role === 'HR' || role === 'ADMIN'
          ? 'Dossier de chaque convoyeur et salarié : pièces justificatives, documents reçus, contrats, assurances et pièces à demander. Tu peux aussi y déposer billets et réservations.'
          : 'Dépose ici les billets de train, de bus et les réservations d\'hébergement des convoyeurs pour leurs missions.';

  return (
    <View style={{ gap: 12 }}>
      <Surface padded style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>Personnel</Text>
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>{intro}</Text>
      </Surface>
      <Field value={q} onChangeText={setQ} placeholder="Rechercher un nom, un e-mail, un téléphone, un n° AX-…" autoCapitalize="none" />
      <Chips<Filter>
        options={[
          { key: 'all', label: 'Tous' },
          { key: 'DRIVER', label: 'Convoyeurs' },
          { key: 'team', label: 'Salariés' },
          { key: 'todo', label: 'À traiter' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {rows === null && !failed ? <ActivityIndicator color={theme.link} /> : null}
      {failed ? (
        <Surface padded style={{ gap: 8 }}>
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Liste indisponible pour le moment.</Text>
          <Button kind="outline" size="sm" onPress={() => void load(q)} style={{ alignSelf: 'flex-start' }}>Réessayer</Button>
        </Surface>
      ) : null}
      {rows && !shown.length ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}>Personne à afficher.</Text> : null}
      {shown.map((p) => (
        <Pressable key={p.id} onPress={() => setOpenId(p.id)}>
          <Surface padded style={{ gap: 8, opacity: p.status === 'SUSPENDED' ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={`${p.firstName} ${p.lastName}`} url={p.avatarUrl} size={44} tone={p.role === 'DRIVER' ? 'navy' : 'gold'} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{p.firstName} {p.lastName}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {roleLabel(p.role)}{p.accountNo ? ` · ${formatAccountNo(p.accountNo)}` : ''}{p.phone ? ` · ${p.phone}` : ''}
                </Text>
              </View>
              <Icons.chev size={16} color={theme.muted} stroke={2} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {p.compliance ? (
                <Pill tone={p.compliance.complete ? 'good' : 'warn'}>
                  {p.compliance.complete ? 'Dossier complet' : `Dossier : ${p.compliance.items.filter((i) => i.status !== 'APPROVED').length} pièce(s) à régler`}
                </Pill>
              ) : null}
              {p.newDocuments ? <Pill tone="warn">{p.newDocuments} document(s) reçu(s)</Pill> : null}
              {p.pendingExpenses ? <Pill tone="warn">{p.pendingExpenses} frais à traiter</Pill> : null}
              {p.openRequests ? <Pill tone="navy">{p.openRequests} demande(s) en attente</Pill> : null}
              {p.status === 'SUSPENDED' ? <Pill tone="bad">Suspendu</Pill> : null}
            </View>
          </Surface>
        </Pressable>
      ))}
      <PersonSheet id={openId} onClose={() => setOpenId(null)} onChanged={() => void load(q)} />
    </View>
  );
}

function PersonSheet({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { theme } = useTheme();
  const { user: me } = useSession();
  const role = me?.role;
  const canTravel = role === 'ADMIN' || role === 'MANAGER' || role === 'HR' || role === 'SECRETARY';
  const canHr = role === 'ADMIN' || role === 'HR';
  const seesAmounts = role === 'ADMIN' || role === 'ACCOUNTANT';
  const [data, setData] = useState<PersonDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<'TRAVEL' | 'HR_DOCUMENT' | null>(null);
  const [asking, setAsking] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [reqDue, setReqDue] = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setFailed(false);
    try {
      setData(await getPerson(id));
    } catch {
      setFailed(true);
    }
  }, [id]);
  useEffect(() => {
    setData(null);
    setAsking(false);
    void load();
  }, [load]);

  const refresh = () => { void load(); onChanged(); };
  // Pièces justificatives : l'administrateur et la RH les valident ici même.
  const canReviewKyc = role === 'ADMIN' || role === 'HR';
  const [kycBusy, setKycBusy] = useState<string | null>(null);
  const reviewKyc = async (docId: string, status: 'APPROVED' | 'REJECTED') => {
    let note: string | undefined;
    if (status === 'REJECTED') {
      const ok = await askYesNo('Refuser la pièce ?', 'Le convoyeur sera prévenu et devra en envoyer une nouvelle (photo floue, document expiré, mauvais document…).', 'Refuser', 'Annuler');
      if (!ok) return;
      note = 'Pièce illisible ou non conforme : merci d\'en envoyer une nouvelle.';
    }
    setKycBusy(docId);
    try {
      await reviewKycDocument(docId, status, note);
      refresh();
    } catch (e) {
      notify('Action impossible', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setKycBusy(null);
    }
  };

  const sendRequest = async () => {
    if (!id || reqTitle.trim().length < 2) return notify('Demande incomplète', 'Indique la pièce ou l\'information demandée.');
    const dueAt = reqDue.trim() ? parseDay(reqDue) : null;
    if (reqDue.trim() && !dueAt) return notify('Date illisible', 'Écris la date au format JJ/MM/AAAA.');
    setReqSaving(true);
    try {
      await requestDocument(id, { title: reqTitle.trim(), message: reqMessage.trim() || undefined, dueAt: dueAt ?? undefined });
      setReqTitle(''); setReqMessage(''); setReqDue(''); setAsking(false);
      notify('Demande envoyée', 'La personne est prévenue et répond depuis « Mon espace ».');
      refresh();
    } catch (e) {
      notify('Envoi impossible', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setReqSaving(false);
    }
  };

  const u = data?.user;
  const travel = (data?.files ?? []).filter((f) => f.kind === 'TRAVEL');
  const hrDocs = (data?.files ?? []).filter((f) => f.kind === 'HR_DOCUMENT');
  const received = (data?.files ?? []).filter((f) => f.kind === 'EMPLOYEE_DOCUMENT');
  const expenses = (data?.files ?? []).filter((f) => f.kind === 'EXPENSE');

  const removeAction = (fileId: string) => (
    <Button
      kind="ghost"
      size="sm"
      onPress={() => confirmAction('Retirer la pièce', 'Elle disparaît de l\'espace de la personne.', async () => {
        try { await removeStaffFile(fileId); refresh(); } catch (e) { notify('Action impossible', e instanceof Error ? e.message : 'Réessaie.'); }
      }, 'Retirer')}
    >
      Retirer
    </Button>
  );

  return (
    <Modal visible={!!id} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end', ...SHEET_GUTTER }}>
        <View style={{ maxHeight: '92%', backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
              Dossier du personnel
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.x size={16} color={theme.ink} stroke={2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18 }} keyboardShouldPersistTaps="handled">
            {!data && !failed ? <ActivityIndicator color={theme.link} style={{ marginVertical: 30 }} /> : null}
            {failed ? <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Dossier indisponible. Réessaie dans un instant.</Text> : null}
            {u ? (
              <>
                {/* Profil de la personne */}
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => (u.avatarUrl ? setZoom(u.avatarUrl) : undefined)} accessibilityLabel="Agrandir la photo">
                    <Avatar name={`${u.firstName} ${u.lastName}`} url={u.avatarUrl} size={96} tone={u.role === 'DRIVER' ? 'navy' : 'gold'} />
                  </Pressable>
                  <Text style={{ fontSize: 20, color: theme.ink, fontFamily: TYPO.weights.bold, textAlign: 'center' }} numberOfLines={2}>{u.firstName} {u.lastName}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Pill tone={u.role === 'DRIVER' ? 'navy' : 'gold'}>{roleLabel(u.role)}</Pill>
                    {u.accountNo ? <Pill tone="ghost">{formatAccountNo(u.accountNo)}</Pill> : null}
                    {u.status === 'SUSPENDED' ? <Pill tone="bad">Suspendu</Pill> : null}
                  </View>
                </View>
                <Surface padded style={{ gap: 8 }}>
                  <InfoRow label="E-mail" value={u.email} />
                  <InfoRow label="Téléphone" value={u.phone ?? '—'} />
                  <InfoRow label="Inscrit le" value={new Date(u.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} />
                  <InfoRow label="Dernière connexion" value={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Jamais'} />
                  {u.phone ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <Button kind="outline" size="sm" onPress={() => void Linking.openURL(`tel:${u.phone!.replace(/\s/g, '')}`)}>Appeler</Button>
                      <Button kind="outline" size="sm" onPress={() => void Linking.openURL(`mailto:${u.email}`)}>Écrire un e-mail</Button>
                    </View>
                  ) : (
                    <Button kind="outline" size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={() => void Linking.openURL(`mailto:${u.email}`)}>Écrire un e-mail</Button>
                  )}
                </Surface>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {canTravel ? (
                    <Button kind="gold" size="sm" style={{ flexGrow: 1 }} leftIcon={<Icons.bus size={14} color={theme.onGold} stroke={1.9} />} onPress={() => setSheet('TRAVEL')}>
                      Déposer un billet / une réservation
                    </Button>
                  ) : null}
                  {canHr ? (
                    <Button kind="outline" size="sm" style={{ flexGrow: 1 }} leftIcon={<Icons.doc size={14} color={theme.ink} stroke={1.8} />} onPress={() => setSheet('HR_DOCUMENT')}>
                      Envoyer un document RH
                    </Button>
                  ) : null}
                  {canHr ? (
                    <Button kind="outline" size="sm" style={{ flexGrow: 1 }} leftIcon={<Icons.bell size={14} color={theme.ink} stroke={1.8} />} onPress={() => setAsking((a) => !a)}>
                      Demander une pièce
                    </Button>
                  ) : null}
                </View>

                {asking ? (
                  <Surface padded style={{ gap: 10 }}>
                    <Field label="Pièce ou information demandée" value={reqTitle} onChangeText={setReqTitle} placeholder="Ex. RIB, contrat signé, attestation employeur" />
                    <Field label="Message (facultatif)" value={reqMessage} onChangeText={setReqMessage} multiline />
                    <Field label="À fournir avant le (facultatif)" value={reqDue} onChangeText={setReqDue} placeholder="JJ/MM/AAAA" />
                    <Button kind="gold" size="md" loading={reqSaving} onPress={() => void sendRequest()}>Envoyer la demande</Button>
                  </Surface>
                ) : null}

                {data?.compliance ? (
                  <View style={{ gap: 8 }}>
                    <SectionTitle title={u?.role === 'DRIVER' ? 'Pièces obligatoires du convoyeur' : 'Pièces obligatoires du salarié'} />
                    <Surface padded style={{ gap: 8 }}>
                      {data.compliance.items.map((i) => (
                        <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ flex: 1, fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{i.label}</Text>
                          <Pill tone={KYC_STATUS[i.status].tone}>{KYC_STATUS[i.status].label}</Pill>
                        </View>
                      ))}
                      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                        Valide ou refuse chaque pièce ci-dessous : la personne est prévenue.
                      </Text>
                    </Surface>
                  </View>
                ) : null}

                {data?.kyc.length ? (
                  <View style={{ gap: 8 }}>
                    <SectionTitle title={`Pièces justificatives · ${data.kyc.length}`} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {data.kyc.map((d) => (
                        <Pressable key={d.id} onPress={() => (d.mimeType.includes('pdf') ? void openStaffFile(d) : setZoom(d.fileUrl))} style={{ width: 132, gap: 4 }}>
                          {d.mimeType.includes('pdf') ? (
                            <View style={{ width: 132, height: 92, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                              <Icons.doc size={24} color={theme.link} stroke={1.6} />
                            </View>
                          ) : (
                            <AuthImage url={d.fileUrl} style={{ width: 132, height: 92, borderRadius: 10 }} label={KYC_LABEL[d.type]} />
                          )}
                          <Text style={{ fontSize: 11.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={2}>{kycDocLabel(d)}</Text>
                          <Pill tone={KYC_STATUS[d.status]?.tone ?? 'default'}>{KYC_STATUS[d.status]?.label ?? d.status}</Pill>
                          {canReviewKyc && d.status === 'PENDING' ? (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                              <Button kind="primary" size="sm" disabled={kycBusy === d.id} onPress={() => void reviewKyc(d.id, 'APPROVED')}>Valider</Button>
                              <Button kind="ghost" size="sm" disabled={kycBusy === d.id} onPress={() => void reviewKyc(d.id, 'REJECTED')}>Refuser</Button>
                            </View>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {canHr && data?.requests.length ? (
                  <View style={{ gap: 8 }}>
                    <SectionTitle title="Demandes de la RH" />
                    <Surface padded style={{ gap: 8 }}>
                      {data.requests.map((r) => (
                        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{r.title}</Text>
                            <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                              {r.requestedByName} · {fmtDay(r.createdAt)}{r.dueAt ? ` · avant le ${fmtDay(r.dueAt)}` : ''}
                            </Text>
                          </View>
                          <Pill tone={r.status === 'DONE' ? 'good' : r.status === 'OPEN' ? 'warn' : 'default'}>
                            {r.status === 'DONE' ? 'Reçue' : r.status === 'OPEN' ? 'En attente' : 'Annulée'}
                          </Pill>
                          {r.status === 'OPEN' ? (
                            <Button kind="ghost" size="sm" onPress={() => { cancelRequest(r.id).then(refresh).catch(() => notify('Action impossible', 'Réessaie.')); }}>Annuler</Button>
                          ) : null}
                        </View>
                      ))}
                    </Surface>
                  </View>
                ) : null}

                {canHr ? (
                  <FileGroup title="Documents reçus" empty="Aucun document reçu.">
                    {received.map((f) => <FileRow key={f.id} file={f} />)}
                  </FileGroup>
                ) : null}
                {canHr ? (
                  <FileGroup title="Documents envoyés par la RH" empty="Aucun document envoyé.">
                    {hrDocs.map((f) => <FileRow key={f.id} file={f} showStatus={false} actions={removeAction(f.id)} />)}
                  </FileGroup>
                ) : null}
                {canTravel ? (
                  <FileGroup title="Billets et réservations" empty="Aucun billet déposé.">
                    {travel.map((f) => (
                      <FileRow key={f.id} file={f} showStatus={false} actions={
                        <>
                          {f.seenAt ? <Pill tone="good">Consulté</Pill> : <Pill tone="default">Pas encore ouvert</Pill>}
                          {removeAction(f.id)}
                        </>
                      } />
                    ))}
                  </FileGroup>
                ) : null}
                {seesAmounts ? (
                  <FileGroup title="Justificatifs de frais" empty="Aucun justificatif.">
                    {expenses.map((f) => <FileRow key={f.id} file={f} showAmount />)}
                  </FileGroup>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>

      {/* Agrandissement d'une pièce */}
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable onPress={() => setZoom(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <AuthImage url={zoom} style={{ width: '100%', height: '80%' }} contain />
        </Pressable>
      </Modal>

      <UploadSheet
        visible={sheet === 'TRAVEL'}
        kind="TRAVEL"
        heading="Billet ou réservation"
        intro={u ? `Déposé dans l'espace de ${u.firstName}, qui est prévenu aussitôt.` : undefined}
        missions={data?.missions}
        onClose={() => setSheet(null)}
        onSubmit={async (v) => {
          if (!id) return;
          await addPersonFile(id, { kind: 'TRAVEL', ...v });
          notify('Billet déposé', 'Le convoyeur le retrouve dans « Mon espace ».');
          refresh();
        }}
      />
      <UploadSheet
        visible={sheet === 'HR_DOCUMENT'}
        kind="HR_DOCUMENT"
        heading="Document RH"
        intro={u ? `Contrat, assurance, fiche de paie… ${u.firstName} le reçoit dans « Mon espace ».` : undefined}
        onClose={() => setSheet(null)}
        onSubmit={async (v) => {
          if (!id) return;
          await addPersonFile(id, { kind: 'HR_DOCUMENT', ...v });
          notify('Document envoyé', 'La personne est prévenue.');
          refresh();
        }}
      />
    </Modal>
  );
}

function FileGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title={`${title}${children.length ? ` · ${children.length}` : ''}`} />
      <Surface padded style={{ paddingVertical: 4 }}>
        {children.length ? children : <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, paddingVertical: 12 }}>{empty}</Text>}
      </Surface>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ width: 128, fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{label}</Text>
      <Text selectable style={{ flex: 1, fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{value}</Text>
    </View>
  );
}
