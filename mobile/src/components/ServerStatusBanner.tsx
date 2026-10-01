import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { API_BASE_URL, checkHealth, HealthResult } from '../api/client';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

// Bannière de diagnostic : interroge le serveur au montage.
//
// En production elle ne s'affiche que si le serveur est injoignable — c'est
// la seule information utile à quelqu'un qui essaie de se connecter. Elle
// annonçait auparavant « Serveur connecté » sur les écrans de connexion et
// d'inscription, les deux premiers écrans que voit un nouvel utilisateur.
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

  // Rien à dire tant que tout va bien : on ne montre que la panne.
  if (!__DEV__ && (checking || result?.ok !== false)) return null;

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

// Affichage de diagnostic de l'adresse du serveur. Réservé au développement :
// il figurait sur les écrans de connexion et d'inscription, où un client
// découvrait l'URL technique du serveur en créant son compte.
export function ApiUrlHint() {
  const { theme } = useTheme();
  if (!__DEV__) return null;
  return (
    <Text style={{ fontSize: 10, color: theme.faint, fontFamily: TYPO.weights.regular, textAlign: 'center' }}>
      API : {API_BASE_URL}
    </Text>
  );
}
