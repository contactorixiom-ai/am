import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { RADII } from '../theme/tokens';

interface Props {
  height?: number;
  onChange?: (hasContent: boolean) => void;
  /** Début / fin d'un tracé : l'écran bloque son défilement pendant ce temps. */
  onDrawingChange?: (drawing: boolean) => void;
}

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** Renvoie la signature sous forme de data URL SVG (image vectorielle). */
  toDataUrl: () => string | null;
  /** Renvoie les tracés bruts + dimensions du pad (pour un rendu vectoriel PDF). */
  toPaths: () => { paths: string[]; w: number; h: number } | null;
}

// Pad de signature tactile (web + natif). Les traits sont des chemins SVG.
//
// Le doigt faisait défiler la page en même temps qu'il signait :
// - web : le navigateur gardait le geste pour le défilement → on écoute les
//   événements « pointer » directement sur l'élément, avec touch-action: none
//   et capture du pointeur, et on lit la position par rapport au cadre ;
// - natif : la ScrollView parente reprenait le geste → le pad refuse de le
//   céder et prévient l'écran (onDrawingChange) pour qu'il fige le défilement.
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 220, onChange, onDrawingChange },
  ref,
) {
  const { theme } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [size, setSize] = useState({ w: 0, h: height });
  const pathsRef = useRef<string[]>([]);
  pathsRef.current = current ? [...paths, current] : paths;
  const viewRef = useRef<View>(null);
  const cbRef = useRef({ onChange, onDrawingChange });
  cbRef.current = { onChange, onDrawingChange };

  const start = (x: number, y: number) => {
    setCurrent(`M${x.toFixed(1)},${y.toFixed(1)}`);
    cbRef.current.onChange?.(true);
    cbRef.current.onDrawingChange?.(true);
  };
  const move = (x: number, y: number) => setCurrent((prev) => (prev ? `${prev} L${x.toFixed(1)},${y.toFixed(1)}` : prev));
  const end = () => {
    setCurrent((cur) => {
      // Un simple toucher laisse un point visible.
      const d = cur && !cur.includes('L') ? `${cur} l0.1,0.1` : cur;
      if (d) setPaths((prev) => [...prev, d]);
      return '';
    });
    cbRef.current.onDrawingChange?.(false);
  };

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
    toPaths: () => {
      const all = pathsRef.current;
      if (all.length === 0) return null;
      return { paths: [...all], w: size.w, h: size.h };
    },
  }));

  // ─── Web : événements pointer natifs du navigateur ─────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const el = viewRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return undefined;
    el.style.touchAction = 'none';
    (el.style as unknown as Record<string, string>).webkitUserSelect = 'none';
    el.style.userSelect = 'none';
    let drawing = false;
    const pos = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      drawing = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* ancien navigateur */ }
      const p = pos(e);
      start(p.x, p.y);
    };
    const mv = (e: PointerEvent) => {
      if (!drawing) return;
      e.preventDefault();
      // Traits plus fluides : on récupère aussi les points intermédiaires.
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const p = pos(ev);
        move(p.x, p.y);
      }
    };
    const up = (e: PointerEvent) => {
      if (!drawing) return;
      drawing = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
      end();
    };
    // Safari iOS ancien : empêcher le défilement au toucher.
    const blockTouch = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('touchstart', blockTouch, { passive: false });
    el.addEventListener('touchmove', blockTouch, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('touchstart', blockTouch);
      el.removeEventListener('touchmove', blockTouch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Natif : PanResponder qui ne cède pas le geste ────────────────────
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => start(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => move(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: () => end(),
      onPanResponderTerminate: () => end(),
    }),
  ).current;

  return (
    <View
      ref={viewRef}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...(Platform.OS === 'web' ? {} : responder.panHandlers)}
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
      <Svg width="100%" height="100%" pointerEvents="none">
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
