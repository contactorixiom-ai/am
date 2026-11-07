// Bouton principal de l'accueil, dynamique : une carte par grand service,
// qui défile toute seule (toutes les 5 s) et au doigt / à la souris. Chaque
// carte ouvre directement le bon formulaire ; les points en bas permettent
// de passer d'une carte à l'autre.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { Icons } from './Icons';

export interface HeroSlide {
  key: string;
  eyebrow: string;
  title: string;
  sub: string;
  icon: keyof typeof Icons;
  cta: string;
  onPress: () => void;
}

const AUTO_MS = 5000;
const HEIGHT = 156;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { theme, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollView>(null);
  const pausedUntil = useRef(0);

  const goTo = useCallback((i: number, animated = true) => {
    if (!width) return;
    const n = (i + slides.length) % slides.length;
    ref.current?.scrollTo({ x: n * width, animated });
    setIndex(n);
  }, [width, slides.length]);

  // Défilement automatique, suspendu 10 s après une action de la personne.
  useEffect(() => {
    if (!width || slides.length < 2) return;
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setIndex((cur) => {
        const n = (cur + 1) % slides.length;
        ref.current?.scrollTo({ x: n * width, animated: true });
        return n;
      });
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [width, slides.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < slides.length) setIndex(i);
  };

  const touch = () => { pausedUntil.current = Date.now() + 10000; };

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{
        borderRadius: RADII.xxl,
        overflow: 'hidden',
        backgroundColor: theme.navy,
        borderWidth: 1,
        borderColor: isDark ? theme.gold + '59' : theme.navy,
      }}
    >
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onScrollBeginDrag={touch}
        onTouchStart={touch}
        // Web : accroche carte par carte, comme sur téléphone.
        style={Platform.OS === 'web' ? ({ scrollSnapType: 'x mandatory' } as object) : undefined}
      >
        {slides.map((s) => {
          const Ic = Icons[s.icon];
          return (
            <Pressable
              key={s.key}
              onPress={() => { touch(); s.onPress(); }}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}. ${s.sub}`}
              style={({ pressed }) => ({
                width: width || 320,
                height: HEIGHT,
                padding: 18,
                paddingBottom: 30,
                justifyContent: 'space-between',
                backgroundColor: pressed ? theme.navyDeep : 'transparent',
                ...(Platform.OS === 'web' ? ({ scrollSnapAlign: 'start' } as object) : {}),
              })}
            >
              {/* Grand pictogramme doré en filigrane. */}
              <View pointerEvents="none" style={{ position: 'absolute', right: -14, top: -10, opacity: 0.14 }}>
                <Ic size={130} color={theme.gold} stroke={1.3} />
              </View>
              <View style={{ gap: 6, paddingRight: 60 }}>
                <Text style={{ fontSize: 11.5, color: theme.gold, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                  {s.eyebrow}
                </Text>
                <Text style={{ fontSize: 23, lineHeight: 26, color: '#F5F1E8', fontFamily: TYPO.weights.bold, letterSpacing: -0.3 }} numberOfLines={2}>
                  {s.title}
                </Text>
                <Text style={{ fontSize: 12.5, color: 'rgba(245,241,232,0.68)', fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {s.sub}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13, color: theme.goldHi, fontFamily: TYPO.weights.semibold }}>{s.cta}</Text>
                <Icons.arrow size={15} color={theme.goldHi} stroke={2.2} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Points : la carte affichée, et passer à une autre. */}
      {slides.length > 1 ? (
        <View style={{ position: 'absolute', bottom: 12, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {slides.map((s, i) => (
            <Pressable
              key={s.key}
              onPress={() => { touch(); goTo(i); }}
              accessibilityLabel={`Afficher : ${s.title}`}
              hitSlop={8}
              style={{
                width: i === index ? 20 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === index ? theme.gold : 'rgba(245,241,232,0.35)',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
