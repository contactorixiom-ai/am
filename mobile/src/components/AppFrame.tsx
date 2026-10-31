// Cadre de l'application. Sur téléphone, il ne change rien. Sur ordinateur,
// le contenu est centré dans une largeur de page (1120 px) sur le même fond
// que l'application : les écrans gardent leurs proportions et les listes
// passent en grille (cf. Grid) au lieu de s'étirer.
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { APP_MAX_WIDTH, useLayout } from '../theme/layout';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { wide } = useLayout();
  if (!wide) return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: theme.bg }}>
      <View style={{ flex: 1, width: '100%', maxWidth: APP_MAX_WIDTH, overflow: 'hidden', backgroundColor: theme.bg }}>
        {children}
      </View>
    </View>
  );
}
