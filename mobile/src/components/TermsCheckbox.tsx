import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '../config/company';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { Icons } from './Icons';

/** « J'accepte les CGU et j'ai lu la politique de confidentialité ». */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  const link = { color: theme.navy, textDecorationLine: 'underline' as const };
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
    >
      <View
        style={{
          width: 22, height: 22, borderRadius: 6, marginTop: 1,
          borderWidth: 1.5, borderColor: checked ? theme.navy : theme.line,
          backgroundColor: checked ? theme.navy : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {checked ? <Icons.check size={14} color={theme.bg} stroke={2.4} /> : null}
      </View>
      <Text style={{ flex: 1, color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 13, lineHeight: 19 }}>
        J'accepte les{' '}
        <Text style={link} onPress={() => Linking.openURL(LEGAL_TERMS_URL)}>conditions générales</Text>
        {' '}et j'ai lu la{' '}
        <Text style={link} onPress={() => Linking.openURL(LEGAL_PRIVACY_URL)}>politique de confidentialité</Text>.
      </Text>
    </Pressable>
  );
}
