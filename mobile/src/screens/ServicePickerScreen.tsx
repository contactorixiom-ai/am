import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

type ServiceId = 'car' | 'moto' | 'colis' | 'merch';

const SERVICES: {
  id: ServiceId;
  IconComp: (typeof Icons)[keyof typeof Icons];
  title: string;
  sub: string;
  tag: string;
  delay: string;
  enabled: boolean;
}[] = [
  { id: 'car',   IconComp: Icons.car,    title: 'Convoyage voiture',       sub: 'Particulier ou pro',           tag: 'Europe',   delay: '2-5 jours',  enabled: true },
  { id: 'moto',  IconComp: Icons.bike,   title: 'Convoyage moto',          sub: 'Plateau ou roulé',             tag: 'Europe',   delay: '2-4 jours',  enabled: false },
  { id: 'colis', IconComp: Icons.box,    title: 'Colis & paquets',         sub: '< 30 kg, multi-points',        tag: 'Eur ⇄ Afr', delay: '5-10 jours', enabled: true },
  { id: 'merch', IconComp: Icons.pallet, title: 'Marchandise volumineuse', sub: 'Palettes, machines, mobilier', tag: 'Eur ⇄ Afr', delay: '7-21 jours', enabled: false },
];

export function ServicePickerScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selected, setSelected] = useState<ServiceId | null>(null);

  const goNext = () => {
    if (!selected) return;
    if (selected === 'car') nav.navigate('CarRequest');
    else if (selected === 'colis') nav.navigate('ParcelRequest');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Nouvelle demande" subtitle="Étape 1 sur 2" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
        <Text
          style={{
            fontFamily: TYPO.weights.bold,
            fontSize: 28,
            lineHeight: 28 * 1.05,
            color: theme.ink,
            letterSpacing: -0.3,
            marginBottom: 6,
          }}
        >
          Que veux-tu <Text style={{ color: theme.goldDeep }}>transporter</Text> ?
        </Text>
        <Text
          style={{
            fontSize: 13.5,
            color: theme.muted,
            marginBottom: 18,
            fontFamily: TYPO.weights.medium,
          }}
        >
          Choisis le service, nos équipes te rappellent sous 2h avec un devis personnalisé.
        </Text>

        {/* 2x2 grid */}
        <View style={{ gap: 10 }}>
          {[0, 2].map((startIndex) => (
            <View key={startIndex} style={{ flexDirection: 'row', gap: 10 }}>
              {SERVICES.slice(startIndex, startIndex + 2).map((s) => {
                const sel = selected === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => s.enabled && setSelected(s.id)}
                    style={{
                      flex: 1,
                      padding: 14,
                      backgroundColor: sel ? theme.surface : theme.surface2,
                      borderWidth: 1.5,
                      borderColor: sel ? theme.select : theme.line,
                      borderRadius: RADII.xxl,
                      minHeight: 152,
                      gap: 6,
                      opacity: s.enabled ? 1 : 0.55,
                    }}
                  >
                    {sel && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: theme.select,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icons.check size={14} color={theme.selectInk} stroke={2.4} />
                      </View>
                    )}
                    <View style={{ marginBottom: 4 }}>
                      <s.IconComp size={30} color={sel ? theme.gold : theme.navy} stroke={1.5} />
                    </View>
                    <Text
                      style={{
                        fontSize: 14.5,
                        color: theme.ink,
                        fontFamily: TYPO.weights.semibold,
                        lineHeight: 14.5 * 1.15,
                        letterSpacing: -0.1,
                      }}
                    >
                      {s.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.muted,
                        lineHeight: 12 * 1.3,
                        fontFamily: TYPO.weights.medium,
                      }}
                    >
                      {s.sub}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pill tone="default">{s.tag}</Pill>
                      <Pill tone="ghost">{s.delay}</Pill>
                    </View>
                    {!s.enabled && (
                      <View style={{ position: 'absolute', top: 10, right: 10 }}>
                        <Pill tone="ghost">Bientôt</Pill>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Insurance preview */}
        <Surface variant="alt" style={{ marginTop: 18, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icons.shield size={28} color={theme.gold} stroke={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.medium }}>
              Assurance tous risques incluse
            </Text>
            <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }}>
              Jusqu'à 250 000 €, signature électronique des documents
            </Text>
          </View>
        </Surface>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        style={{
          padding: 20,
          paddingTop: 12,
          paddingBottom: 24,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.line,
        }}
      >
        <Button
          kind="primary"
          size="lg"
          fullWidth
          disabled={!selected}
          onPress={goNext}
          rightIcon={<Icons.arrow size={18} color="#FFFFFF" stroke={2} />}
        >
          Continuer
        </Button>
      </View>
    </SafeAreaView>
  );
}
