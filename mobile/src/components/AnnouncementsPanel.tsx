// Onglet « Annonces » (secrétariat, RH, administrateur) : relayer une
// information à toute l'équipe, aux convoyeurs, aux salariés ou à des
// personnes choisies. Chacun reçoit une notification sur son téléphone et
// retrouve l'annonce dans « Mon espace ».
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Announcement, listAnnouncements, listPeople, PersonRow, sendAnnouncement } from '../api/staffSpace';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { PickedFile } from '../utils/pickFile';
import { roleLabel } from '../utils/roles';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field } from './Field';
import { Icons } from './Icons';
import { Pill } from './Pill';
import { Chips, FilePicker, fmtDay, openStaffFile, SectionTitle } from './StaffWidgets';
import { Surface } from './Surface';

type Audience = 'ALL' | 'DRIVERS' | 'TEAM' | 'PEOPLE';
const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'ALL', label: 'Tout le monde' },
  { key: 'DRIVERS', label: 'Tous les convoyeurs' },
  { key: 'TEAM', label: 'L\'équipe interne' },
  { key: 'PEOPLE', label: 'Personnes choisies' },
];
const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: 'Tout le monde',
  DRIVERS: 'Convoyeurs',
  TEAM: 'Équipe interne',
  PEOPLE: 'Personnes choisies',
};

export function AnnouncementsPanel() {
  const { theme } = useTheme();
  const [audience, setAudience] = useState<Audience>('ALL');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<PickedFile | null>(null);
  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Announcement[] | null>(null);

  const loadHistory = useCallback(() => {
    listAnnouncements().then(setHistory).catch(() => setHistory([]));
  }, []);
  useEffect(loadHistory, [loadHistory]);
  useEffect(() => {
    if (audience === 'PEOPLE' && people === null) listPeople().then(setPeople).catch(() => setPeople([]));
  }, [audience, people]);

  const shownPeople = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (people ?? []).filter((p) => !term || `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(term));
  }, [people, q]);

  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const send = async () => {
    if (title.trim().length < 2 || body.trim().length < 2) return notify('Annonce incomplète', 'Un titre et un message sont nécessaires.');
    if (audience === 'PEOPLE' && !picked.size) return notify('Destinataires', 'Coche au moins une personne.');
    setSending(true);
    try {
      const a = await sendAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience,
        recipientIds: audience === 'PEOPLE' ? [...picked] : undefined,
        attachment,
      });
      setTitle(''); setBody(''); setAttachment(null); setPicked(new Set());
      notify('Annonce envoyée', `${a.recipientCount ?? ''} personne(s) prévenue(s) sur leur téléphone.`);
      loadHistory();
    } catch (e) {
      notify('Envoi impossible', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Surface padded style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>Nouvelle annonce</Text>
          <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
            Chaque destinataire reçoit une notification sur son téléphone et retrouve l'annonce dans « Mon espace ».
          </Text>
        </View>
        <Chips<Audience> options={AUDIENCES} value={audience} onChange={setAudience} />
        {audience === 'PEOPLE' ? (
          <View style={{ gap: 8 }}>
            <Field value={q} onChangeText={setQ} placeholder="Rechercher une personne" autoCapitalize="none" />
            {people === null ? <ActivityIndicator color={theme.link} /> : null}
            {/* Liste défilante dans un cadre : elle débordait sur le reste de la page. */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button kind="ghost" size="sm" onPress={() => setPicked((s) => new Set([...s, ...shownPeople.map((p) => p.id)]))} disabled={!shownPeople.length}>
                Tout cocher{q.trim() ? ' (résultats)' : ''}
              </Button>
              {picked.size ? <Button kind="ghost" size="sm" onPress={() => setPicked(new Set())}>Tout décocher</Button> : null}
            </View>
            <ScrollView
              nestedScrollEnabled
              style={{ maxHeight: 300, borderWidth: 1, borderColor: theme.line, borderRadius: 12, backgroundColor: theme.bgSoft }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 4 }}
            >
              {people && !shownPeople.length ? (
                <Text style={{ paddingVertical: 12, fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Personne ne correspond à cette recherche.</Text>
              ) : null}
              {shownPeople.map((p) => {
                const on = picked.has(p.id);
                return (
                  <Pressable key={p.id} onPress={() => toggle(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? theme.select : theme.line, backgroundColor: on ? theme.select : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <Icons.check size={14} color={theme.selectInk} stroke={2.6} /> : null}
                    </View>
                    <Avatar name={`${p.firstName} ${p.lastName}`} url={p.avatarUrl} size={28} tone={p.role === 'DRIVER' ? 'navy' : 'gold'} />
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                      {p.firstName} {p.lastName}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{roleLabel(p.role)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {picked.size ? <Text style={{ fontSize: 12, color: theme.link, fontFamily: TYPO.weights.semibold }}>{picked.size} personne(s) choisie(s)</Text> : null}
          </View>
        ) : null}
        <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Ex. Réunion d'équipe lundi 9 h" />
        <Field label="Message" value={body} onChangeText={setBody} multiline placeholder="L'information à relayer" />
        <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Pièce jointe (facultatif)</Text>
        <FilePicker file={attachment} onChange={setAttachment} />
        <Button kind="gold" size="lg" fullWidth loading={sending} onPress={() => void send()}>Envoyer l'annonce</Button>
      </Surface>

      <SectionTitle title="Annonces envoyées" />
      {history === null ? <ActivityIndicator color={theme.link} /> : null}
      {history && !history.length ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}>Aucune annonce pour le moment.</Text> : null}
      {(history ?? []).map((a) => (
        <Surface key={a.id} padded style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.bold }}>{a.title}</Text>
            <Pill tone="navy">{AUDIENCE_LABEL[a.audience ?? 'ALL']} · {a.recipientCount ?? 0}</Pill>
          </View>
          <Text style={{ fontSize: 13, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 19 }}>{a.body}</Text>
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{a.authorName} · {fmtDay(a.createdAt)}</Text>
          {a.attachmentUrl ? (
            <Button kind="outline" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => void openStaffFile({ fileUrl: a.attachmentUrl!, fileName: a.attachmentName ?? 'piece-jointe' })}>
              {a.attachmentName ?? 'Pièce jointe'}
            </Button>
          ) : null}
        </Surface>
      ))}
    </View>
  );
}
