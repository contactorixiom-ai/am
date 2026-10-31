// Cadre de l'application. Sur téléphone, il ne change rien. Sur ordinateur
// (web, écran large), l'application s'affiche dans une colonne centrée de la
// largeur d'un grand téléphone, sur le fond de la marque : les cartes ne
// s'étirent plus sur tout l'écran.
import React from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { APP_MAX_WIDTH } from '../theme/tokens';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width > APP_MAX_WIDTH + 40;
  if (!wide) return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: theme.name === 'dark' ? '#030E1C' : theme.bgSoft }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: APP_MAX_WIDTH,
          overflow: 'hidden',
          backgroundColor: theme.bg,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: theme.line,
          shadowColor: '#000',
          shadowOpacity: theme.name === 'dark' ? 0.5 : 0.12,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {children}
      </View>
    </View>
  );
}
