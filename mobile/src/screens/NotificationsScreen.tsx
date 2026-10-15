import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  ServerNotification,
  ServerNotificationType,
} from '../api/notifications';
import { Skeleton } from '../components/Skeleton';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { EmptyState } from '../components/EmptyState';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

type NotifKind =
  | 'driver_started' | 'driver_pause' | 'driver_arrived'
  | 'document_to_sign' | 'invoice_due' | 'invoice_paid'
  | 'kyc_validated' | 'security_login' | 'inspection_done'
  | 'news' | 'system';

interface AppNotif {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  time: string;
  read?: boolean;
  /** Cible navigation lorsqu'on tape sur la notif. */
  action?: { screen: keyof RootStackParamList; params?: Record<string, unknown> };
}

// Correspondance type serveur → présentation (icône, couleur, écran cible).
const TYPE_TO_KIND: Record<ServerNotificationType, NotifKind> = {
  MISSION_CREATED: 'system',
  MISSION_ACCEPTED: 'driver_started',
  MISSION_STARTED: 'driver_started',
  MISSION_DELIVERED: 'driver_arrived',
  MISSION_CANCELLED: 'system',
  INSPECTION_REQUESTED: 'inspection_done',
  INSPECTION_SIGNED: 'inspection_done',
  NEW_MESSAGE: 'system',
  CALL_INCOMING: 'system',
  CALL_MISSED: 'system',
  KYC_APPROVED: 'kyc_validated',
  KYC_REJECTED: 'kyc_validated',
  PARCEL_STATUS_UPDATE: 'driver_started',
  PAYMENT_RECEIVED: 'invoice_paid',
  REVIEW_RECEIVED: 'system',
  SYSTEM: 'system',
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'À l\'instant';
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `Il y a ${j} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// La notification porte l'identifiant de l'envoi concerné : on ouvre le bon
// écran plutôt que de renvoyer l'utilisateur à l'accueil.
function actionFor(n: ServerNotification): AppNotif['action'] {
  const p = (n.payload ?? {}) as { missionId?: string; parcelId?: string; reference?: string };
  if (p.missionId && p.reference) return { screen: 'MissionDetails', params: { reference: p.reference } };
  if (p.parcelId && p.reference) {
    return { screen: 'Tracking', params: { kind: 'parcel', id: p.parcelId, reference: p.reference } };
  }
  return undefined;
}

function toAppNotif(n: ServerNotification): AppNotif {
  return {
    id: n.id,
    kind: TYPE_TO_KIND[n.type] ?? 'system',
    title: n.title,
    body: n.body,
    time: relativeTime(n.createdAt),
    read: !!n.readAt,
    action: actionFor(n),
  };
}

export function NotificationsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notifs, setNotifs] = useState<AppNotif[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listNotifications()
        .then((list) => { if (!cancelled) setNotifs(list.map(toAppNotif)); })
        .catch(() => { if (!cancelled) setNotifs([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const unread = notifs.filter((n) => !n.read).length;

  // Marquage optimiste : l'écran réagit tout de suite, le serveur suit.
  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  const open = (n: AppNotif) => {
    if (!n.read) {
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    if (n.action) {
      // @ts-expect-error — navigation dynamique sur des routes typées
      nav.navigate(n.action.screen, n.action.params);
    }
  };

  // Grouper par "Aujourd'hui" / "Plus tôt"
  const today = notifs.filter((n) => /instant|min$|^Il y a \d+ h$/.test(n.time));
  const earlier = notifs.filter((n) => !today.includes(n));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title="Notifications"
        subtitle={unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour'}
        trailing={
          unread > 0 ? (
            <Pressable
              onPress={markAllRead}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: pressed ? theme.line : theme.bgSoft,
              })}
            >
              <Text style={{ fontSize: 12, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Tout marquer lu</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, gap: 16 }}>
        {loading ? <Skeleton variant="card" count={3} /> : null}
        {!loading && notifs.length === 0 ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="bell"
              title="Tu es à jour"
              subtitle="Tes alertes (chauffeur en route, contrat à signer, paiement, douane…) apparaîtront ici dès la première mission."
            />
          </Surface>
        ) : null}

        {today.length > 0 ? (
          <Group title="Aujourd'hui">
            {today.map((n) => <NotifCard key={n.id} notif={n} onPress={() => open(n)} />)}
          </Group>
        ) : null}
        {earlier.length > 0 ? (
          <Group title="Plus tôt">
            {earlier.map((n) => <NotifCard key={n.id} notif={n} onPress={() => open(n)} />)}
          </Group>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginLeft: 4 }}>
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function NotifCard({ notif, onPress }: { notif: AppNotif; onPress: () => void }) {
  const { theme } = useTheme();
  const meta = KIND_META[notif.kind];
  return (
    <Pressable onPress={onPress}>
      <Surface
        padded
        flat
        style={{
          padding: 14,
          backgroundColor: notif.read ? theme.surface : theme.surface2,
          borderColor: notif.read ? theme.line : theme.gold + '40',
          borderWidth: 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }}>
            <meta.Icon size={18} color={meta.fg} stroke={1.8} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{notif.title}</Text>
              {!notif.read ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.gold }} /> : null}
            </View>
            <Text style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 3, lineHeight: 16.5 }} numberOfLines={3}>
              {notif.body}
            </Text>
            <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 5 }}>
              {notif.time}
            </Text>
          </View>
          <Icons.chev size={16} color={theme.muted} stroke={1.8} />
        </View>
      </Surface>
    </Pressable>
  );
}

const KIND_META: Record<NotifKind, { Icon: typeof Icons.bell; bg: string; fg: string }> = (() => {
  const theme = {
    navy: '#0B2545', gold: '#C9A55C', good: '#1B7A48', warn: '#C18A2D', bad: '#B5443B',
  };
  const meta: Record<NotifKind, { Icon: typeof Icons.bell; bg: string; fg: string }> = {
    driver_started:   { Icon: Icons.car,    bg: theme.navy + '14', fg: theme.navy },
    driver_pause:     { Icon: Icons.fuel,   bg: theme.warn + '1F', fg: theme.warn },
    driver_arrived:   { Icon: Icons.check,  bg: theme.good + '1F', fg: theme.good },
    document_to_sign: { Icon: Icons.sig,    bg: theme.gold + '22', fg: theme.navy },
    invoice_due:      { Icon: Icons.euro,   bg: theme.warn + '1F', fg: theme.warn },
    invoice_paid:     { Icon: Icons.check,  bg: theme.good + '1F', fg: theme.good },
    kyc_validated:    { Icon: Icons.shield, bg: theme.good + '1F', fg: theme.good },
    security_login:   { Icon: Icons.warn,   bg: theme.warn + '1F', fg: theme.warn },
    inspection_done:  { Icon: Icons.doc,    bg: theme.navy + '14', fg: theme.navy },
    news:             { Icon: Icons.news,   bg: theme.gold + '22', fg: theme.navy },
    system:           { Icon: Icons.bell,   bg: '#EDE6D2', fg: theme.navy },
  };
  return meta;
})();
