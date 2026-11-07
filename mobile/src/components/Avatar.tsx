import React, { useEffect, useState } from 'react';
import { Image, Text, View, ViewStyle } from 'react-native';
import { fetchProtectedImage } from '../api/client';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface AvatarProps {
  name: string;
  /** Photo de profil (fichier du stockage Axis, servi sur connexion). */
  url?: string | null;
  size?: number;
  tone?: 'navy' | 'gold';
  style?: ViewStyle;
}

// Les photos sont servies derrière authentification : chaque URL n'est
// téléchargée qu'une fois, puis gardée en mémoire (listes de personnes).
const cache = new Map<string, Promise<string | null>>();
function loadAvatar(url: string): Promise<string | null> {
  let p = cache.get(url);
  if (!p) {
    p = fetchProtectedImage(url).catch(() => null);
    cache.set(url, p);
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

export function Avatar({ name, url, size = 36, tone = 'navy', style }: AvatarProps) {
  const { theme } = useTheme();
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0] ?? '').join('').toUpperCase();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    if (url) void loadAvatar(url).then((d) => { if (alive) setSrc(d); });
    return () => { alive = false; };
  }, [url]);

  const bg = tone === 'gold' ? theme.gold + '2E' : theme.accent;
  const fg = tone === 'gold' ? theme.goldDeep : '#F5F1E8';

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
      accessibilityLabel={name}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text
          style={{
            color: fg,
            fontFamily: TYPO.weights.semibold,
            fontSize: size * 0.36,
            letterSpacing: 0.4,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
