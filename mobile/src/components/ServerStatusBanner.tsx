import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { API_BASE_URL, checkHealth, HealthResult } from '../api/client';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

// Bannière de diagnostic : ping le backend au montage et affiche l'état.
// Permet de distinguer "problème serveur/CORS" d'un "problème app".
export function ServerStatusBanner() {
  const { theme } = useTheme();
  const [result, setResult] = useState<HealthResult | null>(null);
  const [checking, setChecking] = useState(true);

  const run = useCallback(async () => {
    setChecking(true);
    const r = await checkHealth();
    setResult(r);
    setChecking(false);
  }, []);

  useEffect(() => { run(); }, [run]);

  const tone = checking
    ? { bg: theme.bgSoft, fg: theme.muted, dot: theme.muted }
    : result?.ok
      ? { bg: theme.good + '18', fg: theme.good, dot: theme.good }
      : { bg: theme.bad + '18', fg: theme.bad, dot: theme.bad };

  return (
    <Pressable onPress={run}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: RADII.md,
          backgroundColor: tone.bg,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone.dot }} />
        <Text style={{ flex: 1, fontSize: 12, color: tone.fg, fontFamily: TYPO.weights.medium }}>
          {checking ? 'Connexion au serveur…' : result?.message ?? '—'}
        </Text>
        <Text style={{ fontSize: 11, color: tone.fg, fontFamily: TYPO.weights.semibold }}>
          {checking ? '' : 'Réessayer'}
        </Text>
      </View>
    </Pressable>
  );
}

// Petit affichage debug de l'URL utilisée (utile pour vérifier la prod).
export function ApiUrlHint() {
  const { theme } = useTheme();
  return (
    <Text style={{ fontSize: 10, color: theme.faint, fontFamily: TYPO.weights.regular, textAlign: 'center' }}>
      API : {API_BASE_URL}
    </Text>
  );
}
