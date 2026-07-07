import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import {
  ApiMessage,
  conversationSubtitle,
  conversationTitle,
  getConversation,
  listMessages,
  markRead,
  messagePreview,
  sendMessage,
} from '../api/messaging';
import { AppBar } from '../components/AppBar';
import { Avatar } from '../components/Avatar';
import { Icons } from '../components/Icons';
import { Skeleton } from '../components/Skeleton';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface Msg {
  id: string;
  who: 'me' | 'driver' | 'system';
  text: string;
  time: string;
  /** Démo : coche double quand « vu ». */
  seen?: boolean;
  /** Live : état d'envoi de mes messages. */
  status?: 'pending' | 'sent' | 'failed';
  /** Live : horodatage ISO pour les séparateurs de jour. */
  createdAt?: string;
}

const INITIAL: Msg[] = [
  { id: 's1', who: 'system', text: 'Karim a démarré le trajet · Paris 15ᵉ → Bruxelles', time: '13:32' },
  { id: 'd1', who: 'driver', text: 'Bonjour, je viens de récupérer le véhicule. État impeccable, état des lieux dans l\'app.', time: '13:42' },
  { id: 'm1', who: 'me', text: 'Parfait, merci ! Arrivée prévue vers 14h30 ?', time: '13:43', seen: true },
  { id: 'd2', who: 'driver', text: 'Oui, 14h32 normalement. Petit ralentissement au sud de Lille, je te tiens au courant.', time: '13:48' },
];

const QUICK_REPLIES = ['Merci 🙏', 'Tout va bien ?', 'Préviens 10 min avant', 'Photos arrivée svp'];

const POLL_INTERVAL_MS = 5000;

type Mode = 'loading' | 'live' | 'demo';

interface PendingMsg {
  localId: string;
  text: string;
  status: 'pending' | 'failed';
  at: string; // ISO
}

function hm(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Aujourd\'hui';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function MessagingScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Messaging'>>();
  const { user } = useSession();

  // `conversationId` sera ajouté au type de route par l'orchestrateur —
  // lecture défensive pour compiler sans modifier navigation/types.ts (gelé).
  const params = (route.params ?? {}) as {
    driverName?: string;
    subtitle?: string;
    conversationId?: string;
  };
  const conversationId = params.conversationId;
  const myId = user?.id;

  const [mode, setMode] = useState<Mode>(conversationId ? 'loading' : 'demo');
  const [title, setTitle] = useState(params.driverName ?? 'Karim Diallo');
  const [subtitle, setSubtitle] = useState(params.subtitle ?? (conversationId ? 'Conversation' : 'En route · AX-2847'));

  // Live : messages confirmés serveur (ordre chronologique) + envois en cours.
  const [serverMessages, setServerMessages] = useState<ApiMessage[]>([]);
  const [pendingMsgs, setPendingMsgs] = useState<PendingMsg[]>([]);
  // Démo : état local historique.
  const [demoMessages, setDemoMessages] = useState<Msg[]>(INITIAL);

  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  const pollBusyRef = useRef(false);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const localSeqRef = useRef(0);
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      demoTimersRef.current.forEach(clearTimeout);
      demoTimersRef.current = [];
    };
  }, []);

  const scrollToEnd = (animated: boolean) => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 50);
  };

  // ─── Rafraîchissement (chargement initial + polling 5 s) ────────────────
  const refreshMessages = useCallback(async (convId: string) => {
    if (pollBusyRef.current) return;
    pollBusyRef.current = true;
    try {
      const r = await listMessages(convId, 1, 50);
      if (!mountedRef.current) return;
      // Le backend renvoie du plus récent au plus ancien → on inverse.
      const asc = [...r.data].reverse();
      setServerMessages(asc);

      // Nouveaux messages entrants depuis le dernier passage → lu + scroll.
      const prevIds = knownIdsRef.current;
      const inboundNew = prevIds
        ? asc.filter((m) => m.senderId !== myId && !prevIds.has(m.id))
        : [];
      knownIdsRef.current = new Set(asc.map((m) => m.id));
      if (inboundNew.length > 0) {
        markRead(convId).catch(() => {});
        scrollToEnd(true);
      }
    } catch {
      // Erreur de poll (réseau momentané…) : on garde l'historique affiché.
    } finally {
      pollBusyRef.current = false;
    }
  }, [myId]);

  // ─── Chargement initial du fil réel ──────────────────────────────────────
  useEffect(() => {
    if (!conversationId) {
      setMode('demo');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [conv, msgs] = await Promise.all([
          getConversation(conversationId),
          listMessages(conversationId, 1, 50),
        ]);
        if (cancelled || !mountedRef.current) return;
        const asc = [...msgs.data].reverse();
        setServerMessages(asc);
        knownIdsRef.current = new Set(asc.map((m) => m.id));
        setTitle(params.driverName ?? conversationTitle(conv, myId));
        setSubtitle(params.subtitle ?? conversationSubtitle(conv) ?? 'Conversation');
        setMode('live');
        // Marquer lu à l'ouverture (fire-and-forget).
        markRead(conversationId).catch(() => {});
        scrollToEnd(false);
      } catch {
        if (cancelled || !mountedRef.current) return;
        // Hors-ligne ou conversation inaccessible → repli démo gracieux.
        setDemoMessages([
          { id: 'sys-offline', who: 'system', text: 'Hors ligne — conversation de démonstration', time: hm(new Date().toISOString()) },
          ...INITIAL,
        ]);
        setMode('demo');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ─── Polling toutes les 5 s en mode live, cleanup au démontage ──────────
  useEffect(() => {
    if (mode !== 'live' || !conversationId) return;
    const timer = setInterval(() => { void refreshMessages(conversationId); }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [mode, conversationId, refreshMessages]);

  useEffect(() => {
    scrollToEnd(false);
  }, []);

  // ─── Envoi ────────────────────────────────────────────────────────────────
  const sendLive = async (convId: string, text: string) => {
    const localId = `local-${Date.now()}-${localSeqRef.current++}`;
    // Optimiste : le message apparaît immédiatement (état « pending »).
    setPendingMsgs((prev) => [...prev, { localId, text, status: 'pending', at: new Date().toISOString() }]);
    scrollToEnd(true);
    try {
      const saved = await sendMessage(convId, { body: text });
      if (!mountedRef.current) return;
      setServerMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        knownIdsRef.current?.add(saved.id);
        return [...prev, saved];
      });
      // Confirmation serveur → on retire l'optimiste, la version « ✓ » prend le relais.
      setPendingMsgs((prev) => prev.filter((p) => p.localId !== localId));
    } catch {
      if (!mountedRef.current) return;
      setPendingMsgs((prev) => prev.map((p) => (p.localId === localId ? { ...p, status: 'failed' } : p)));
    }
  };

  const sendDemo = (text: string) => {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setDemoMessages((prev) => [...prev, { id: `m${Date.now()}`, who: 'me', text, time: now, seen: false }]);
    scrollToEnd(true);
    // Réponse simulée du chauffeur après 2 sec
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      const replies = [
        'OK, je note !',
        'Reçu, je te confirme dès que je suis sur place.',
        '👍 Pas de souci.',
      ];
      const r = replies[Math.floor(Math.random() * replies.length)];
      const now2 = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setDemoMessages((prev) => [
        ...prev.map((m) => (m.who === 'me' ? { ...m, seen: true } : m)),
        { id: `d${Date.now()}`, who: 'driver', text: r, time: now2 },
      ]);
      scrollToEnd(true);
    }, 1800);
    demoTimersRef.current.push(t);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || mode === 'loading') return;
    setInput('');
    if (mode === 'live' && conversationId) void sendLive(conversationId, t);
    else sendDemo(t);
  };

  const retryFailed = (localId: string) => {
    const failed = pendingMsgs.find((p) => p.localId === localId && p.status === 'failed');
    if (!failed || !conversationId) return;
    setPendingMsgs((prev) => prev.filter((p) => p.localId !== localId));
    void sendLive(conversationId, failed.text);
  };

  // ─── Liste affichée ──────────────────────────────────────────────────────
  const displayMessages: Msg[] = useMemo(() => {
    if (mode !== 'live') return demoMessages;
    const confirmed: Msg[] = serverMessages.map((m) => ({
      id: m.id,
      who: m.type === 'SYSTEM' ? 'system' : m.senderId === myId ? 'me' : 'driver',
      text: messagePreview(m),
      time: hm(m.createdAt),
      status: m.senderId === myId ? 'sent' : undefined,
      createdAt: m.createdAt,
    }));
    const optimistic: Msg[] = pendingMsgs.map((p) => ({
      id: p.localId,
      who: 'me',
      text: p.text,
      time: hm(p.at),
      status: p.status,
      createdAt: p.at,
    }));
    return [...confirmed, ...optimistic];
  }, [mode, demoMessages, serverMessages, pendingMsgs, myId]);

  // Lignes avec séparateurs de jour (live) ou entête simple (démo).
  const rows = useMemo(() => {
    const out: Array<{ kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; msg: Msg }> = [];
    if (mode !== 'live') {
      out.push({ kind: 'day', key: 'day-demo', label: 'Aujourd\'hui' });
      demoMessages.forEach((m) => out.push({ kind: 'msg', key: m.id, msg: m }));
      return out;
    }
    let lastDay = '';
    displayMessages.forEach((m) => {
      const day = m.createdAt ? new Date(m.createdAt).toDateString() : lastDay;
      if (day !== lastDay) {
        lastDay = day;
        out.push({ kind: 'day', key: `day-${day}`, label: m.createdAt ? dayLabel(m.createdAt) : 'Aujourd\'hui' });
      }
      out.push({ kind: 'msg', key: m.id, msg: m });
    });
    return out;
  }, [mode, demoMessages, displayMessages]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title={title}
        subtitle={mode === 'loading' ? 'Chargement…' : subtitle}
        leading={<Avatar name={title} size={36} tone="gold" />}
        trailing={
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: pressed ? theme.line : theme.bgSoft,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Icons.phone size={18} color={theme.ink} stroke={1.8} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 12, gap: 10 }}
        >
          {mode === 'loading' ? (
            <View style={{ gap: 10, paddingTop: 8 }}>
              <Skeleton variant="card" height={54} width={'70%' as const} />
              <Skeleton variant="card" height={40} width={'55%' as const} style={{ alignSelf: 'flex-end' }} />
              <Skeleton variant="card" height={66} width={'75%' as const} />
            </View>
          ) : (
            <>
              {rows.map((row) =>
                row.kind === 'day' ? (
                  <Text
                    key={row.key}
                    style={{ textAlign: 'center', fontSize: 11, color: theme.muted, paddingVertical: 4, fontFamily: TYPO.weights.medium }}
                  >
                    {row.label}
                  </Text>
                ) : (
                  <MessageBubble
                    key={row.key}
                    msg={row.msg}
                    onRetry={row.msg.status === 'failed' ? () => retryFailed(row.msg.id) : undefined}
                  />
                ),
              )}

              {mode === 'live' && displayMessages.length === 0 ? (
                <Text style={{ textAlign: 'center', fontSize: 12.5, color: theme.muted, paddingVertical: 18, fontFamily: TYPO.weights.medium }}>
                  Démarre la conversation — ton interlocuteur sera notifié.
                </Text>
              ) : null}

              {/* Quick replies */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {QUICK_REPLIES.map((q) => (
                  <Pressable key={q} onPress={() => send(q)}>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
                      <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.medium }}>{q}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* Composer */}
        <View style={{ padding: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, backgroundColor: pressed ? theme.line : theme.bgSoft, alignItems: 'center', justifyContent: 'center' })}>
            <Icons.plus size={18} color={theme.ink} stroke={2} />
          </Pressable>
          <View style={{ flex: 1, paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: theme.bgSoft, borderWidth: 1, borderColor: theme.line, justifyContent: 'center' }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Écrire un message…"
              placeholderTextColor={theme.muted}
              style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.regular, padding: 0 }}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
          </View>
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || mode === 'loading'}
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: !input.trim() || mode === 'loading' ? theme.line : pressed ? theme.goldDeep : theme.gold,
              alignItems: 'center', justifyContent: 'center',
              opacity: !input.trim() || mode === 'loading' ? 0.6 : 1,
            })}
          >
            <Icons.arrow size={18} color={theme.navy} stroke={2.4} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ msg, onRetry }: { msg: Msg; onRetry?: () => void }) {
  const { theme } = useTheme();
  if (msg.who === 'system') {
    return (
      <View style={{ alignSelf: 'center', maxWidth: '88%' }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.surface2 }}>
          <Text style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium }} numberOfLines={2}>
            {msg.text}
          </Text>
        </View>
      </View>
    );
  }
  const mine = msg.who === 'me';
  const failed = msg.status === 'failed';

  // Suffixe d'état sous la bulle :
  //   live    : … (envoi) → ✓ (confirmé serveur) ; échec → tap pour renvoyer
  //   démo    : ✓ puis ✓✓ quand « vu »
  let suffix = '';
  if (mine) {
    if (msg.status === 'pending') suffix = ' · …';
    else if (msg.status === 'sent') suffix = ' · ✓';
    else if (!failed) suffix = msg.seen ? ' · ✓✓' : ' · ✓';
  }

  const bubble = (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', opacity: msg.status === 'pending' ? 0.75 : 1 }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: mine ? (failed ? theme.surface : theme.navy) : theme.surface,
          borderWidth: mine ? (failed ? 1 : 0) : 1,
          borderColor: failed ? theme.bad : theme.line,
          borderRadius: 14,
          borderBottomRightRadius: mine ? 4 : 14,
          borderBottomLeftRadius: mine ? 14 : 4,
        }}
      >
        <Text style={{ fontSize: 14, color: mine && !failed ? '#F5F1E8' : failed ? theme.bad : theme.ink, lineHeight: 19, fontFamily: TYPO.weights.regular }}>
          {msg.text}
        </Text>
      </View>
      <Text style={{ fontSize: 10.5, color: failed ? theme.bad : theme.muted, marginTop: 3, marginHorizontal: 8, textAlign: mine ? 'right' : 'left', fontFamily: TYPO.weights.medium }}>
        {failed ? 'Échec de l\'envoi · appuyer pour réessayer' : `${msg.time}${suffix}`}
      </Text>
    </View>
  );

  if (failed && onRetry) {
    return <Pressable onPress={onRetry}>{bubble}</Pressable>;
  }
  return bubble;
}
