// Barre de tarif en direct, épinglée en bas du parcours d'envoi.
//
// Le client voyait son prix seulement à l'étape 4, après avoir rempli six
// écrans. Dès qu'il a choisi un trajet et un poids, cette barre affiche une
// estimation et la réactualise à chaque changement — il sait tout de suite
// combien ça coûte, et il va au bout.

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { CreateQuoteInput, estimateQuote, QuoteEstimate } from '../api/quotes';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

interface Props {
  /** Null tant que les données ne suffisent pas à estimer quoi que ce soit. */
  input: CreateQuoteInput | null;
  /** Texte affiché quand l'estimation n'est pas encore possible. */
  placeholder?: string;
}

const EUR = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function LivePriceBar({ input, placeholder = 'Le tarif s\'affiche dès le poids renseigné' }: Props) {
  const { theme } = useTheme();
  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // La signature évite de relancer un appel identique, et sert de garde de
  // concurrence : seule la réponse de la dernière saisie est retenue.
  const signature = input ? JSON.stringify(input) : null;
  const latestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!signature || !input) {
      setEstimate(null);
      setFailed(false);
      return;
    }
    latestRef.current = signature;
    setLoading(true);
    // Léger délai : on n'interroge pas le serveur à chaque frappe.
    const timer = setTimeout(() => {
      estimateQuote(input)
        .then((res) => {
          if (latestRef.current !== signature) return;
          setEstimate(res);
          setFailed(false);
        })
        .catch(() => {
          if (latestRef.current !== signature) return;
          setFailed(true);
        })
        .finally(() => {
          if (latestRef.current === signature) setLoading(false);
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = estimate !== null && !failed;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.line,
        backgroundColor: theme.surface,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 10.5,
            color: theme.muted,
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            fontFamily: TYPO.weights.semibold,
          }}
        >
          {ready ? 'Tarif estimé' : 'Tarif'}
        </Text>
        {ready ? (
          <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={1}>
            {estimate.transportMode === 'AIR' ? 'Aérien' : estimate.transportMode === 'SEA' ? 'Maritime' : 'Routier'}
            {estimate.uncertaintyPct ? ` · ±${estimate.uncertaintyPct} %` : ''} · TVA incluse
          </Text>
        ) : (
          <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={2}>
            {failed ? 'Estimation indisponible — le devis exact arrive à l\'étape suivante.' : placeholder}
          </Text>
        )}
      </View>

      <View
        style={{
          minWidth: 92,
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: RADII.md,
          backgroundColor: ready ? theme.gold + '1F' : theme.bgSoft,
        }}
      >
        {loading && !ready ? (
          <ActivityIndicator size="small" color={theme.gold} />
        ) : ready ? (
          <Text
            style={{
              fontSize: 22,
              color: theme.ink,
              fontFamily: TYPO.weights.bold,
              fontVariant: ['tabular-nums'],
              opacity: loading ? 0.45 : 1,
            }}
          >
            {EUR(estimate.totalCents)} €
          </Text>
        ) : (
          <Text style={{ fontSize: 18, color: theme.faint, fontFamily: TYPO.weights.bold }}>— €</Text>
        )}
      </View>
    </View>
  );
}
