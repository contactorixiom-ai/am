import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icons } from '../components/Icons';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

const SEEN_KEY = 'axis.intro.seen.v1';

interface Slide {
  Icon: typeof Icons.shield;
  title: string;
  body: string;
  hex: string;
}

const SLIDES: Slide[] = [
  { Icon: Icons.pin,    title: 'Suivi temps réel',                 body: 'Visualise ton convoyage sur une carte interactive : position du chauffeur, étapes, ETA, pauses, tout est là.',           hex: '#0B2545' },
  { Icon: Icons.sig,    title: 'Signature électronique',           body: 'État des lieux et contrats signés au doigt, avec valeur juridique eIDAS et QR code de vérification d\'authenticité.', hex: '#1E3E63' },
  { Icon: Icons.shield, title: 'Sécurité bancaire et conformité',  body: 'Paiement Stripe + Apple Pay, données chiffrées AES-256, hébergement France certifié HDS, conforme RGPD.',              hex: '#0F3A60' },
];

export function IntroSlidesScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;

  const finish = async () => {
    await AsyncStorage.setItem(SEEN_KEY, '1');
    nav.replace('Onboarding');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    if (i !== index) setIndex(i);
    scrollX.setValue(x);
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    } else {
      finish();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
        <Pressable onPress={finish} style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: pressed ? theme.bgSoft : 'transparent' })}>
          <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Passer</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => <SlideView key={i} slide={s} width={width} />)}
      </ScrollView>

      {/* Indicateurs */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 }}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const widthAnim = scrollX.interpolate({ inputRange, outputRange: [8, 28, 8], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={{ width: widthAnim, height: 8, borderRadius: 4, backgroundColor: theme.gold, opacity }}
            />
          );
        })}
      </View>

      <View style={{ padding: 24, paddingBottom: 32, gap: 10 }}>
        <Pressable
          onPress={goNext}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: RADII.lg,
            backgroundColor: pressed ? theme.goldDeep : theme.gold,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          })}
        >
          <Text style={{ fontSize: 15, color: theme.navy, fontFamily: TYPO.weights.bold }}>
            {index < SLIDES.length - 1 ? 'Suivant' : 'Commencer'}
          </Text>
          <Icons.arrow size={18} color={theme.navy} stroke={2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SlideView({ slide, width }: { slide: Slide; width: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ width, paddingHorizontal: 28, paddingTop: 30, alignItems: 'center' }}>
      {/* Visuel : cercles concentriques + icône au centre */}
      <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={240} height={240} viewBox="0 0 240 240" style={{ position: 'absolute' }}>
          <Circle cx="120" cy="120" r="115" stroke={theme.gold} strokeWidth={1} fill="none" opacity={0.25} />
          <Circle cx="120" cy="120" r="88"  stroke={theme.gold} strokeWidth={1} fill="none" opacity={0.4} />
          <Circle cx="120" cy="120" r="60"  stroke={theme.gold} strokeWidth={1} fill="none" opacity={0.6} />
        </Svg>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: slide.hex, alignItems: 'center', justifyContent: 'center' }}>
          <slide.Icon size={48} color={theme.goldHi} stroke={1.6} />
        </View>
      </View>

      <Text style={{ fontFamily: TYPO.weights.bold, fontSize: 32, color: theme.ink, letterSpacing: -0.6, marginTop: 40, textAlign: 'center' }}>
        {slide.title}
      </Text>
      <Text style={{ fontSize: 15, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 22, marginTop: 14, textAlign: 'center', maxWidth: 340 }}>
        {slide.body}
      </Text>
    </View>
  );
}

export async function shouldShowIntroSlides(): Promise<boolean> {
  // En navigation privée Safari iOS, AsyncStorage (qui utilise localStorage)
  // peut throw QUOTA_EXCEEDED ou être inaccessible. On retombe alors sur
  // "intro déjà vue" pour ne pas bloquer l'app sur un écran blanc.
  try {
    const seen = await AsyncStorage.getItem(SEEN_KEY);
    return seen !== '1';
  } catch {
    return false;
  }
}
