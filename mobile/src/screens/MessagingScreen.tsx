import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Avatar } from '../components/Avatar';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

interface Msg {
  id: string;
  who: 'me' | 'driver' | 'system';
  text: string;
  time: string;
  seen?: boolean;
}

const INITIAL: Msg[] = [
  { id: 's1', who: 'system', text: 'Karim a démarré le trajet · Paris 15ᵉ → Bruxelles', time: '13:32' },
  { id: 'd1', who: 'driver', text: 'Bonjour, je viens de récupérer le véhicule. État impeccable, état des lieux dans l\'app.', time: '13:42' },
  { id: 'm1', who: 'me', text: 'Parfait, merci ! Arrivée prévue vers 14h30 ?', time: '13:43', seen: true },
  { id: 'd2', who: 'driver', text: 'Oui, 14h32 normalement. Petit ralentissement au sud de Lille, je te tiens au courant.', time: '13:48' },
];

const QUICK_REPLIES = ['Merci 🙏', 'Tout va bien ?', 'Préviens 10 min avant', 'Photos arrivée svp'];

export function MessagingScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Messaging'>>();
  const driverName = route.params?.driverName ?? 'Karim Diallo';
  const subtitle = route.params?.subtitle ?? 'En route · AX-2847';

  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, []);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: `m${Date.now()}`, who: 'me', text: t, time: now, seen: false }]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    // Réponse simulée du chauffeur après 2 sec
    setTimeout(() => {
      const replies = [
        'OK, je note !',
        'Reçu, je te confirme dès que je suis sur place.',
        '👍 Pas de souci.',
      ];
      const r = replies[Math.floor(Math.random() * replies.length)];
      const now2 = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev.map((m) => m.who === 'me' ? { ...m, seen: true } : m),
        { id: `d${Date.now()}`, who: 'driver', text: r, time: now2 },
      ]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }, 1800);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title={driverName}
        subtitle={subtitle}
        leading={<Avatar name={driverName} size={36} tone="gold" />}
        trailing={
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: pressed ? theme.line : theme.bgSoft,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Icons.phone size={18} color={theme.ink} stroke={1.8} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 12, gap: 10 }}
        >
          <Text style={{ textAlign: 'center', fontSize: 11, color: theme.muted, paddingVertical: 4, fontFamily: TYPO.weights.medium }}>
            Aujourd'hui
          </Text>

          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}

          {/* Quick replies */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {QUICK_REPLIES.map((q) => (
              <Pressable key={q} onPress={() => send(q)}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
                  <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.medium }}>{q}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Composer */}
        <View style={{ padding: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, backgroundColor: pressed ? theme.line : theme.bgSoft, alignItems: 'center', justifyContent: 'center' })}>
            <Icons.plus size={18} color={theme.ink} stroke={2} />
          </Pressable>
          <View style={{ flex: 1, paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: theme.bgSoft, borderWidth: 1, borderColor: theme.line, justifyContent: 'center' }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Écrire un message…"
              placeholderTextColor={theme.muted}
              style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.regular, padding: 0 }}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
          </View>
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim()}
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: !input.trim() ? theme.line : pressed ? theme.goldDeep : theme.gold,
              alignItems: 'center', justifyContent: 'center',
              opacity: !input.trim() ? 0.6 : 1,
            })}
          >
            <Icons.arrow size={18} color={theme.navy} stroke={2.4} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const { theme } = useTheme();
  if (msg.who === 'system') {
    return (
      <View style={{ alignSelf: 'center', maxWidth: '88%' }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.surface2 }}>
          <Text style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium }} numberOfLines={2}>
            {msg.text}
          </Text>
        </View>
      </View>
    );
  }
  const mine = msg.who === 'me';
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: mine ? theme.navy : theme.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: theme.line,
          borderRadius: 14,
          borderBottomRightRadius: mine ? 4 : 14,
          borderBottomLeftRadius: mine ? 14 : 4,
        }}
      >
        <Text style={{ fontSize: 14, color: mine ? '#F5F1E8' : theme.ink, lineHeight: 19, fontFamily: TYPO.weights.regular }}>
          {msg.text}
        </Text>
      </View>
      <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 3, marginHorizontal: 8, textAlign: mine ? 'right' : 'left', fontFamily: TYPO.weights.medium }}>
        {msg.time}{mine ? (msg.seen ? ' · ✓✓' : ' · ✓') : ''}
      </Text>
    </View>
  );
}
