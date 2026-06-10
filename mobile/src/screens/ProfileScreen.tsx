import React from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Surface } from '../components/Surface';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

export function ProfileScreen() {
  const { theme } = useTheme();
  const { user, logout } = useSession();

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu es sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Mon compte
          </Text>
        </View>

        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.navy,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.gold, fontFamily: TYPO.weights.bold, fontSize: 24 }}>
                {user ? `${user.firstName[0]}${user.lastName[0]}` : 'AI'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.title }}>
                {user ? `${user.firstName} ${user.lastName}` : 'Invité'}
              </Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
                {user?.email}
              </Text>
            </View>
          </View>
        </Surface>

        <Section title="Compte">
          <Row label="Informations personnelles" />
          <Row label="Documents d'identité (KYC)" />
          <Row label="Méthodes de paiement" />
        </Section>

        <Section title="Préférences">
          <Row label="Notifications" />
          <Row label="Langue" hint="Français" />
        </Section>

        <Section title="Axis Import">
          <Row label="Centre d'aide" />
          <Row label="Conditions d'utilisation" />
          <Row label="Politique de confidentialité" />
        </Section>

        <Button kind="outline" onPress={handleLogout}>
          Se déconnecter
        </Button>

        <View style={{ alignItems: 'center', marginTop: SPACING.lg }}>
          <AxisLogo size={32} />
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.caption, marginTop: 8 }}>
            Axis Import · v0.1.0 MVP
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACING.md }}>
        {title}
      </Text>
      <Surface padded={false}>{children}</Surface>
    </View>
  );
}

function Row({ label, hint }: { label: string; hint?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => ({
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.line,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: pressed ? theme.bgSoft : 'transparent',
        borderRadius: RADII.md,
      })}
    >
      <Text style={{ color: theme.ink, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body }}>{label}</Text>
      {hint ? (
        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>{hint}</Text>
      ) : (
        <Text style={{ color: theme.faint, fontSize: TYPO.sizes.body }}>›</Text>
      )}
    </Pressable>
  );
}
