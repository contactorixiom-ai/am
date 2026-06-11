import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

const FILTERS = [
  { id: 'all',     label: 'Tous',     count: 12 },
  { id: 'contrat', label: 'Contrats', count: 4 },
  { id: 'fact',    label: 'Factures', count: 5 },
  { id: 'cmr',     label: 'CMR',      count: 2 },
  { id: 'douane',  label: 'Douane',   count: 1 },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

interface Doc {
  id: number;
  type: string;
  tone: PillTone;
  title: string;
  ref: string;
  date: string;
  size: string;
  iconKey: keyof typeof Icons;
}

const DOCS: Doc[] = [
  { id: 1, type: 'À signer',  tone: 'warn',    title: 'Contrat de convoyage',                  ref: 'AX-2847 · BMW Série 3', date: '22 mai 2026', size: '178 ko', iconKey: 'sig' },
  { id: 2, type: 'Contrat',   tone: 'navy',    title: 'État des lieux — départ',                ref: 'AX-2847 · BMW Série 3', date: '22 mai 2026', size: '2,1 Mo', iconKey: 'doc' },
  { id: 3, type: 'CMR',       tone: 'gold',    title: 'Lettre de voiture internationale',       ref: 'AX-2811 · 4 palettes',  date: '18 mai 2026', size: '320 ko', iconKey: 'globe' },
  { id: 4, type: 'Douane',    tone: 'gold',    title: 'Déclaration export — Sénégal',           ref: 'AX-2811',                date: '17 mai 2026', size: '440 ko', iconKey: 'globe' },
  { id: 5, type: 'Facture',   tone: 'good',    title: 'FA-2026-0184',                            ref: '512,00 € · Payé',        date: '14 mai 2026', size: '64 ko',  iconKey: 'euro' },
  { id: 6, type: 'Facture',   tone: 'warn',    title: 'FA-2026-0179',                            ref: '1 240,00 € · À régler',  date: '08 mai 2026', size: '68 ko',  iconKey: 'euro' },
];

export function DocumentsScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<FilterId>('all');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title="Documents"
        subtitle="Signature, factures, douane"
        trailing={
          <Pressable
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: pressed ? theme.line : theme.bgSoft,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Icons.search size={18} color={theme.ink} stroke={1.8} />
          </Pressable>
        }
      />

      {/* Filter rail horizontal */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 16, gap: 8 }}
        >
          {FILTERS.map((f) => {
            const on = tab === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setTab(f.id)}
                style={{
                  flexShrink: 0,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? theme.select : theme.line,
                  backgroundColor: on ? theme.select : theme.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: on ? theme.selectInk : theme.ink,
                    fontFamily: TYPO.weights.medium,
                  }}
                >
                  {f.label}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: on ? theme.selectInk : theme.muted,
                    opacity: 0.8,
                    fontFamily: TYPO.weights.semibold,
                  }}
                >
                  {f.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
        {/* Pending signature card (navy gradient look) */}
        <Surface
          padded
          flat
          style={{
            padding: 14,
            backgroundColor: theme.navy,
            borderColor: theme.navy,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: theme.gold + '2E',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icons.sig size={22} color={theme.goldHi} stroke={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.goldHi,
                  letterSpacing: 0.9,
                  textTransform: 'uppercase',
                  fontFamily: TYPO.weights.semibold,
                }}
              >
                À signer
              </Text>
              <Text
                style={{
                  fontSize: 14.5,
                  color: '#F5F1E8',
                  lineHeight: 18,
                  marginTop: 2,
                  fontFamily: TYPO.weights.semibold,
                }}
              >
                Contrat de convoyage AX-2847
              </Text>
            </View>
            <Button kind="gold" size="sm">
              Signer
            </Button>
          </View>
        </Surface>

        {/* Doc list */}
        {DOCS.map((d) => {
          const IconComp = Icons[d.iconKey];
          return (
            <Pressable key={d.id}>
              <Surface padded style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: theme.bgSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconComp size={22} color={theme.navy} stroke={1.6} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Pill tone={d.tone}>{d.type}</Pill>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 14,
                        color: theme.ink,
                        marginTop: 6,
                        fontFamily: TYPO.weights.semibold,
                      }}
                    >
                      {d.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 12, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }}
                    >
                      {d.ref}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                        {d.date}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.muted }}>·</Text>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                        {d.size}
                      </Text>
                    </View>
                  </View>
                  <Icons.chev size={18} color={theme.muted} stroke={1.6} />
                </View>
              </Surface>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
