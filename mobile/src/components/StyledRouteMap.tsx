import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

interface Props {
  height?: number;
  progress?: number;
  from?: string;
  to?: string;
}

// Carte stylisée Europe → Afrique fidèle à la maquette (pas de tuiles réelles).
export function StyledRouteMap({ height = 220, progress = 0.4, from = 'Paris', to = 'Dakar' }: Props) {
  const { theme } = useTheme();
  const isDark = theme.name === 'dark';
  const bg = isDark ? theme.navyDeep : '#E8E0CD';
  const land = isDark ? '#0F2B4D' : '#FAF5E6';
  const sea = isDark ? '#06182E' : '#E0D7BD';

  return (
    <View
      style={{
        position: 'relative',
        height,
        borderRadius: RADII.xl,
        overflow: 'hidden',
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice">
        <Rect x={0} y={0} width={360} height={180} fill={sea} />
        {/* Stylized Europe + Africa silhouettes */}
        <Path
          d="M40 40 Q 60 20 100 30 T 200 35 Q 240 30 270 50 L 250 70 Q 220 60 180 70 L 140 60 Q 100 70 80 60 Q 50 60 40 40 Z"
          fill={land}
          opacity={0.95}
        />
        <Path
          d="M120 100 Q 150 85 200 95 Q 240 105 250 130 Q 240 165 200 175 Q 160 175 140 160 Q 110 140 120 100 Z"
          fill={land}
          opacity={0.95}
        />
        {/* Grid */}
        <G stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'} strokeWidth={1}>
          {[40, 80, 120, 160].map((y) => (
            <Line key={`h${y}`} x1={0} y1={y} x2={360} y2={y} />
          ))}
          {[60, 120, 180, 240, 300].map((x) => (
            <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={180} />
          ))}
        </G>
        {/* Route path Europe → Africa */}
        <Path d="M170 45 Q 130 80 130 130" stroke={theme.gold} strokeWidth={2.5} strokeDasharray="4 4" fill="none" />
        <Path d="M170 45 Q 150 65 142 90" stroke={theme.gold} strokeWidth={2.8} fill="none" strokeLinecap="round" />
        {/* Origin / destination */}
        <Circle cx={170} cy={45} r={6} fill={theme.gold} />
        <Circle cx={170} cy={45} r={11} fill="none" stroke={theme.gold} strokeOpacity={0.35} strokeWidth={2} />
        <Circle cx={130} cy={130} r={6} fill={theme.navy} />
        {/* Current position */}
        <Circle cx={170 - 40 * progress} cy={45 + 65 * progress} r={7} fill="#fff" stroke={theme.gold} strokeWidth={3} />
      </Svg>

      <View
        style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          right: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <View>
          <Text style={{ fontSize: 10, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: TYPO.weights.semibold }}>
            Départ
          </Text>
          <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>
            {from}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 10, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: TYPO.weights.semibold }}>
            Destination
          </Text>
          <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>
            {to}
          </Text>
        </View>
      </View>
    </View>
  );
}
