import { CommonActions, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { LogisticsPartnerCard } from '../components/LogisticsPartnerCard';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { selectPartner } from '../utils/logisticsPartners';

export function BookingConfirmationScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingConfirmation'>>();
  const { kind, reference, id } = route.params;

  const partner = kind === 'parcel' ? selectPartner({ fromCountry: 'FR', weightKg: 12, toCountry: 'SN' }) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 24, gap: SPACING.lg }}>
        <View style={{ alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.lg }}>
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
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5, textAlign: 'center' }}>
            Réservation confirmée
          </Text>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, textAlign: 'center' }}>
            {kind === 'mission'
              ? 'Ta mission est publiée. Un convoyeur va l\'accepter sous peu.'
              : 'Ton colis est enregistré. Un transporteur partenaire vient le récupérer pour rejoindre notre hub Axis.'}
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

        {partner ? (
          <View style={{ gap: SPACING.sm }}>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
              Prochaine étape
            </Text>
            <LogisticsPartnerCard partner={partner} />
            <Surface padded style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icons.bell size={18} color={theme.gold} stroke={1.8} />
              <Text style={{ flex: 1, fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
                Tu recevras une notification dès que {partner.name} aura récupéré ton colis. Tout le suivi multi-tronçons se fait dans cette app.
              </Text>
            </Surface>
          </View>
        ) : null}

        <View style={{ gap: SPACING.md, marginTop: SPACING.md }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}
