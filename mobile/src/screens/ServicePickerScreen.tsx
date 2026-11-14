import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Grid } from '../components/Grid';
import { Icons } from '../components/Icons';
import { coverageLabel, hasInsurance, INSURANCE, OPERATIONS } from '../config/company';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

type ServiceId = 'car' | 'moto' | 'bus' | 'flatbed' | 'colis' | 'merch' | 'vehicle' | 'import';

const SERVICES: {
  id: ServiceId;
  IconComp: (typeof Icons)[keyof typeof Icons];
  title: string;
  sub: string;
  tag: string;
  delay: string;
  enabled: boolean;
}[] = [
  { id: 'car',   IconComp: Icons.car,    title: 'Convoyage voiture',       sub: 'Particulier ou pro · par la route', tag: 'Europe', delay: OPERATIONS.delays?.car ?? '', enabled: true },
  { id: 'moto',  IconComp: Icons.bike,   title: 'Convoyage moto',          sub: 'Particulier ou pro',           tag: 'Europe',   delay: OPERATIONS.delays?.moto ?? '',  enabled: true },
  { id: 'bus',   IconComp: Icons.bus,    title: 'Bus & autocar',           sub: 'Minibus, bus, autocar · chauffeur permis D', tag: 'Europe', delay: OPERATIONS.delays?.car ?? '', enabled: true },
  { id: 'flatbed', IconComp: Icons.flatbed, title: 'Transport sur plateau', sub: 'Véhicule neuf, de collection ou non roulant, sur camion', tag: 'Europe', delay: OPERATIONS.delays?.car ?? '', enabled: true },
  { id: 'colis', IconComp: Icons.box,    title: 'Colis & paquets',         sub: 'Cartons, fûts, valises, effets personnels', tag: 'Eur → Afr', delay: OPERATIONS.delays?.colis ?? '', enabled: true },
  { id: 'merch', IconComp: Icons.pallet, title: 'Marchandise volumineuse', sub: 'Palettes, machines, mobilier, au m³', tag: 'Eur → Afr', delay: OPERATIONS.delays?.merch ?? '', enabled: true },
  { id: 'vehicle', IconComp: Icons.ship, title: 'Voiture vers l\'Afrique', sub: 'Expédition par bateau, du port du Havre', tag: 'Eur → Afr', delay: OPERATIONS.delays?.sea ?? '', enabled: true },
  { id: 'import', IconComp: Icons.globe, title: 'Import Afrique → France', sub: 'Épices, épicerie, artisanat, échantillons', tag: 'Afr → Eur', delay: '', enabled: true },
];

export function ServicePickerScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Onglet « Commander » de la barre du bas, ou écran ouvert depuis un bouton.
  const asTab = useRoute().name === 'Commander';

  // Un appui sur un service ouvre directement son formulaire.
  const go = (id: ServiceId) => {
    if (id === 'car') nav.navigate('CarRequest', { service: 'CONVOY_CAR' });
    else if (id === 'moto') nav.navigate('CarRequest', { service: 'CONVOY_MOTO' });
    else if (id === 'bus') nav.navigate('CarRequest', { service: 'CONVOY_BUS' });
    else if (id === 'flatbed') nav.navigate('CarRequest', { service: 'CONVOY_FLATBED' });
    else if (id === 'colis') nav.navigate('ParcelRequest', { service: 'PARCEL' });
    else if (id === 'merch') nav.navigate('ParcelRequest', { service: 'MERCHANDISE' });
    else if (id === 'vehicle') nav.navigate('ParcelRequest', { service: 'MERCHANDISE', flow: 'VEHICLE' });
    else if (id === 'import') nav.navigate('ParcelRequest', { service: 'PARCEL', flow: 'IMPORT' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {asTab ? null : <AppBar title="Commander" subtitle="Choisis un service" />}

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: asTab ? 28 : 16, paddingBottom: 32 }}>
        <Text style={{ fontFamily: TYPO.weights.bold, fontSize: 30, lineHeight: 34, color: theme.ink, letterSpacing: -0.4, marginBottom: 8 }}>
          Que veux-tu transporter{'\u00a0'}?
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 21, color: theme.muted, marginBottom: 22, fontFamily: TYPO.weights.medium }}>
          Choisis le service : le prix s'affiche tout de suite, puis Axis confirme ta commande.
        </Text>

        {/* 2 colonnes sur téléphone, jusqu'à 4 sur ordinateur */}
        <Grid gap={12} minItemWidth={150} maxColumns={4}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => s.enabled && go(s.id)}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}. ${s.sub}`}
              style={({ pressed }) => ({
                flex: 1,
                padding: 16,
                backgroundColor: pressed ? theme.surface2 : theme.surface,
                borderWidth: 1,
                borderColor: pressed ? theme.gold + '88' : theme.line,
                borderRadius: 22,
                minHeight: 186,
                gap: 8,
                opacity: s.enabled ? 1 : 0.55,
              })}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: theme.gold + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <s.IconComp size={24} color={theme.gold} stroke={1.7} />
              </View>
              <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.semibold, lineHeight: 20, letterSpacing: -0.1 }}>
                {s.title}
              </Text>
              <Text style={{ fontSize: 13, color: theme.muted, lineHeight: 18, fontFamily: TYPO.weights.medium }}>
                {s.sub}
              </Text>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <View style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.bgSoft }}>
                  <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.semibold }}>{s.tag}</Text>
                </View>
                {s.delay ? <Pill tone="ghost">{s.delay}</Pill> : null}
              </View>
            </Pressable>
          ))}
        </Grid>

        {/* La grille tarifaire complète (comptes connectés seulement). */}
        <Pressable
          onPress={() => nav.navigate('Tariffs')}
          style={({ pressed }) => ({
            marginTop: 16,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.line,
            backgroundColor: pressed ? theme.bgSoft : theme.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          })}
        >
          <Icons.euro size={22} color={theme.gold} stroke={1.8} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Nos tarifs</Text>
            <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }}>
              Fûts, cartons, valises, m³, palettes, véhicules, aérien
            </Text>
          </View>
          <Icons.chev size={16} color={theme.muted} stroke={2} />
        </Pressable>

        {/* Promesse d'assurance : affichée seulement si une couverture a
            réellement été souscrite et renseignée. */}
        {hasInsurance() ? (
          <Surface variant="alt" style={{ marginTop: 18, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icons.shield size={28} color={theme.gold} stroke={1.6} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.medium }}>
                Marchandise assurée pendant le transport
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }}>
                Jusqu'à {coverageLabel()} · {INSURANCE.insurer}
              </Text>
            </View>
          </Surface>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
