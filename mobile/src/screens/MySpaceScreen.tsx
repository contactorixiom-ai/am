// « Mon espace » des convoyeurs et salariés d'Axis :
//  - annonces du secrétariat ;
//  - pièces demandées par la RH, à envoyer d'ici ;
//  - billets de train, de bus, réservations d'hébergement déposés par Axis ;
//  - documents de la RH (contrat, assurance, fiche de paie…) ;
//  - justificatifs de frais (ticket de caisse, péage, carburant), transmis à
//    la comptabilité ;
//  - accès aux pièces justificatives (identité, permis, carte Vitale…).
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { getMySpace, markFileSeen, MySpace, removeMyFile, sendMyFile, StaffRequest, euros } from '../api/staffSpace';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { FileRow, fmtDay, openStaffFile, SectionTitle, UploadSheet } from '../components/StaffWidgets';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { confirmAction, notify } from '../utils/notify';

type Sheet = { mode: 'expense' } | { mode: 'document' } | { mode: 'request'; request: StaffRequest } | null;

export function MySpaceScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [data, setData] = useState<MySpace | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  const load = useCallback(async () => {
    try {
      setData(await getMySpace());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const isDriver = user?.role === 'DRIVER';
  const files = data?.files ?? [];
  const travel = files.filter((f) => f.kind === 'TRAVEL');
  const hrDocs = files.filter((f) => f.kind === 'HR_DOCUMENT');
  const expenses = files.filter((f) => f.kind === 'EXPENSE');
  const sentDocs = files.filter((f) => f.kind === 'EMPLOYEE_DOCUMENT');
  const openRequests = (data?.requests ?? []).filter((r) => r.status === 'OPEN');
  const pendingTotal = expenses.filter((e) => e.status === 'PENDING' || e.status === 'APPROVED').reduce((n, e) => n + (e.amountCents ?? 0), 0);

  const seen = (id: string, already: string | null) => {
    if (!already) markFileSeen(id).catch(() => undefined);
  };
  const removeMine = (id: string) =>
    confirmAction('Retirer la pièce', 'La pièce est retirée et n\'est plus transmise à Axis.', async () => {
      try {
        await removeMyFile(id);
        void load();
      } catch (e) {
        notify('Action impossible', e instanceof Error ? e.message : 'Réessaie.');
      }
    }, 'Retirer');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Mon espace" subtitle={isDriver ? 'Billets, frais et documents · convoyeur' : 'Billets, frais et documents · salarié'} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={theme.link} />}
      >
        {!data && !failed ? <ActivityIndicator color={theme.link} style={{ marginVertical: 30 }} /> : null}
        {failed ? (
          <Surface padded style={{ gap: 8 }}>
            <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Ton espace est indisponible pour le moment.</Text>
            <Button kind="outline" size="sm" onPress={() => void load()} style={{ alignSelf: 'flex-start' }}>Réessayer</Button>
          </Surface>
        ) : null}

        {/* Actions principales */}
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button kind="gold" size="md" style={{ flexGrow: 1 }} leftIcon={<Icons.euro size={16} color={theme.onGold} stroke={2} />} onPress={() => setSheet({ mode: 'expense' })}>
            Envoyer un justificatif de frais
          </Button>
          <Button kind="outline" size="md" style={{ flexGrow: 1 }} leftIcon={<Icons.doc size={16} color={theme.ink} stroke={1.8} />} onPress={() => setSheet({ mode: 'document' })}>
            Envoyer un document à la RH
          </Button>
          {isDriver ? (
            <Button kind="outline" size="md" style={{ flexGrow: 1 }} leftIcon={<Icons.shield size={16} color={theme.ink} stroke={1.8} />} onPress={() => nav.navigate('KycVerification')}>
              Mes pièces justificatives
            </Button>
          ) : null}
        </View>

        {/* Pièces demandées par la RH */}
        {openRequests.length ? (
          <View style={{ gap: 8 }}>
            <SectionTitle title={`Demandé par la RH · ${openRequests.length}`} />
            {openRequests.map((r) => (
              <Surface key={r.id} padded style={{ gap: 8, borderColor: theme.gold }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icons.warn size={16} color={theme.gold} stroke={2} />
                  <Text style={{ flex: 1, fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.bold }}>{r.title}</Text>
                  {r.dueAt ? <Pill tone="warn">Avant le {fmtDay(r.dueAt)}</Pill> : null}
                </View>
                {r.message ? <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>{r.message}</Text> : null}
                <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Demandé par {r.requestedByName} le {fmtDay(r.createdAt)}</Text>
                <Button kind="gold" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => setSheet({ mode: 'request', request: r })}>
                  Envoyer la pièce
                </Button>
              </Surface>
            ))}
          </View>
        ) : null}

        {/* Annonces */}
        {data?.announcements.length ? (
          <View style={{ gap: 8 }}>
            <SectionTitle title="Annonces de l'équipe Axis" />
            {data.announcements.slice(0, 5).map((a) => (
              <Surface key={a.id} padded style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.bold }}>{a.title}</Text>
                <Text style={{ fontSize: 13, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 19 }}>{a.body}</Text>
                <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{a.authorName} · {fmtDay(a.createdAt)}</Text>
                {a.attachmentUrl ? (
                  <Button kind="outline" size="sm" style={{ alignSelf: 'flex-start' }} leftIcon={<Icons.doc size={14} color={theme.ink} stroke={1.8} />} onPress={() => void openStaffFile({ fileUrl: a.attachmentUrl!, fileName: a.attachmentName ?? 'piece-jointe' })}>
                    {a.attachmentName ?? 'Pièce jointe'}
                  </Button>
                ) : null}
              </Surface>
            ))}
          </View>
        ) : null}

        {/* Billets et réservations */}
        <View style={{ gap: 8 }}>
          <SectionTitle title="Billets et réservations" sub="Train, bus, avion, hébergement : déposés par Axis pour tes missions" />
          <Surface padded style={{ paddingVertical: 4 }}>
            {travel.length ? travel.map((f) => (
              <FileRow key={f.id} file={f} showStatus={false} onOpen={() => seen(f.id, f.seenAt)} />
            )) : <Empty text="Aucun billet pour le moment. Axis te prévient dès qu'un billet est déposé." />}
          </Surface>
        </View>

        {/* Documents RH */}
        <View style={{ gap: 8 }}>
          <SectionTitle title="Documents de la RH" sub="Contrat, assurance, fiches de paie, attestations" />
          <Surface padded style={{ paddingVertical: 4 }}>
            {hrDocs.length ? hrDocs.map((f) => (
              <FileRow key={f.id} file={f} showStatus={false} onOpen={() => seen(f.id, f.seenAt)} />
            )) : <Empty text="Aucun document reçu." />}
          </Surface>
        </View>

        {/* Frais */}
        <View style={{ gap: 8 }}>
          <SectionTitle
            title="Mes justificatifs de frais"
            sub="Transmis à la comptabilité d'Axis"
            right={pendingTotal ? <Pill tone="navy">À rembourser : {euros(pendingTotal)}</Pill> : undefined}
          />
          <Surface padded style={{ paddingVertical: 4 }}>
            {expenses.length ? expenses.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                showAmount
                actions={f.status === 'PENDING' ? <Button kind="ghost" size="sm" onPress={() => removeMine(f.id)}>Retirer</Button> : null}
              />
            )) : <Empty text="Aucun justificatif envoyé. Pense à photographier tickets de caisse, péages et pleins de carburant." />}
          </Surface>
        </View>

        {/* Documents envoyés à la RH */}
        {sentDocs.length ? (
          <View style={{ gap: 8 }}>
            <SectionTitle title="Documents envoyés à la RH" />
            <Surface padded style={{ paddingVertical: 4 }}>
              {sentDocs.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  actions={f.status === 'PENDING' ? <Button kind="ghost" size="sm" onPress={() => removeMine(f.id)}>Retirer</Button> : null}
                />
              ))}
            </Surface>
          </View>
        ) : null}
      </ScrollView>

      <UploadSheet
        visible={sheet?.mode === 'expense'}
        kind="EXPENSE"
        heading="Justificatif de frais"
        intro="Photographie le ticket en entier, montant et date lisibles. La comptabilité le reçoit aussitôt et te prévient quand il est validé puis remboursé."
        missions={data?.missions}
        withAmount
        onClose={() => setSheet(null)}
        onSubmit={async (v) => {
          await sendMyFile({ kind: 'EXPENSE', ...v });
          notify('Justificatif envoyé', 'La comptabilité d\'Axis l\'a bien reçu.');
          void load();
        }}
      />
      <UploadSheet
        visible={sheet?.mode === 'document'}
        kind="EMPLOYEE_DOCUMENT"
        heading="Document pour la RH"
        intro="Contrat signé, attestation, assurance… La RH le reçoit aussitôt."
        onClose={() => setSheet(null)}
        onSubmit={async (v) => {
          await sendMyFile({ kind: 'EMPLOYEE_DOCUMENT', ...v });
          notify('Document envoyé', 'La RH d\'Axis l\'a bien reçu.');
          void load();
        }}
      />
      <UploadSheet
        visible={sheet?.mode === 'request'}
        kind="EMPLOYEE_DOCUMENT"
        heading="Pièce demandée"
        intro={sheet?.mode === 'request' ? sheet.request.message ?? undefined : undefined}
        fixedTitle={sheet?.mode === 'request' ? sheet.request.title : undefined}
        onClose={() => setSheet(null)}
        onSubmit={async (v) => {
          if (sheet?.mode !== 'request') return;
          await sendMyFile({ kind: 'EMPLOYEE_DOCUMENT', ...v, requestId: sheet.request.id });
          notify('Pièce envoyée', 'La RH d\'Axis l\'a bien reçue.');
          void load();
        }}
      />
    </SafeAreaView>
  );
}

function Empty({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, paddingVertical: 12 }}>{text}</Text>;
}
