// Grille qui s'adapte à la largeur : une colonne sur téléphone, deux ou
// trois sur tablette et ordinateur. Les cartes gardent une largeur de carte
// au lieu de s'étirer sur tout l'écran.
import React, { useState } from 'react';
import { View, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Largeur minimale d'une carte : le nombre de colonnes en découle. */
  minItemWidth?: number;
  /** Nombre maximal de colonnes. */
  maxColumns?: number;
  gap?: number;
  style?: ViewStyle;
}

export function Grid({ children, minItemWidth = 340, maxColumns = 3, gap = 12, style }: Props) {
  const [width, setWidth] = useState(0);
  const items = React.Children.toArray(children).filter(Boolean);
  const columns = width ? Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minItemWidth + gap)))) : 1;
  if (columns === 1) {
    return (
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[{ gap }, style]}>
        {items}
      </View>
    );
  }
  const itemWidth = (width - gap * (columns - 1)) / columns;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' }, style]}
    >
      {items.map((child, i) => (
        <View key={(child as React.ReactElement).key ?? i} style={{ width: itemWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}
