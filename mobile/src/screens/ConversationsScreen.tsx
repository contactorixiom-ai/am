import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import {
  ConversationSummary,
  conversationSubtitle,
  conversationTitle,
  isConversationUnread,
  listConversations,
  messagePreview,
} from '../api/messaging';
import { AppBar } from '../components/AppBar';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

// ─── Heure relative (dernier message) ──────────────────────────────────────
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'À l\'instant';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24 && date.getDate() === new Date().getDate()) return `${h} h`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  const days = Math.floor(min / (60 * 24));
  if (days < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function ConversationsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();

  // null = premier chargement pas encore terminé (→ skeletons)
  const [convs, setConvs] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const r = await listConversations(1, 50);
      // Défensif : on ne stocke QUE des tableaux (une réponse inattendue —
      // erreur serveur, HTML, forme différente — ne doit pas casser l'écran).
      setConvs(Array.isArray(r?.data) ? r.data : []);
      setError(null);
    } catch {
      // Hors-ligne / serveur indisponible : on garde la dernière liste connue,
      // sinon on affiche l'état d'erreur avec bouton réessayer.
      setError('Connexion au serveur impossible');
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Recharge à chaque retour sur l'écran (badge non-lus à jour après lecture).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openConversation = (c: ConversationSummary) => {
    const title = conversationTitle(c, user?.id);
    const subtitle = conversationSubtitle(c);
    // `conversationId` sera ajouté au type Messaging par l'orchestrateur —
    // cast local pour compiler sans toucher navigation/types.ts (gelé).
    const params = { driverName: title, subtitle, conversationId: c.id };
    nav.navigate('Messaging', params as RootStackParamList['Messaging']);
  };

  const unreadTotal = (convs ?? []).filter((c) => isConversationUnread(c, user?.id)).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title="Messages"
        subtitle={
          convs === null
            ? undefined
            : unreadTotal > 0
              ? `${unreadTotal} conversation${unreadTotal > 1 ? 's' : ''} non lue${unreadTotal > 1 ? 's' : ''}`
              : 'Chauffeurs et support'
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {convs === null && !error ? (
          // Premier chargement
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Surface key={i} padded flat style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Skeleton variant="avatar" />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton variant="line" width={'55%' as const} />
                    <Skeleton variant="line" width={'85%' as const} height={10} />
                  </View>
                </View>
              </Surface>
            ))}
          </View>
        ) : null}

        {convs === null && error ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="warn"
              title="Hors ligne"
              subtitle="Impossible de joindre le serveur. Vérifie ta connexion puis réessaie."
              cta={{ label: 'Réessayer', onPress: () => { setError(null); load(); } }}
            />
          </Surface>
        ) : null}

        {convs !== null && convs.length === 0 ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="chat"
              title="Aucune conversation"
              subtitle="Tes échanges avec les chauffeurs et le support apparaîtront ici."
            />
          </Surface>
        ) : null}

        {(convs ?? []).map((c) => (
          <ConversationRow
            key={c.id}
            conv={c}
            myUserId={user?.id}
            onPress={() => openConversation(c)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConversationRow({
  conv,
  myUserId,
  onPress,
}: {
  conv: ConversationSummary;
  myUserId?: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const title = conversationTitle(conv, myUserId);
  const subtitle = conversationSubtitle(conv);
  const last = conv.messages?.[0];
  const unread = isConversationUnread(conv, myUserId);
  const preview = last
    ? `${last.senderId === myUserId ? 'Toi : ' : ''}${messagePreview(last)}`
    : 'Nouvelle conversation';
  const time = relativeTime(last?.createdAt ?? conv.lastMessageAt ?? conv.createdAt);

  return (
    <Pressable onPress={onPress}>
      <Surface
        padded
        flat
        style={{
          padding: 14,
          backgroundColor: unread ? theme.surface2 : theme.surface,
          borderColor: unread ? theme.gold + '40' : theme.line,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={title} size={44} tone={unread ? 'gold' : 'navy'} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 14.5,
                  color: theme.ink,
                  fontFamily: unread ? TYPO.weights.bold : TYPO.weights.semibold,
                  letterSpacing: -0.2,
                }}
              >
                {title}
              </Text>
              <Text style={{ fontSize: 11, color: unread ? theme.goldDeep : theme.muted, fontFamily: TYPO.weights.medium }}>
                {time}
              </Text>
            </View>
            {subtitle ? (
              <Text numberOfLines={1} style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                {subtitle}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  color: unread ? theme.ink : theme.inkSoft,
                  fontFamily: unread ? TYPO.weights.semibold : TYPO.weights.regular,
                }}
              >
                {preview}
              </Text>
              {unread ? (
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.gold }} />
              ) : null}
            </View>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}
