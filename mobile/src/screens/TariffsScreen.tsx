// Écran « Nos tarifs » : la grille import-export d'Axis telle que Roger l'a
// publiée (fûts, cartons, valises, électroménager, m³, palettes, véhicules
// RORO, aérien, export Afrique → Europe). Les prix viennent de l'API, ceux-là
// mêmes qui servent au devis.
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { openSupportConversation } from '../api/messaging';
import { TariffItem, TariffSection, TariffSheet } from '../api/quotes';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { eurShort, tariffEmoji, tariffPriceLabel, tariffUnitWord, useTariffs } from '../utils/tariffs';

export function TariffsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const { sheet, failed, reload } = useTariffs();
  const [opening, setOpening] = useState(false);

  const askQuote = async () => {
    if (!user) {
      nav.navigate('Login');
      return;
    }
    setOpening(true);
    try {
      const conv = await openSupportConversation();
      nav.navigate('Messaging', { conversationId: conv.id, driverName: 'Axis Import', subtitle: 'Demande de devis' });
    } catch {
      notify('Messagerie indisponible', 'Réessaie dans un instant.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Nos tarifs" subtitle="France · Europe · Afrique subsaharienne" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>
        <Surface flat style={{ backgroundColor: theme.navy, borderColor: theme.navy, padding: 18 }}>
          <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            Tarifs import-export
          </Text>
          <Text style={{ fontSize: 24, color: '#F1ECDC', fontFamily: TYPO.weights.bold, marginTop: 6, letterSpacing: -0.3 }}>
            Le prix affiché est le prix payé
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(241,236,220,0.75)', fontFamily: TYPO.weights.medium, marginTop: 6, lineHeight: 18 }}>
            Prix TTC par envoi. Ton devis reprend exactement cette grille ; les prix en fourchette sont confirmés au dépôt selon la taille et la destination.
          </Text>
        </Surface>

        {!sheet && !failed ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.navy} />
          </View>
        ) : null}

        {failed ? (
          <Surface>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: 14 }}>
              Grille indisponible pour le moment
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12.5, marginTop: 4 }}>
              Vérifie ta connexion puis réessaie.
            </Text>
            <Button kind="ghost" size="sm" onPress={reload} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              Réessayer
            </Button>
          </Surface>
        ) : null}

        {sheet
          ? sheet.sections.map((section) => (
              <SectionCard key={section.id} section={section} sheet={sheet} />
            ))
          : null}

        {sheet ? (
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 }}>
            {sheet.notes.ranges}
          </Text>
        ) : null}

        <View style={{ gap: 10, marginTop: 4 }}>
          <Button
            kind="primary"
            size="lg"
            fullWidth
            onPress={() => (user ? nav.navigate('ServicePicker') : nav.navigate('Login'))}
            rightIcon={<Icons.arrow size={18} color="#fff" stroke={2} />}
          >
            Préparer un envoi
          </Button>
          <Button kind="outline" size="lg" fullWidth loading={opening} onPress={askQuote}>
            Véhicule, export ou envoi pro : demander un devis
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ section, sheet }: { section: TariffSection; sheet: TariffSheet }) {
  const { theme } = useTheme();
  const items = sheet.items.filter((i) => i.section === section.id);
  if (items.length === 0) return null;
  const index = sheet.sections.findIndex((s) => s.id === section.id) + 1;
  return (
    <Surface style={{ padding: 0, overflow: 'hidden' }} padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: theme.bgSoft }}>
        <Text style={{ color: theme.goldDeep, fontFamily: TYPO.weights.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
          {index} · {section.mode === 'AIR' ? 'Aérien' : section.mode === 'SEA' ? 'Maritime' : 'Aérien et maritime'}
        </Text>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: 16, marginTop: 4, letterSpacing: -0.2 }}>
          {section.title}
        </Text>
        {section.subtitle ? (
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12.5, marginTop: 2 }}>
            {section.subtitle}
          </Text>
        ) : null}
      </View>
      {items.map((item, i) => (
        <TariffRow key={item.code} item={item} last={i === items.length - 1} />
      ))}
      {section.id === 'EFFECTS' ? (
        <NoteBox lines={[`+ ${eurShort(sheet.customsFeeCents)} TTC de frais de douane à ajouter aux effets personnels`, sheet.notes.extraVolume]} />
      ) : null}
      {section.id === 'GENERAL' ? <NoteBox lines={[sheet.notes.minimum]} /> : null}
    </Surface>
  );
}

function TariffRow({ item, last }: { item: TariffItem; last: boolean }) {
  const { theme } = useTheme();
  const sub = [item.detail, item.included].filter(Boolean).join(' · ');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
      }}
    >
      <Text style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{tariffEmoji(item.code)}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: 14 }}>{item.label}</Text>
        {sub ? (
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 2, lineHeight: 16 }}>{sub}</Text>
        ) : null}
        {item.convoyPerKmCents ? (
          <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 3 }}>
            Option convoyage routier jusqu'au port : +{eurShort(item.convoyPerKmCents)}/km
          </Text>
        ) : null}
        {item.note ? (
          <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 3, lineHeight: 16 }}>{item.note}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', maxWidth: 130 }}>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: 14.5, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
          {tariffPriceLabel(item)}
        </Text>
        {item.unit === 'piece' && !item.onQuote ? (
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11, marginTop: 2 }}>{tariffUnitWord(item)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function NoteBox({ lines }: { lines: string[] }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        margin: 12,
        marginTop: 4,
        padding: 12,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: theme.gold + '66',
        backgroundColor: theme.gold + '14',
        gap: 4,
      }}
    >
      {lines.map((l) => (
        <Text key={l} style={{ color: theme.goldDeep, fontFamily: TYPO.weights.semibold, fontSize: 12.5, lineHeight: 17 }}>
          {l}
        </Text>
      ))}
    </View>
  );
}
