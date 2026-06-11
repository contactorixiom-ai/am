import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { listNews, NewsArticle } from '../api/news';
import { AppBar } from '../components/AppBar';
import { DotLoader } from '../components/DotLoader';
import { Pill, PillTone } from '../components/Pill';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

// Articles de démo affichés si le backend est indisponible / vide.
const DEMO_ARTICLES: { tag: string; tone: PillTone; title: string; meta: string }[] = [
  {
    tag: 'Réglementation',
    tone: 'gold',
    title: 'Nouveau document douanier obligatoire pour les exports véhicules vers le Sénégal',
    meta: 'Il y a 2 j · Lecture 3 min',
  },
  {
    tag: 'Europe',
    tone: 'navy',
    title: 'Convoyage : les nouveaux corridors verts entre la France et le Benelux',
    meta: 'Il y a 5 j · Lecture 4 min',
  },
  {
    tag: 'Afrique',
    tone: 'good',
    title: 'Port d\'Abidjan : délais de dédouanement réduits de 30 % depuis janvier',
    meta: 'Il y a 1 sem · Lecture 2 min',
  },
  {
    tag: 'Logistique',
    tone: 'default',
    title: 'Fret maritime : les taux Europe-Afrique de l\'Ouest se stabilisent',
    meta: 'Il y a 2 sem · Lecture 5 min',
  },
];

export function NewsScreen() {
  const { theme } = useTheme();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listNews();
      setArticles(r.data);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Actualités transport" subtitle="Europe · Afrique · réglementation" />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.navy} />
        }
      >
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <DotLoader size={8} />
          </View>
        ) : articles.length > 0 ? (
          articles.map((a) => (
            <Pressable key={a.id}>
              <Surface padded style={{ padding: 16 }}>
                {a.category ? <Pill tone="gold">{a.category.name}</Pill> : null}
                <Text
                  style={{
                    fontSize: 14.5,
                    color: theme.ink,
                    marginTop: a.category ? 10 : 0,
                    lineHeight: 14.5 * 1.3,
                    fontFamily: TYPO.weights.semibold,
                    letterSpacing: -0.1,
                  }}
                >
                  {a.title}
                </Text>
                {a.excerpt ? (
                  <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 6, lineHeight: 17, fontFamily: TYPO.weights.medium }}>
                    {a.excerpt}
                  </Text>
                ) : null}
                {a.publishedAt ? (
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6, fontFamily: TYPO.weights.medium }}>
                    {new Date(a.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </Text>
                ) : null}
              </Surface>
            </Pressable>
          ))
        ) : (
          DEMO_ARTICLES.map((a, i) => (
            <Pressable key={i}>
              <Surface padded style={{ padding: 16 }}>
                <Pill tone={a.tone}>{a.tag}</Pill>
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
                  {a.title}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6, fontFamily: TYPO.weights.medium }}>
                  {a.meta}
                </Text>
              </Surface>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
