// Messagerie interne : choisir une personne à qui écrire, créer ou gérer un
// groupe (administrateur : plein pouvoir — nom, membres, suppression).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  ConversationSummary,
  createGroup,
  deleteGroup,
  InternalContact,
  leaveGroup,
  listInternalContacts,
  openDirectConversation,
  updateGroup,
} from '../api/messaging';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { confirmAction, notify } from '../utils/notify';
import { roleLabel } from '../utils/roles';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field } from './Field';
import { Icons } from './Icons';
import { Chips } from './StaffWidgets';

type Who = 'all' | 'managers' | 'team' | 'drivers';
const WHO: { key: Who; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'managers', label: 'Responsables' },
  { key: 'team', label: 'Équipe interne' },
  { key: 'drivers', label: 'Convoyeurs' },
];
function matchWho(c: InternalContact, w: Who) {
  if (w === 'managers') return c.role === 'MANAGER';
  if (w === 'drivers') return c.role === 'DRIVER';
  if (w === 'team') return c.role !== 'DRIVER';
  return true;
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation?.()} style={{ maxHeight: '92%', backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 }}>
            <Text style={{ flex: 1, fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.x size={16} color={theme.ink} stroke={2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function useContacts(visible: boolean) {
  const [list, setList] = useState<InternalContact[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible || list) return;
    listInternalContacts().then(setList).catch(() => setFailed(true));
  }, [visible, list]);
  return { list, failed };
}

function ContactRow({ c, checked, onPress }: { c: InternalContact; checked?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={checked === undefined ? 'button' : 'checkbox'}
      accessibilityState={checked === undefined ? undefined : { checked }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, backgroundColor: pressed ? theme.bgSoft : 'transparent' })}
    >
      {checked !== undefined ? (
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: checked ? theme.select : theme.line, backgroundColor: checked ? theme.select : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {checked ? <Icons.check size={14} color={theme.selectInk} stroke={2.6} /> : null}
        </View>
      ) : null}
      <Avatar name={`${c.firstName} ${c.lastName}`} url={c.avatarUrl} size={34} tone={c.role === 'DRIVER' ? 'navy' : 'gold'} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{c.firstName} {c.lastName}</Text>
        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>{roleLabel(c.role)}</Text>
      </View>
    </Pressable>
  );
}

function filtered(list: InternalContact[] | null, q: string, who: Who) {
  const term = q.trim().toLowerCase();
  return (list ?? []).filter((c) => matchWho(c, who) && (!term || `${c.firstName} ${c.lastName} ${roleLabel(c.role)}`.toLowerCase().includes(term)));
}

/** Nouveau message : une personne de l'équipe ou un convoyeur. */
export function NewMessageSheet({ visible, onClose, onOpened }: { visible: boolean; onClose: () => void; onOpened: (id: string, title: string) => void }) {
  const { theme } = useTheme();
  const { list, failed } = useContacts(visible);
  const [q, setQ] = useState('');
  const [who, setWho] = useState<Who>('all');
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => filtered(list, q, who), [list, q, who]);

  const open = async (c: InternalContact) => {
    if (busy) return;
    setBusy(true);
    try {
      const conv = await openDirectConversation(c.id);
      onClose();
      onOpened(conv.id, `${c.firstName} ${c.lastName}`);
    } catch (e) {
      notify('Conversation impossible', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Nouveau message" onClose={onClose}>
      <Field value={q} onChangeText={setQ} placeholder="Rechercher une personne" autoCapitalize="none" />
      <Chips<Who> options={WHO} value={who} onChange={setWho} />
      {!list && !failed ? <ActivityIndicator color={theme.link} /> : null}
      {failed ? <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Liste indisponible. Réessaie dans un instant.</Text> : null}
      {list && !shown.length ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}>Personne ne correspond.</Text> : null}
      {shown.map((c) => <ContactRow key={c.id} c={c} onPress={() => void open(c)} />)}
    </Sheet>
  );
}

/**
 * Créer un groupe (conv absent) ou gérer un groupe existant. L'administrateur
 * renomme, ajoute, retire et supprime ; un membre peut seulement quitter.
 */
export function GroupSheet({
  visible, onClose, conv, isAdmin, myId, onSaved, onGone,
}: {
  visible: boolean;
  onClose: () => void;
  conv?: ConversationSummary | null;
  isAdmin: boolean;
  myId?: string;
  onSaved: (id: string, title: string) => void;
  onGone?: () => void;
}) {
  const { theme } = useTheme();
  const editing = !!conv;
  const { list, failed } = useContacts(visible && isAdmin);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [who, setWho] = useState<Who>('managers');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(conv?.title ?? '');
    setPicked(new Set((conv?.participants ?? []).map((p) => p.userId).filter((id) => id !== myId)));
    setWho(conv ? 'all' : 'managers');
    setQ('');
  }, [visible, conv, myId]);

  const shown = useMemo(() => filtered(list, q, who), [list, q, who]);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async () => {
    if (title.trim().length < 2) return notify('Nom du groupe', 'Donne un nom au groupe (ex. « Responsables d\'exploitation »).');
    if (!picked.size) return notify('Membres', 'Coche au moins une personne.');
    setBusy(true);
    try {
      if (conv) {
        const before = new Set((conv.participants ?? []).map((p) => p.userId));
        const addIds = [...picked].filter((id) => !before.has(id));
        const removeIds = [...before].filter((id) => id !== myId && !picked.has(id));
        await updateGroup(conv.id, { title: title.trim(), addIds, removeIds });
        onClose();
        onSaved(conv.id, title.trim());
      } else {
        const g = await createGroup(title.trim(), [...picked]);
        onClose();
        onSaved(g.id, g.title);
      }
    } catch (e) {
      notify('Enregistrement impossible', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => conv && confirmAction('Supprimer le groupe ?', 'Le groupe et tous ses messages seront supprimés pour tous les membres.', () => {
    deleteGroup(conv.id).then(() => { onClose(); onGone?.(); }).catch((e) => notify('Suppression impossible', e instanceof Error ? e.message : 'Réessaie.'));
  }, 'Supprimer');

  const leave = () => conv && confirmAction('Quitter le groupe ?', 'Tu ne recevras plus ses messages.', () => {
    leaveGroup(conv.id).then(() => { onClose(); onGone?.(); }).catch((e) => notify('Action impossible', e instanceof Error ? e.message : 'Réessaie.'));
  }, 'Quitter');

  // Membre (non administrateur) : liste des membres et « Quitter ».
  if (!isAdmin) {
    return (
      <Sheet visible={visible} title={conv?.title ?? 'Groupe'} onClose={onClose}>
        <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.semibold }}>{conv?.participants.length ?? 0} membres</Text>
        {(conv?.participants ?? []).map((p) => (
          <ContactRow key={p.userId} c={{ id: p.userId, firstName: p.user.firstName, lastName: p.user.lastName, avatarUrl: p.user.avatarUrl, role: p.user.role ?? '', phone: p.user.phone ?? null }} onPress={() => undefined} />
        ))}
        <Button kind="outline" size="md" onPress={leave}>Quitter le groupe</Button>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} title={editing ? 'Gérer le groupe' : 'Nouveau groupe'} onClose={onClose}>
      <Field label="Nom du groupe" value={title} onChangeText={setTitle} placeholder="Ex. Responsables d'exploitation · Lyon" />
      <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Membres · {picked.size} choisi(s)</Text>
      <Field value={q} onChangeText={setQ} placeholder="Rechercher une personne" autoCapitalize="none" />
      <Chips<Who> options={WHO} value={who} onChange={setWho} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button kind="ghost" size="sm" disabled={!shown.length} onPress={() => setPicked((s) => new Set([...s, ...shown.map((c) => c.id)]))}>Tout cocher</Button>
        {picked.size ? <Button kind="ghost" size="sm" onPress={() => setPicked(new Set())}>Tout décocher</Button> : null}
      </View>
      {!list && !failed ? <ActivityIndicator color={theme.link} /> : null}
      {failed ? <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold }}>Liste indisponible. Réessaie dans un instant.</Text> : null}
      <ScrollView nestedScrollEnabled style={{ maxHeight: 320, borderWidth: 1, borderColor: theme.line, borderRadius: 12, backgroundColor: theme.bgSoft }} contentContainerStyle={{ padding: 8 }}>
        {list && !shown.length ? <Text style={{ padding: 8, color: theme.muted, fontFamily: TYPO.weights.medium }}>Personne ne correspond.</Text> : null}
        {shown.map((c) => <ContactRow key={c.id} c={c} checked={picked.has(c.id)} onPress={() => toggle(c.id)} />)}
      </ScrollView>
      <Button kind="gold" size="lg" fullWidth loading={busy} onPress={() => void save()}>
        {editing ? 'Enregistrer' : 'Créer le groupe'}
      </Button>
      {editing ? <Button kind="ghost" size="md" onPress={remove}>Supprimer le groupe</Button> : null}
    </Sheet>
  );
}
