import React from 'react';
import { Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { confirmAction } from '../utils/notify';
import Svg, { Circle } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { Icons } from '../components/Icons';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SAFE_AREA_TOP, TYPO } from '../theme/tokens';

export function ProfileScreen() {
  const { theme, isDark, setMode } = useTheme();
  const { user, logout } = useSession();

  const handleLogout = () => {
    confirmAction('Déconnexion', 'Tu es sûr ?', () => logout(), 'Se déconnecter');
  };

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Invité';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header navy avec profil + stats — repris du drawer menu maquette */}
        <View
          style={{
            paddingTop: SAFE_AREA_TOP - 8,
            paddingBottom: 22,
            paddingHorizontal: 22,
            backgroundColor: theme.navy,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Decorative gold ring */}
          <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -60, width: 220, height: 220, opacity: 0.14 }}>
            <Svg width={220} height={220} viewBox="0 0 200 200">
              <Circle cx="100" cy="100" r="90" stroke={theme.gold} strokeWidth={1} fill="none" />
              <Circle cx="100" cy="100" r="60" stroke={theme.gold} strokeWidth={1} fill="none" />
            </Svg>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={fullName} size={52} tone="gold" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, color: '#F5F1E8', fontFamily: TYPO.weights.semibold, letterSpacing: -0.2 }}>
                {fullName}
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.62)', marginTop: 2, fontFamily: TYPO.weights.medium }}>
                {user?.email ?? ''}
              </Text>
            </View>
          </View>

          {/* Stats strip */}
          <View
            style={{
              marginTop: 18,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View>
              <Text style={{ fontSize: 18, color: theme.goldHi, fontFamily: TYPO.weights.bold }}>0</Text>
              <Text style={{ fontSize: 10, color: 'rgba(245,241,232,0.55)', letterSpacing: 0.4, marginTop: 1, fontFamily: TYPO.weights.medium }}>
                Missions
              </Text>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <View>
              <Text style={{ fontSize: 18, color: theme.goldHi, fontFamily: TYPO.weights.bold }}>0 €</Text>
              <Text style={{ fontSize: 10, color: 'rgba(245,241,232,0.55)', letterSpacing: 0.4, marginTop: 1, fontFamily: TYPO.weights.medium }}>
                Total dépensé
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 9,
                borderRadius: 999,
                backgroundColor: theme.gold + '2E',
              }}
            >
              <Text style={{ fontSize: 10.5, color: theme.goldHi, letterSpacing: 0.6, fontFamily: TYPO.weights.semibold }}>
                CLIENT
              </Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        <View style={{ paddingHorizontal: 8, paddingTop: 14 }}>
          <MenuSection label="Compte">
            <MenuRow iconKey="user" label="Mon profil" />
            <MenuRow iconKey="pin" label="Mes adresses" trailing="0" />
            <MenuRow iconKey="card" label="Modes de paiement" trailing="0" />
          </MenuSection>

          <MenuSection label="Activité">
            <MenuRow iconKey="truck" label="Mes missions" />
            <MenuRow iconKey="doc" label="Documents & factures" />
            <MenuRow iconKey="news" label="Actualités transport" />
          </MenuSection>

          <MenuSection label="Axis">
            <MenuRow iconKey="bolt" label="Devenir chauffeur Axis" badge="Nouveau" />
            <MenuRow iconKey="star" label="Parrainage" sub="20 € par filleul" />
            <MenuRow iconKey="shield" label="Centre d'aide" />
          </MenuSection>

          <MenuSection label="Préférences">
            <MenuRow iconKey="bell" label="Notifications" />
            <MenuRow iconKey="globe" label="Langue" trailing="Français" />
            <MenuRowToggle
              label="Mode sombre"
              value={isDark}
              onChange={(v) => setMode(v ? 'dark' : 'light')}
            />
          </MenuSection>

          {/* Logout */}
          <View style={{ paddingHorizontal: 12, marginTop: 6 }}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => ({
                paddingVertical: 13,
                borderRadius: RADII.md,
                borderWidth: 1,
                borderColor: theme.bad + '4D',
                backgroundColor: pressed ? theme.bad + '14' : 'transparent',
                alignItems: 'center',
              })}
            >
              <Text style={{ color: theme.bad, fontSize: 14, fontFamily: TYPO.weights.semibold }}>
                Se déconnecter
              </Text>
            </Pressable>
            <Text
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: theme.faint,
                marginTop: 14,
                fontFamily: TYPO.weights.medium,
              }}
            >
              Axis Import · v0.1.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontSize: 11,
          color: theme.muted,
          letterSpacing: 0.9,
          textTransform: 'uppercase',
          fontFamily: TYPO.weights.semibold,
          paddingHorizontal: 16,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function MenuRow({
  iconKey,
  label,
  sub,
  trailing,
  badge,
  onPress,
}: {
  iconKey: keyof typeof Icons;
  label: string;
  sub?: string;
  trailing?: string;
  badge?: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const IconComp = Icons[iconKey];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: RADII.md,
        backgroundColor: pressed ? theme.bgSoft : 'transparent',
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.bgSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconComp size={18} color={theme.navy} stroke={1.6} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.medium }}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 1, fontFamily: TYPO.weights.medium }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View
          style={{
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: 999,
            backgroundColor: theme.gold + '24',
          }}
        >
          <Text style={{ fontSize: 10.5, color: theme.goldDeep, fontFamily: TYPO.weights.semibold }}>{badge}</Text>
        </View>
      ) : null}
      {trailing ? (
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{trailing}</Text>
      ) : null}
      <Icons.chev size={16} color={theme.faint} stroke={1.6} />
    </Pressable>
  );
}

function MenuRowToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.bgSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icons.bolt size={18} color={theme.navy} stroke={1.6} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.medium }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.line, true: theme.gold }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
