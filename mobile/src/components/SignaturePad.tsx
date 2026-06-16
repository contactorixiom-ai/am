import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { RADII } from '../theme/tokens';

interface Props {
  height?: number;
  onChange?: (hasContent: boolean) => void;
}

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** Renvoie la signature sous forme de data URL SVG (image vectorielle). */
  toDataUrl: () => string | null;
}

// Pad de signature tactile, multiplateforme (web + natif) via PanResponder
// et react-native-svg. Capture les traits sous forme de chemins SVG.
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 220, onChange },
  ref,
) {
  const { theme } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [size, setSize] = useState({ w: 0, h: height });
  const pathsRef = useRef<string[]>([]);
  pathsRef.current = current ? [...paths, current] : paths;

  useImperativeHandle(ref, () => ({
    clear: () => {
      setPaths([]);
      setCurrent('');
      onChange?.(false);
    },
    isEmpty: () => pathsRef.current.length === 0,
    toDataUrl: () => {
      const all = pathsRef.current;
      if (all.length === 0) return null;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}" viewBox="0 0 ${size.w} ${size.h}">` +
        all
          .map(
            (d) =>
              `<path d="${d}" fill="none" stroke="#0B2545" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
          )
          .join('') +
        `</svg>`;
      // encodeURIComponent pour rester ASCII-safe dans une data URL
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    },
  }));

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrent(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
        onChange?.(true);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrent((prev) => `${prev} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setCurrent((cur) => {
          if (cur) setPaths((prev) => [...prev, cur]);
          return '';
        });
      },
    }),
  ).current;

  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...responder.panHandlers}
      style={{
        height,
        borderRadius: RADII.lg,
        borderWidth: 1.5,
        borderColor: theme.line,
        borderStyle: 'dashed',
        backgroundColor: theme.surface,
        overflow: 'hidden',
      }}
    >
      <Svg width="100%" height="100%">
        {paths.map((d, i) => (
          <Path key={i} d={d} stroke={theme.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {current ? (
          <Path d={current} stroke={theme.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
      </Svg>
    </View>
  );
});
