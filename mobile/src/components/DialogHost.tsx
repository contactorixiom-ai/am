// Fenêtres de message et de confirmation de l'application sur le web, à la
// place de window.alert / window.confirm (que le navigateur peut bloquer).
// Les demandes s'affichent l'une après l'autre.
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { DialogButton, DialogRequest, setDialogListener } from '../utils/notify';

export function DialogHost() {
  const { theme } = useTheme();
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    setDialogListener((req) => setQueue((q) => [...q, req]));
    return () => setDialogListener(null);
  }, []);

  const current = queue[0];
  const press = (b: DialogButton) => {
    setQueue((q) => q.slice(1));
    // Après la fermeture : l'action peut ouvrir une autre fenêtre.
    setTimeout(() => b.onPress?.(), 0);
  };
  const cancel = () => {
    const c = current?.buttons.find((b) => b.kind === 'cancel') ?? (current?.buttons.length === 1 ? current.buttons[0] : undefined);
    if (c) press(c);
  };

  if (!current) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={cancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View
          accessibilityRole="alert"
          style={{ width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: theme.surface, borderRadius: RADII.lg, padding: 20, gap: 12 }}
        >
          <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold }}>{current.title}</Text>
          {current.message ? (
            <ScrollView style={{ flexGrow: 0 }}>
              <Text style={{ fontSize: 14, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 20 }} selectable>
                {current.message}
              </Text>
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            {current.buttons.map((b) => {
              const bg = b.kind === 'danger' ? theme.bad : b.kind === 'cancel' ? theme.bgSoft : theme.navy;
              const fg = b.kind === 'cancel' ? theme.ink : '#FFFFFF';
              return (
                <Pressable
                  key={b.label}
                  onPress={() => press(b)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 46,
                    borderRadius: RADII.md,
                    backgroundColor: bg,
                    opacity: pressed ? 0.85 : 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 10,
                  })}
                >
                  <Text style={{ color: fg, fontSize: 14.5, fontFamily: TYPO.weights.bold, textAlign: 'center' }}>{b.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
