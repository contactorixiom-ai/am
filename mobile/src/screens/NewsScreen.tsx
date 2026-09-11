import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { listNews, NewsArticle } from '../api/news';
import { AppBar } from '../components/AppBar';
import { DotLoader } from '../components/DotLoader';
import { Pill, PillTone } from '../components/Pill';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

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
        ) : (() => {
          const featured = articles.length > 0
            ? { title: articles[0].title, date: articles[0].publishedAt ? new Date(articles[0].publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Il y a 2 j', read: '3 min' }
            : { title: DEMO_ARTICLES[0].title, date: 'Il y a 2 j', read: '3 min' };
          return (
            <Pressable>
              <View style={{ borderRadius: RADII.xl, overflow: 'hidden', backgroundColor: theme.navy }}>
                <View style={{ height: 130, position: 'relative', overflow: 'hidden' }}>
                  <Svg width="100%" height="100%" viewBox="0 0 360 130" preserveAspectRatio="xMidYMid slice">
                    <Defs>
                      <LinearGradient id="ng" x1="0" x2="1" y1="0" y2="1">
                        <Stop offset="0" stopColor={theme.gold} stopOpacity={0.45} />
                        <Stop offset="1" stopColor={theme.navyDeep} stopOpacity={1} />
                      </LinearGradient>
                    </Defs>
                    <Rect width={360} height={130} fill="url(#ng)" />
                    <Path d="M-20 90 Q 90 50 180 80 T 380 70" stroke={theme.goldHi} strokeWidth={1.5} fill="none" opacity={0.6} />
                    <Path d="M-20 110 Q 90 70 180 100 T 380 90" stroke={theme.goldHi} strokeWidth={1.5} fill="none" opacity={0.4} />
                    <Circle cx={60} cy={40} r={4} fill={theme.goldHi} />
                    <Circle cx={280} cy={50} r={4} fill={theme.goldHi} />
                  </Svg>
                  <View style={{ position: 'absolute', top: 14, left: 14 }}>
                    <Pill tone="gold">À LA UNE</Pill>
                  </View>
                </View>
                <View style={{ padding: 16 }}>
                  <Text style={{ fontFamily: TYPO.weights.bold, fontSize: 21, color: '#F5F1E8', lineHeight: 24, letterSpacing: -0.2 }}>
                    {featured.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.6)', marginTop: 8, fontFamily: TYPO.weights.medium }}>
                    {featured.date} · Lecture {featured.read}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })()}

        {!loading && articles.length > 1 ? (
          articles.slice(1).map((a) => (
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
        ) : !loading && articles.length === 0 ? (
          DEMO_ARTICLES.slice(1).map((a, i) => (
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
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
