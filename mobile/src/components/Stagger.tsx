import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay: 60 + index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Fait apparaître les blocs d'un écran l'un après l'autre (fondu + légère
 * montée). Chaque enfant non vide est enveloppé ; l'espacement du parent
 * (gap) s'applique toujours.
 */
export function Stagger({ children }: { children: React.ReactNode }) {
  let i = 0;
  return (
    <>
      {React.Children.map(children, (child) => {
        if (child === null || child === undefined || child === false) return null;
        const idx = i++;
        return <Reveal index={Math.min(idx, 8)}>{child}</Reveal>;
      })}
    </>
  );
}
