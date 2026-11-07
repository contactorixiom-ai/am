// Pièces reçues des convoyeurs et salariés :
//  - « Frais » (comptabilité, administrateur) : justificatifs de frais à
//    valider puis rembourser, avec export CSV pour la comptabilité ;
//  - « Pièces reçues » (RH, administrateur) : documents envoyés à la RH.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  categoryLabel,
  euros,
  listExpenses,
  listReceivedDocuments,
  reviewDocument,
  reviewExpense,
  StaffFile,
  StaffFileStatus,
  STATUS_LABEL,
} from '../api/staffSpace';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { downloadCsv } from '../utils/csv';
import { notify } from '../utils/notify';
import { Button } from './Button';
import { Field } from './Field';
import { Chips, FileRow, fmtDay } from './StaffWidgets';
import { Surface } from './Surface';

type Mode = 'EXPENSE' | 'EMPLOYEE_DOCUMENT';
type Filter = 'TODO' | StaffFileStatus | 'ALL';

export function StaffInboxPanel({ mode }: { mode: Mode }) {
  const { theme } = useTheme();
  const expense = mode === 'EXPENSE';
  const [rows, setRows] = useState<StaffFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('TODO');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRows(expense ? await listExpenses() : await listReceivedDocuments());
    } catch {
      setFailed(true);
    }
  }, [expense]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((f) => {
      if (filter === 'TODO' && !(f.status === 'PENDING' || (expense && f.status === 'APPROVED'))) return false;
      if (filter !== 'TODO' && filter !== 'ALL' && f.status !== filter) return false;
      if (!term) return true;
      const who = f.user ? `${f.user.firstName} ${f.user.lastName} ${f.user.email}` : '';
      return `${who} ${f.title} ${f.missionRef ?? ''}`.toLowerCase().includes(term);
    });
  }, [rows, filter, q, expense]);

  const total = shown.reduce((n, f) => n + (f.amountCents ?? 0), 0);

  const act = async (f: StaffFile, status: StaffFileStatus) => {
    setBusy(f.id);
    try {
      const note = notes[f.id]?.trim() || undefined;
      if (status === 'REJECTED' && !note) {
        notify('Motif requis', 'Indique pourquoi la pièce est refusée : la personne le verra.');
        return;
      }
      const updated = expense ? await reviewExpense(f.id, status, note) : await reviewDocument(f.id, status, note);
      setRows((prev) => (prev ?? []).map((r) => (r.id === f.id ? { ...r, ...updated, user: r.user } : r)));
    } catch (e) {
      notify('Action impossible', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    const ok = downloadCsv(
      `axis-frais-${new Date().toISOString().slice(0, 10)}`,
      ['Date d\'envoi', 'Date de la dépense', 'Convoyeur / salarié', 'E-mail', 'Catégorie', 'Intitulé', 'Mission', 'Montant TTC (€)', 'Statut', 'Note'],
      shown.map((f) => [
        fmtDay(f.createdAt),
        fmtDay(f.spentAt),
        f.user ? `${f.user.firstName} ${f.user.lastName}` : '',
        f.user?.email ?? '',
        categoryLabel(f.kind, f.category),
        f.title,
        f.missionRef ?? '',
        f.amountCents ? (f.amountCents / 100).toFixed(2).replace('.', ',') : '',
        STATUS_LABEL[f.status],
        [f.note, f.reviewNote].filter(Boolean).join(' / '),
      ]),
    );
    if (!ok) notify('Export', 'L\'export CSV se fait depuis la version web (ordinateur).');
  };

  const filters: { key: Filter; label: string }[] = expense
    ? [
        { key: 'TODO', label: 'À traiter' },
        { key: 'PENDING', label: 'Reçus' },
        { key: 'APPROVED', label: 'Validés' },
        { key: 'REIMBURSED', label: 'Remboursés' },
        { key: 'REJECTED', label: 'Refusés' },
        { key: 'ALL', label: 'Tous' },
      ]
    : [
        { key: 'TODO', label: 'À traiter' },
        { key: 'APPROVED', label: 'Validés' },
        { key: 'REJECTED', label: 'Refusés' },
        { key: 'ALL', label: 'Tous' },
      ];

  return (
    <View style={{ gap: 12 }}>
      <Surface padded style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>
          {expense ? 'Justificatifs de frais' : 'Pièces reçues par la RH'}
        </Text>
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
          {expense
            ? 'Tickets de caisse, péages, carburant… envoyés par les convoyeurs et salariés depuis « Mon espace ». Valide-les, puis marque-les remboursés : la personne est prévenue à chaque étape.'
            : 'Documents envoyés à la RH par les convoyeurs et salariés (réponses aux demandes, contrats signés, attestations).'}
        </Text>
      </Surface>
      <Field value={q} onChangeText={setQ} placeholder="Rechercher un nom, une mission" autoCapitalize="none" />
      <Chips<Filter> options={filters} value={filter} onChange={setFilter} />
      {expense && rows ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
            {shown.length} justificatif(s) · {euros(total)}
          </Text>
          <Button kind="outline" size="sm" onPress={exportCsv} disabled={!shown.length}>Export CSV</Button>
        </View>
      ) : null}
      {rows === null && !failed ? <ActivityIndicator color={theme.link} /> : null}
      {failed ? (
        <Surface padded style={{ gap: 8 }}>
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Liste indisponible pour le moment.</Text>
          <Button kind="outline" size="sm" onPress={() => void load()} style={{ alignSelf: 'flex-start' }}>Réessayer</Button>
        </Surface>
      ) : null}
      {rows && !shown.length ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}>Rien à afficher.</Text> : null}
      {shown.length ? (
        <Surface padded style={{ paddingVertical: 4 }}>
          {shown.map((f) => (
            <View key={f.id}>
              <FileRow
                file={f}
                showAmount={expense}
                showOwner
                actions={
                  <>
                    {f.status === 'PENDING' ? (
                      <>
                        <Button kind="primary" size="sm" loading={busy === f.id} onPress={() => void act(f, 'APPROVED')}>Valider</Button>
                        <Button kind="ghost" size="sm" disabled={busy === f.id} onPress={() => void act(f, 'REJECTED')}>Refuser</Button>
                      </>
                    ) : null}
                    {expense && f.status === 'APPROVED' ? (
                      <Button kind="gold" size="sm" loading={busy === f.id} onPress={() => void act(f, 'REIMBURSED')}>Marquer remboursé</Button>
                    ) : null}
                    {f.status !== 'PENDING' ? (
                      <Button kind="ghost" size="sm" disabled={busy === f.id} onPress={() => void act(f, 'PENDING')}>Remettre à traiter</Button>
                    ) : null}
                  </>
                }
              />
              {f.status === 'PENDING' ? (
                <Field
                  value={notes[f.id] ?? ''}
                  onChangeText={(v) => setNotes((n) => ({ ...n, [f.id]: v }))}
                  placeholder="Motif ou note pour la personne (facultatif, requis pour un refus)"
                  containerStyle={{ marginBottom: 8 }}
                />
              ) : null}
            </View>
          ))}
        </Surface>
      ) : null}
    </View>
  );
}
