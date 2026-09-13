import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AXIS_DARK, AXIS_LIGHT, AxisTheme } from './tokens';

type Mode = 'light' | 'dark' | 'auto';

interface ThemeContextValue {
  theme: AxisTheme;
  mode: Mode;
  setMode: (mode: Mode) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<Mode>('auto');

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === 'dark' || (mode === 'auto' && system === 'dark');
    return {
      theme: isDark ? AXIS_DARK : AXIS_LIGHT,
      mode,
      setMode,
      isDark,
    };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
