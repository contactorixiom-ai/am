import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

export type ToastKind = 'driver' | 'doc' | 'pay' | 'security' | 'info';

interface ToastInput {
  kind?: ToastKind;
  title: string;
  body?: string;
  durationMs?: number;
  onPress?: () => void;
}

interface ToastApi {
  push: (t: ToastInput) => void;
}

const ToastCtx = createContext<ToastApi>({ push: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastCtx);
}

interface Toast extends Required<Omit<ToastInput, 'onPress' | 'body'>> {
  id: number;
  body: string;
  onPress?: () => void;
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const slide = useRef(new Animated.Value(-200)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.timing(slide, { toValue: -200, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setToast(null);
    });
  }, [slide]);

  const push = useCallback((input: ToastInput) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t: Toast = {
      id: ++counter,
      kind: input.kind ?? 'info',
      title: input.title,
      body: input.body ?? '',
      durationMs: input.durationMs ?? 4500,
      onPress: input.onPress,
    };
    setToast(t);
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    timerRef.current = setTimeout(() => dismiss(), t.durationMs);
  }, [dismiss, slide]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {toast ? <ToastBanner toast={toast} slide={slide} onDismiss={dismiss} /> : null}
    </ToastCtx.Provider>
  );
}

function ToastBanner({ toast, slide, onDismiss }: { toast: Toast; slide: Animated.Value; onDismiss: () => void }) {
  const { theme } = useTheme();
  const meta = META[toast.kind];
  const handlePress = () => {
    onDismiss();
    setTimeout(() => toast.onPress?.(), 220);
  };
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 18,
        left: 12,
        right: 12,
        transform: [{ translateY: slide }],
      }}
    >
      <Pressable
        onPress={toast.onPress ? handlePress : onDismiss}
        style={({ pressed }) => ({
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: RADII.lg,
          backgroundColor: theme.navy,
          borderWidth: 1,
          borderColor: theme.gold + '40',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOpacity: 0.32,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          opacity: pressed ? 0.94 : 1,
        })}
      >
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }}>
          <meta.Icon size={18} color={meta.fg} stroke={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: '#F5F1E8', fontFamily: TYPO.weights.bold, letterSpacing: -0.1 }}>
            {toast.title}
          </Text>
          {toast.body ? (
            <Text style={{ fontSize: 11.5, color: 'rgba(245,241,232,0.7)', fontFamily: TYPO.weights.medium, marginTop: 1 }} numberOfLines={2}>
              {toast.body}
            </Text>
          ) : null}
        </View>
        {toast.onPress ? <Icons.chev size={16} color="rgba(245,241,232,0.7)" stroke={2} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const META: Record<ToastKind, { Icon: typeof Icons.bell; bg: string; fg: string }> = (() => {
  const navy = '#0B2545';
  const gold = '#C9A55C';
  return {
    driver:   { Icon: Icons.car,    bg: gold + '22', fg: '#F2D789' },
    doc:      { Icon: Icons.sig,    bg: gold + '22', fg: '#F2D789' },
    pay:      { Icon: Icons.euro,   bg: 'rgba(108,209,143,0.18)', fg: '#9CE5B6' },
    security: { Icon: Icons.shield, bg: 'rgba(255,180,90,0.18)', fg: '#FFD09C' },
    info:     { Icon: Icons.bell,   bg: 'rgba(245,241,232,0.12)', fg: '#F5F1E8' },
  };
})();
