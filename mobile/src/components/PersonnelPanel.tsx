// Onglet « Personnel » : convoyeurs et salariés d'Axis.
//
// Selon le compte :
//  - administrateur, exploitation, secrétariat, RH : déposer billets de
//    train, de bus et réservations d'hébergement dans l'espace d'un convoyeur ;
//  - RH et administrateur : dossier complet (pièces justificatives, documents
//    reçus), envoi de contrats, assurances, fiches de paie, demandes de pièces ;
//  - comptabilité : justificatifs de frais de chacun.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
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
import { confirmAction, notify } from '../utils/notify';
import { roleLabel } from '../utils/roles';
import { AuthImage } from './AuthImage';
import { Avatar } from './Avatar';
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
      <Field value={q} onChangeText={setQ} placeholder="Rechercher un nom, un e-mail, un téléphone" autoCapitalize="none" />
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
              <Avatar name={`${p.firstName} ${p.lastName}`} size={40} tone={p.role === 'DRIVER' ? 'navy' : 'gold'} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{p.firstName} {p.lastName}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {roleLabel(p.role)}{p.phone ? ` · ${p.phone}` : ''}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={`${u.firstName} ${u.lastName}`} size={52} tone={u.role === 'DRIVER' ? 'navy' : 'gold'} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={{ fontSize: 19, color: theme.ink, fontFamily: TYPO.weights.bold }} numberOfLines={2}>{u.firstName} {u.lastName}</Text>
                    <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }} selectable>
                      {roleLabel(u.role)} · {u.email}{u.phone ? ` · ${u.phone}` : ''}
                    </Text>
                  </View>
                </View>

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
                    <SectionTitle title="Pièces obligatoires du convoyeur" />
                    <Surface padded style={{ gap: 8 }}>
                      {data.compliance.items.map((i) => (
                        <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ flex: 1, fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{i.label}</Text>
                          <Pill tone={KYC_STATUS[i.status].tone}>{KYC_STATUS[i.status].label}</Pill>
                        </View>
                      ))}
                      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                        Les pièces se valident dans l'onglet Convoyeurs.
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
                          <Text style={{ fontSize: 11.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={2}>{KYC_LABEL[d.type] ?? 'Pièce'}</Text>
                          <Pill tone={KYC_STATUS[d.status]?.tone ?? 'default'}>{KYC_STATUS[d.status]?.label ?? d.status}</Pill>
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
