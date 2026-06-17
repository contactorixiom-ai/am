import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
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

const DEMO_NOTIFS: AppNotif[] = [
  { id: 'n1', kind: 'driver_pause',     title: 'Karim fait une pause',                  body: 'Aire de Ressons-sur-Matz · pause repas 25 min · reprise prévue à 13h05.',                  time: 'À l\'instant', action: { screen: 'Tracking', params: { kind: 'mission', id: 'AX-2847', reference: 'AX-2847' } } },
  { id: 'n2', kind: 'document_to_sign', title: 'Contrat à signer',                      body: 'Contrat de convoyage AX-2847 · BMW Série 3 prêt à être signé électroniquement.',          time: 'Il y a 18 min', action: { screen: 'AppTabs' } },
  { id: 'n3', kind: 'driver_started',   title: 'Convoyage démarré',                     body: 'Karim Diallo a récupéré ton véhicule. État des lieux signé.',                              time: 'Il y a 1 h', action: { screen: 'Tracking', params: { kind: 'mission', id: 'AX-2847', reference: 'AX-2847' } } },
  { id: 'n4', kind: 'invoice_due',      title: 'Facture à régler',                      body: 'FA-2026-0179 · 1 240,00 € · Fret 4 palettes → Dakar. À régler sous 5 jours.',             time: 'Il y a 3 h', action: { screen: 'AppTabs' } },
  { id: 'n5', kind: 'security_login',   title: 'Nouvelle connexion',                    body: 'iPhone 15 Pro · Safari · Paris · 92.184.•••.42. Ce n\'était pas toi ? Vérifie ta sécurité.', time: 'Il y a 5 h', action: { screen: 'SecuritySettings' } },
  { id: 'n6', kind: 'kyc_validated',    title: 'Profil vérifié ✓',                      body: 'Notre équipe a validé ton permis de conduire et ta pièce d\'identité.',                    time: 'Hier', action: { screen: 'KycVerification' } },
  { id: 'n7', kind: 'invoice_paid',     title: 'Paiement confirmé',                     body: 'FA-2026-0184 · 512,00 € · Apple Pay · convoyage Paris → Bruxelles.',                       time: 'Hier' },
  { id: 'n8', kind: 'news',             title: 'Réglementation Sénégal',                body: 'Nouveau document douanier obligatoire pour les exports véhicules à partir du 1er juin.',     time: 'Il y a 2 j', action: { screen: 'News' } },
];

const STORAGE_KEY = 'axis.notifs.read.v1';

export function NotificationsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) try { setReadIds(JSON.parse(raw)); } catch { /* ignore */ }
    });
  }, []);

  const persistRead = (ids: string[]) => {
    setReadIds(ids);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  };

  const notifs = useMemo(
    () => DEMO_NOTIFS.map((n) => ({ ...n, read: readIds.includes(n.id) })),
    [readIds],
  );

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = () => persistRead(DEMO_NOTIFS.map((n) => n.id));

  const open = (n: AppNotif) => {
    if (!readIds.includes(n.id)) persistRead([...readIds, n.id]);
    if (n.action) {
      // @ts-expect-error — navigation dynamique sur des routes typées
      nav.navigate(n.action.screen, n.action.params);
    }
  };

  // Grouper par "Aujourd'hui" / "Plus tôt"
  const today = notifs.filter((n) => /minute|instant|min$|^Il y a 1 h|^Il y a [1-9] h/.test(n.time));
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

        <Surface padded style={{ padding: 14, marginTop: 4 }}>
          <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
            Tu peux personnaliser les notifications dans Profil → Sécurité du compte.
          </Text>
        </Surface>
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
