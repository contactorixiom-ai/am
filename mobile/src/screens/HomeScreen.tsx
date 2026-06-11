import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SAFE_AREA_TOP, TYPO } from '../theme/tokens';

// Sample data — sera remplacé par fetch des missions réelles
const MISSION = {
  ref: 'AX-2847',
  from: 'Paris 15ᵉ',
  to: 'Bruxelles, Schaerbeek',
  driver: { name: 'Karim Diallo', rating: 4.9 },
  eta: '14h32',
  remaining: '47 km',
  progress: 0.78,
};

const MISSION_AFR = {
  ref: 'AX-2811',
  from: 'Lyon, Vénissieux',
  to: 'Abidjan, Port Autonome',
  step: 'Douane Marseille — sortie maritime',
  eta: 'Lun. 24/05',
  progress: 0.42,
};

export function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Bonne nuit';
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bonjour';
    return 'Bonsoir';
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: SAFE_AREA_TOP - 12,
          paddingHorizontal: 20,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.line,
            backgroundColor: pressed ? theme.bgSoft : theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icons.sliders size={20} color={theme.ink} stroke={1.6} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
            {greeting},
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.semibold, lineHeight: 19 }}
          >
            {user ? `${user.firstName} ${user.lastName}` : 'Bienvenue'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.line,
            backgroundColor: pressed ? theme.bgSoft : theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icons.bell size={20} color={theme.ink} stroke={1.6} />
          <View
            style={{
              position: 'absolute',
              top: 9,
              right: 11,
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: theme.gold,
              borderWidth: 2,
              borderColor: theme.surface,
            }}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 18 }}>
        {/* Hero — Active mission */}
        <Surface padded style={{ padding: 16, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Pill tone="navy">● En route</Pill>
            <Text
              style={{
                fontSize: 11.5,
                color: theme.muted,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                fontFamily: TYPO.weights.medium,
                fontVariant: ['tabular-nums'],
              }}
            >
              {MISSION.ref}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: TYPO.weights.bold,
              fontSize: 28,
              lineHeight: 28 * 1.05,
              color: theme.ink,
              letterSpacing: -0.3,
            }}
          >
            {MISSION.from}
            {'\n'}
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular }}>vers</Text> {MISSION.to}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.medium }}>
                Arrivée prévue
              </Text>
              <Text style={{ fontFamily: TYPO.weights.bold, fontSize: 26, color: theme.ink, lineHeight: 26, marginTop: 2 }}>
                {MISSION.eta}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.medium }}>
                Restant
              </Text>
              <Text style={{ fontFamily: TYPO.weights.bold, fontSize: 26, color: theme.ink, lineHeight: 26, marginTop: 2 }}>
                {MISSION.remaining}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ height: 4, backgroundColor: theme.bgSoft, borderRadius: 2, marginBottom: 14 }}>
            <View
              style={{
                width: `${MISSION.progress * 100}%`,
                height: '100%',
                backgroundColor: theme.gold,
                borderRadius: 2,
              }}
            />
          </View>

          {/* Driver row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name={MISSION.driver.name} size={36} tone="gold" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.medium }}>
                {MISSION.driver.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <Icons.star size={12} color={theme.gold} stroke={2} />
                <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                  {MISSION.driver.rating} · Ton chauffeur
                </Text>
              </View>
            </View>
            <Button
              kind="outline"
              size="sm"
              leftIcon={<Icons.phone size={14} color={theme.ink} stroke={1.8} />}
            >
              Appeler
            </Button>
            <Button kind="primary" size="sm">
              Suivre
            </Button>
          </View>
        </Surface>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => nav.navigate('ServicePicker')}
            style={({ pressed }) => ({
              flex: 1.4,
              borderWidth: 1,
              borderColor: theme.navy,
              backgroundColor: pressed ? theme.navyDeep : theme.navy,
              padding: 16,
              borderRadius: RADII.xxl,
              overflow: 'hidden',
              position: 'relative',
            })}
          >
            <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.12 }}>
              <Icons.bolt size={90} color={theme.gold} stroke={1.5} />
            </View>
            <Text
              style={{
                fontSize: 11.5,
                color: theme.gold,
                letterSpacing: 0.9,
                textTransform: 'uppercase',
                fontFamily: TYPO.weights.semibold,
              }}
            >
              Nouvelle demande
            </Text>
            <Text
              style={{
                fontFamily: TYPO.weights.bold,
                fontSize: 24,
                lineHeight: 24 * 1.05,
                marginTop: 6,
                color: '#F5F1E8',
                letterSpacing: -0.2,
              }}
            >
              Convoyer ou expédier
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.65)', marginTop: 10, fontFamily: TYPO.weights.medium }}>
              4 services · réponse sous 2h
            </Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('AppTabs')}
            style={({ pressed }) => ({
              flex: 1,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: pressed ? theme.bgSoft : theme.surface,
              padding: 16,
              borderRadius: RADII.xxl,
            })}
          >
            <Icons.doc size={24} color={theme.gold} stroke={1.6} />
            <Text
              style={{
                fontSize: 14,
                color: theme.ink,
                marginTop: 10,
                lineHeight: 16,
                fontFamily: TYPO.weights.semibold,
              }}
            >
              Documents{'\n'}& factures
            </Text>
            <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 6, fontFamily: TYPO.weights.medium }}>
              3 à signer
            </Text>
          </Pressable>
        </View>

        {/* Second mission card */}
        <Surface padded style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Pill tone="gold">● Douane</Pill>
            <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, fontVariant: ['tabular-nums'] }}>
              {MISSION_AFR.ref}
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.medium, marginBottom: 2 }}>
            {MISSION_AFR.from} → {MISSION_AFR.to}
          </Text>
          <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 10, fontFamily: TYPO.weights.medium }}>
            {MISSION_AFR.step}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 3, backgroundColor: theme.bgSoft, borderRadius: 2 }}>
              <View
                style={{
                  width: `${MISSION_AFR.progress * 100}%`,
                  height: '100%',
                  backgroundColor: theme.gold,
                  borderRadius: 2,
                }}
              />
            </View>
            <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              Arrivée {MISSION_AFR.eta}
            </Text>
          </View>
        </Surface>

        {/* News preview */}
        <View>
          <SectionHead
            title="Actualités transport"
            action="Voir tout"
            onAction={() => {}}
          />
          <Surface padded>
            <Pill tone="gold">Réglementation</Pill>
            <Text
              style={{
                fontSize: 14.5,
                color: theme.ink,
                marginTop: 10,
                lineHeight: 14.5 * 1.3,
                fontFamily: TYPO.weights.semibold,
                letterSpacing: -0.1,
              }}
            >
              Nouveau document douanier obligatoire pour les exports véhicules vers le Sénégal
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>Il y a 2 j</Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>·</Text>
              <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>Lecture 3 min</Text>
            </View>
          </Surface>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
