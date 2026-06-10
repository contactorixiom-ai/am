import { CommonActions, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function BookingConfirmationScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingConfirmation'>>();
  const { kind, reference, id } = route.params;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, padding: SPACING.xxl, justifyContent: 'space-between' }}>
        <View />
        <View style={{ gap: SPACING.xl, alignItems: 'center' }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: theme.good + '22',
              borderWidth: 2,
              borderColor: theme.good,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 44 }}>✓</Text>
          </View>
          <View style={{ alignItems: 'center', gap: SPACING.md }}>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5, textAlign: 'center' }}>
              Réservation confirmée
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, textAlign: 'center' }}>
              {kind === 'mission'
                ? 'Ta mission est publiée. Un convoyeur va l\'accepter sous peu.'
                : 'Ton colis est enregistré. Tu peux le suivre à tout moment via sa référence.'}
            </Text>
          </View>
          <Surface>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
              Référence
            </Text>
            <Text
              selectable
              style={{
                color: theme.ink,
                fontFamily: TYPO.weights.bold,
                fontSize: TYPO.sizes.displayS,
                letterSpacing: -0.3,
                marginTop: 6,
                fontVariant: ['tabular-nums'],
              }}
            >
              {reference}
            </Text>
          </Surface>
        </View>

        <View style={{ gap: SPACING.md }}>
          <Button kind="primary" size="lg" fullWidth onPress={() => nav.navigate('Tracking', { kind, id, reference })}>
            Voir le suivi
          </Button>
          <Button
            kind="ghost"
            onPress={() =>
              nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'AppTabs' }] }))
            }
          >
            Retour à l'accueil
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
