// Cadre de l'application : sur téléphone comme sur ordinateur, il laisse
// l'application occuper tout l'écran. La mise en page large (menu latéral,
// largeur de contenu) est faite dans RootNavigator ; les grilles (Grid)
// répartissent les cartes.
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.bg }}>{children}</View>;
}
