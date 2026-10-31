// Divulgation visible avant la demande de localisation en arrière-plan.
//
// Google Play l'exige (règle « Prominent disclosure ») : avant que le système
// ne demande l'autorisation, l'application doit expliquer elle-même, dans son
// parcours normal, quelles données de localisation elle collecte, pourquoi,
// et qu'elle le fait même application fermée — puis obtenir un accord
// explicite. Sans cet écran, l'application est refusée sur le Play Store.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Linking, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { LEGAL_PRIVACY_URL } from '../config/company';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { Button } from './Button';
import { Icons } from './Icons';

const ACCEPTED_KEY = 'axis.locationDisclosure.v1';

/** Le convoyeur a déjà accepté l'explication sur ce téléphone ? */
export async function locationDisclosureAccepted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ACCEPTED_KEY)) === 'accepted';
  } catch {
    return false;
  }
}

async function rememberAccepted(): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCEPTED_KEY, 'accepted');
  } catch {
    // Stockage indisponible : l'explication sera simplement montrée à nouveau.
  }
}

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function LocationDisclosureModal({ visible, onAccept, onDecline }: Props) {
  const { theme } = useTheme();
  const settingName = Platform.OS === 'ios' ? '« Toujours »' : '« Toujours autoriser »';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={{ flex: 1, backgroundColor: 'rgba(9, 12, 20, 0.72)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: RADII.xl, maxHeight: '90%', overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: theme.gold + '26',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icons.pin size={26} color={theme.goldDeep} stroke={1.9} />
            </View>
            <Text style={{ fontSize: 21, color: theme.ink, fontFamily: TYPO.weights.bold, letterSpacing: -0.2 }}>
              Partage de ta position pendant le convoyage
            </Text>
            <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.medium, lineHeight: 21 }}>
              Axis Import collecte les données de localisation de ce téléphone pour permettre au client de suivre son
              véhicule en temps réel et à Axis de te venir en aide en cas d'arrêt prolongé,{' '}
              <Text style={{ fontFamily: TYPO.weights.bold }}>
                même lorsque l'application est fermée ou n'est pas utilisée
              </Text>{' '}
              (écran verrouillé).
            </Text>
            <View style={{ gap: 6 }}>
              {[
                'Uniquement pendant une mission que tu lances toi-même.',
                'Partagée avec le client de ce convoyage et avec Axis Import, jamais avec un autre utilisateur.',
                'Le partage s\'arrête à la livraison ou quand tu arrêtes le suivi. Hors mission, aucune position n\'est relevée.',
              ].map((line) => (
                <View key={line} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Icons.check size={15} color={theme.good} stroke={2.2} />
                  <Text style={{ flex: 1, fontSize: 13.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 19 }}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
              À l'écran suivant, choisis {settingName} pour que le suivi continue écran verrouillé.
            </Text>
            <Text
              onPress={() => Linking.openURL(LEGAL_PRIVACY_URL).catch(() => {})}
              style={{ fontSize: 13, color: theme.link, fontFamily: TYPO.weights.semibold, textDecorationLine: 'underline' }}
            >
              Politique de confidentialité
            </Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              <Button
                kind="gold"
                size="lg"
                fullWidth
                onPress={async () => {
                  await rememberAccepted();
                  onAccept();
                }}
              >
                J'accepte
              </Button>
              <Button kind="outline" size="lg" fullWidth onPress={onDecline}>
                Refuser
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
