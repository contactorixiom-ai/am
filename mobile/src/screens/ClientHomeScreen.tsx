// Accueil du client (« Mes envois ») : deux grandes portes d'entrée
// (convoyage, envoi vers l'Afrique), ses envois en cours, la grille
// tarifaire, les coordonnées d'Axis et un bouton « Une question ? ».
// Téléphone : une colonne. Ordinateur : cartes côte à côte puis deux
// colonnes, sur toute la largeur à côté du menu.
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { openSupportConversation } from '../api/messaging';
import { listMissions, MissionSummary } from '../api/missions';
import { listParcels, ParcelSummary } from '../api/parcels';
import { CountBadge } from '../components/CountBadge';
import { Icons } from '../components/Icons';
import { StatusBadge } from '../components/StatusBadge';
import { COMPANY } from '../config/company';
import { RootStackParamList } from '../navigation/types';
import { useBadges } from '../state/badges';
import { useSession } from '../state/SessionContext';
import { useLayout } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';

type Row = { kind: 'mission' | 'parcel'; id: string; reference: string; from: string; to: string; status: string; at?: string };
const DONE = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'LOST'];

export function ClientHomeScreen() {
  const { theme } = useTheme();
  const { wide } = useLayout();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const badges = useBadges();
  const [rows, setRows] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.allSettled([listMissions(), listParcels()]).then(([m, p]) => {
        if (!alive) return;
        const missions: MissionSummary[] = m.status === 'fulfilled' ? m.value.data : [];
        const parcels: ParcelSummary[] = p.status === 'fulfilled' ? p.value.data : [];
        const all: Row[] = [
          ...missions.map((x) => ({ kind: 'mission' as const, id: x.id, reference: x.reference, from: x.pickupCity, to: x.deliveryCity, status: x.status, at: x.pickupAt })),
          ...parcels.map((x) => ({ kind: 'parcel' as const, id: x.id, reference: x.reference, from: x.originCity, to: x.destinationCity, status: x.status, at: x.createdAt })),
        ];
        setRows(all.filter((r) => !DONE.includes(r.status)).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')));
      });
      return () => { alive = false; };
    }, []),
  );

  const goCommander = () => nav.navigate('AppTabs', { screen: 'Commander' } as never);
  const openRow = (r: Row) =>
    r.kind === 'mission'
      ? nav.navigate('MissionDetails', { reference: r.reference })
      : nav.navigate('Tracking', { kind: 'parcel', id: r.id, reference: r.reference });
  const support = async () => {
    try {
      const conv = await openSupportConversation();
      nav.navigate('Messaging', { conversationId: conv.id, driverName: 'Axis Import', subtitle: 'Support' });
    } catch {
      notify('Messagerie indisponible', `Écris-nous à ${COMPANY.email || 'contact@axisimport.fr'}.`);
    }
  };
  const phone = COMPANY.phone?.trim();
  const email = COMPANY.email?.trim() || 'contact@axisimport.fr';

  const bigCard = (icon: keyof typeof Icons, title: string, sub: string, onPress: () => void) => {
    const Ic = Icons[icon];
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}
        style={({ pressed }) => ({
          flex: wide ? 1 : undefined,
          minHeight: wide ? 170 : 140,
          padding: 24,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: pressed ? theme.gold + '88' : theme.line,
          backgroundColor: pressed ? theme.surface2 : theme.surface,
          overflow: 'hidden',
          justifyContent: 'flex-end',
          gap: 4,
        })}
      >
        {/* Halo doré discret en haut à droite. */}
        <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: theme.gold, opacity: 0.035 }} />
        <View pointerEvents="none" style={{ position: 'absolute', right: -20, top: -20, width: 130, height: 130, borderRadius: 65, backgroundColor: theme.gold, opacity: 0.03 }} />
        <View style={{ position: 'absolute', top: 22, left: 24 }}>
          <Ic size={30} color={theme.ink} stroke={1.6} />
        </View>
        <Text style={{ fontSize: 22, color: theme.ink, fontFamily: TYPO.weights.bold, letterSpacing: -0.3 }}>{title}</Text>
        <Text style={{ fontSize: 14.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{sub}</Text>
        <View style={{ position: 'absolute', top: 24, right: 22 }}>
          <Icons.arrow size={18} color={theme.gold} stroke={2.2} />
        </View>
      </Pressable>
    );
  };

  const section = (title: string, right?: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 4 }}>
      <Text style={{ flex: 1, fontSize: 19, color: theme.ink, fontFamily: TYPO.weights.bold }}>{title}</Text>
      {right}
    </View>
  );

  const enCours = (
    <View style={{ gap: 12 }}>
      {section('En cours', rows && rows.length ? (
        <Text onPress={() => nav.navigate('AppTabs', { screen: 'Trips' } as never)} style={{ fontSize: 13.5, color: theme.gold, fontFamily: TYPO.weights.semibold }}>Tout voir</Text>
      ) : null)}
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, overflow: 'hidden' }}>
        {rows === null ? <ActivityIndicator color={theme.link} style={{ margin: 22 }} /> : null}
        {rows && !rows.length ? (
          <Text style={{ padding: 20, fontSize: 15, lineHeight: 21, color: theme.muted, fontFamily: TYPO.weights.medium }}>
            Aucun envoi en cours. Passe ta première commande ci-dessus.
          </Text>
        ) : null}
        {(rows ?? []).slice(0, 4).map((r, i) => (
          <Pressable
            key={`${r.kind}-${r.id}`}
            onPress={() => openRow(r)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: theme.lineSoft, backgroundColor: pressed ? theme.surface2 : 'transparent' })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
              {r.kind === 'mission' ? <Icons.car size={20} color={theme.gold} stroke={1.7} /> : <Icons.box size={20} color={theme.gold} stroke={1.7} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{r.from} → {r.to}</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>{r.reference}</Text>
            </View>
            <StatusBadge status={r.status} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const tarifs = (
    <Pressable
      onPress={() => nav.navigate('Tariffs')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: theme.line, backgroundColor: pressed ? theme.surface2 : theme.surface })}
    >
      <Icons.euro size={22} color={theme.gold} stroke={1.8} />
      <Text style={{ flex: 1, fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Nos tarifs</Text>
      <Icons.chev size={18} color={theme.ink} stroke={2} />
    </Pressable>
  );

  const contactBtn = (icon: keyof typeof Icons, label: string, onPress: () => void) => {
    const Ic = Icons[icon];
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: pressed ? theme.surface2 : theme.bgSoft })}
      >
        <Ic size={18} color={theme.ink} stroke={1.8} />
        <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{label}</Text>
      </Pressable>
    );
  };

  const contact = (
    <View style={{ gap: 12, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
      <Text style={{ fontSize: 19, color: theme.ink, fontFamily: TYPO.weights.bold }}>Nous contacter</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: theme.muted, fontFamily: TYPO.weights.medium }}>
        {COMPANY.name || 'AXIS IMPORT'} · {[COMPANY.address, COMPANY.postalCity].filter(Boolean).join(', ')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {phone ? contactBtn('phone', phone, () => void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)) : null}
        {contactBtn('doc', email, () => void Linking.openURL(`mailto:${email}`))}
        {contactBtn('chat', 'Écrire au support', () => void support())}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: wide ? 32 : 20, paddingTop: wide ? 32 : 24, paddingBottom: 110, gap: 18 }}>
        {/* En-tête : le vrai logo, entier. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Image source={require('../../assets/axis-mark.png')} style={{ width: 52, height: 52 }} resizeMode="contain" accessibilityLabel="Axis Import" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, color: theme.muted, fontFamily: TYPO.weights.medium }}>Axis Import</Text>
            <Text style={{ fontSize: wide ? 30 : 26, color: theme.ink, fontFamily: TYPO.weights.bold, letterSpacing: -0.4 }} numberOfLines={1}>
              Bonjour {user?.firstName ?? ''} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => nav.navigate('Notifications')}
            accessibilityLabel="Notifications"
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: pressed ? theme.bgSoft : theme.surface, alignItems: 'center', justifyContent: 'center' })}
          >
            <Icons.bell size={20} color={theme.ink} stroke={1.7} />
            <CountBadge count={badges.notifications} border={theme.bg} style={{ position: 'absolute', top: -6, right: -6 }} />
          </Pressable>
        </View>

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
          {bigCard('car', 'Convoyer un véhicule', 'France et Europe · prix immédiat', goCommander)}
          {bigCard('ship', 'Envoyer vers l’Afrique', 'Colis, fûts, palettes, véhicules', goCommander)}
        </View>

        {wide ? (
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
            <View style={{ flex: 1.4, gap: 18 }}>{enCours}{tarifs}</View>
            <View style={{ flex: 1, gap: 18, marginTop: 37 }}>{contact}</View>
          </View>
        ) : (
          <>
            {enCours}
            {tarifs}
            {contact}
          </>
        )}
      </ScrollView>

      {/* Une question ? → fil avec l'équipe Axis. */}
      <Pressable
        onPress={() => void support()}
        accessibilityRole="button"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 18,
          bottom: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 999,
          backgroundColor: pressed ? theme.goldDeep : theme.gold,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        })}
      >
        <Icons.chat size={20} color={theme.onGold} stroke={2} />
        <Text style={{ fontSize: 16, color: theme.onGold, fontFamily: TYPO.weights.bold }}>Une question ?</Text>
      </Pressable>
    </SafeAreaView>
  );
}
