import React, { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, Text, View } from 'react-native';
import { fetchProtectedImage } from '../api/client';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

interface Props {
  url?: string | null;
  style?: StyleProp<ImageStyle>;
  /** Légende affichée sous l'image, et en cas d'échec. */
  label?: string;
  /** Afficher l'image entière (agrandissement) plutôt que recadrée. */
  contain?: boolean;
}

/**
 * Image servie derrière authentification. Les photos d'état des lieux et les
 * pièces KYC ne sont plus accessibles publiquement : une balise image ne
 * pouvant pas porter de jeton, on récupère le fichier puis on l'affiche.
 */
export function AuthImage({ url, style, label, contain }: Props) {
  const { theme } = useTheme();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    if (!url) { setFailed(true); return; }
    fetchProtectedImage(url).then((d) => {
      if (cancelled) return;
      if (d) setSrc(d);
      else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (src) return <Image source={{ uri: src }} style={style} resizeMode={contain ? 'contain' : 'cover'} />;

  return (
    <View
      style={[
        { backgroundColor: theme.bgSoft, borderRadius: RADII.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.line },
        style as StyleProp<ImageStyle>,
      ]}
    >
      <Text style={{ fontSize: 10, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center', paddingHorizontal: 4 }}>
        {failed ? 'Photo indisponible' : (label ?? '…')}
      </Text>
    </View>
  );
}
