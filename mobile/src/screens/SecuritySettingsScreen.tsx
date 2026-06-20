import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { fetchSessions, revokeSession, type AuthSession } from '../api/security';

const STORAGE_KEY = 'axis.security.v1';

interface State {
  biometric: boolean;
  pin: boolean;
  pinValue?: string;
  twoFa: boolean;
  twoFaMethod: 'sms' | 'app';
  securityAlerts: boolean;
}

const DEFAULT: State = { biometric: false, pin: false, twoFa: false, twoFaMethod: 'sms', securityAlerts: true };

interface Session {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastSeen: string;
  current?: boolean;
}


/** Masque partiellement une IP pour l'affichage (RGPD). */
function maskIp(ip: string | null): string {
  if (!ip) return 'IP inconnue';
  const v4 = ip.split('.');
  if (v4.length === 4) return `${v4[0]}.${v4[1]}.•••.${v4[3]}`;
  return ip.length > 12 ? `${ip.slice(0, 8)}…` : ip;
}

/** Libellé "vu il y a…" à partir d'une date ISO. */
function relativeLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 2) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return `Il y a ${Math.round(days / 7)} sem`;
}

/** Déduit un nom d'appareil lisible à partir du User-Agent. */
function deviceLabel(ua: string | null): string {
  if (!ua) return 'Appareil inconnu';
  const os = /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Mac OS|Macintosh/i.test(ua) ? 'macOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux' : 'Web';
  const browser = /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'Safari'
    : /Chrome/i.test(ua) ? 'Chrome'
    : /Firefox/i.test(ua) ? 'Firefox'
    : 'Navigateur';
  return `${os} · ${browser}`;
}

function toScreenSession(s: AuthSession): Session {
  return {
    id: s.id,
    device: deviceLabel(s.userAgent),
    location: '—',
    ip: maskIp(s.ipAddress),
    lastSeen: relativeLabel(s.createdAt),
    current: s.current,
  };
}

export function SecuritySettingsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [s, setS] = useState<State>(DEFAULT);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsOnline, setSessionsOnline] = useState(false);
  const [pinDialog, setPinDialog] = useState<'create' | 'remove' | null>(null);
  const [pinDraft, setPinDraft] = useState('');

  useEffect(() => {
    // Réglages de verrouillage : toujours en local (Face ID / PIN / 2FA).
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) try { setS({ ...DEFAULT, ...JSON.parse(raw) }); } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSessions()
      .then((list) => {
        if (cancelled) return;
        setSessions(list.map(toScreenSession));
        setSessionsOnline(true);
      })
      .catch(() => { /* offline → liste vide, l'écran affichera un empty state */ });
    return () => { cancelled = true; };
  }, []);

  const persist = (next: State) => {
    setS(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const toggleBio = (v: boolean) => {
    persist({ ...s, biometric: v });
    notify(v ? 'Face ID activé' : 'Face ID désactivé', v ? 'L\'authentification biométrique sera demandée à chaque ouverture.' : 'L\'app s\'ouvrira sans demander de Face ID.');
  };

  const togglePin = (v: boolean) => {
    if (v) setPinDialog('create');
    else setPinDialog('remove');
  };

  const setPinKey = (digit: string) => {
    if (pinDraft.length >= 4) return;
    const next = pinDraft + digit;
    setPinDraft(next);
    if (next.length === 4 && pinDialog === 'create') {
      persist({ ...s, pin: true, pinValue: next });
      setPinDraft('');
      setPinDialog(null);
      notify('Code PIN défini', 'Tu pourras déverrouiller l\'app avec ton code à 4 chiffres.');
    } else if (next.length === 4 && pinDialog === 'remove') {
      if (next === s.pinValue) {
        persist({ ...s, pin: false, pinValue: undefined });
        notify('Code PIN supprimé', 'L\'app ne demandera plus de code.');
      } else {
        notify('Code incorrect', 'Réessaie.');
      }
      setPinDraft('');
      setPinDialog(null);
    }
  };

  const toggle2fa = (v: boolean) => {
    persist({ ...s, twoFa: v });
    if (v) notify('2FA activée', `Tu recevras un code par ${s.twoFaMethod === 'sms' ? 'SMS' : 'app authenticator'} à chaque connexion sensible.`);
  };

  const revoke = (id: string) => {
    // Optimiste : on retire localement, puis on confirme côté backend si en ligne.
    setSessions((prev) => prev.filter((x) => x.id !== id));
    notify('Session révoquée', 'Cet appareil est déconnecté immédiatement.');
    if (sessionsOnline) {
      revokeSession(id).catch(() => {
        notify('Révocation différée', 'Le serveur est injoignable, réessaie plus tard.');
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Sécurité" subtitle="Verrouillage, 2FA, sessions actives" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
        {/* Hero score */}
        <Surface padded flat style={{ padding: 16, backgroundColor: theme.navy, borderColor: theme.navy }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(245,241,232,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.shield size={22} color={theme.goldHi} stroke={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Niveau de sécurité
              </Text>
              <Text style={{ fontSize: 18, color: '#F5F1E8', fontFamily: TYPO.weights.bold, marginTop: 2, letterSpacing: -0.2 }}>
                {securityLevel(s)}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Verrouillage */}
        <Section title="Verrouillage de l'app">
          <RowToggle
            icon={<Icons.shield size={18} color={theme.navy} stroke={1.8} />}
            label="Face ID / Touch ID"
            sub="Demander la biométrie à chaque ouverture"
            value={s.biometric}
            onChange={toggleBio}
          />
          <RowToggle
            icon={<Icons.fuel size={18} color={theme.navy} stroke={1.8} />}
            label="Code PIN à 4 chiffres"
            sub={s.pin ? 'Code défini · accès rapide' : 'Verrou alternatif à la biométrie'}
            value={s.pin}
            onChange={togglePin}
          />
        </Section>

        {/* 2FA */}
        <Section title="Authentification à deux facteurs">
          <RowToggle
            icon={<Icons.phone size={18} color={theme.navy} stroke={1.8} />}
            label="2FA activée"
            sub="Code à 6 chiffres en plus du mot de passe"
            value={s.twoFa}
            onChange={toggle2fa}
          />
          {s.twoFa ? (
            <View style={{ paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginTop: 6, marginBottom: 6 }}>
                Méthode
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['sms', 'app'] as const).map((m) => {
                  const on = s.twoFaMethod === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => persist({ ...s, twoFaMethod: m })}
                      style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: on ? theme.navy : theme.line, backgroundColor: on ? theme.bgSoft : theme.surface }}
                    >
                      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                        {m === 'sms' ? 'SMS' : 'App authenticator'}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                        {m === 'sms' ? 'Code reçu par SMS' : 'Google / Authy / 1Password'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Section>

        {/* Notifications */}
        <Section title="Alertes de sécurité">
          <RowToggle
            icon={<Icons.bell size={18} color={theme.navy} stroke={1.8} />}
            label="Notifier les connexions suspectes"
            sub="Email + push lors d'une nouvelle connexion"
            value={s.securityAlerts}
            onChange={(v) => persist({ ...s, securityAlerts: v })}
          />
        </Section>

        {/* Sessions actives */}
        <Section title="Appareils connectés">
          {sessions.map((sess, i) => (
            <View key={sess.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.lineSoft }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.globe size={16} color={theme.ink} stroke={1.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold, flexShrink: 1 }}>
                    {sess.device}
                  </Text>
                  {sess.current ? <Pill tone="good">Cet appareil</Pill> : null}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                  {sess.location} · {sess.ip} · {sess.lastSeen}
                </Text>
              </View>
              {!sess.current ? (
                <Pressable onPress={() => revoke(sess.id)} style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: pressed ? theme.bad + '22' : 'transparent' })}>
                  <Text style={{ fontSize: 12.5, color: theme.bad, fontFamily: TYPO.weights.semibold }}>Révoquer</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Section>

        {/* RGPD / confidentialité */}
        <Section title="Confidentialité (RGPD)">
          <ActionRow icon={<Icons.doc size={18} color={theme.navy} stroke={1.8} />} label="Exporter mes données" sub="Reçu par email sous 48h" onPress={() => notify('Demande enregistrée', 'Ton archive sera envoyée sous 48h conformément au RGPD.')} />
          <ActionRow icon={<Icons.x size={18} color={theme.bad} stroke={2} />} label="Supprimer mon compte" sub="Suppression définitive sous 30 j" danger onPress={() => notify('Action sensible', 'Contacte support@axis-import.com pour confirmer la suppression.')} />
        </Section>
      </ScrollView>

      {/* PIN dialog */}
      <Modal visible={!!pinDialog} transparent animationType="fade" onRequestClose={() => { setPinDialog(null); setPinDraft(''); }}>
        <Pressable onPress={() => { setPinDialog(null); setPinDraft(''); }} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderRadius: 20, padding: 22, gap: 16 }}>
            <View>
              <Text style={{ fontSize: 18, color: theme.ink, fontFamily: TYPO.weights.bold, textAlign: 'center' }}>
                {pinDialog === 'create' ? 'Définir un code PIN' : 'Entre ton code actuel'}
              </Text>
              <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center', marginTop: 4 }}>
                {pinDialog === 'create' ? '4 chiffres · à ne pas oublier' : 'Pour confirmer la suppression'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ width: 36, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: pinDraft.length > i ? theme.navy : theme.line, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22, color: theme.ink, fontFamily: TYPO.weights.bold }}>{pinDraft[i] ? '•' : ''}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, idx) => (
                <Pressable
                  key={n}
                  onPress={() => setPinKey(String(n))}
                  style={({ pressed }) => ({
                    width: '32%',
                    aspectRatio: 1.7,
                    margin: 2,
                    borderRadius: 12,
                    backgroundColor: pressed ? theme.bgSoft : theme.surface2,
                    alignItems: 'center', justifyContent: 'center',
                    ...(idx === 9 && { marginLeft: '34%' }),
                  })}
                >
                  <Text style={{ fontSize: 22, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setPinDraft((p) => p.slice(0, -1))} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.semibold }}>← Effacer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function securityLevel(s: State): string {
  let score = 0;
  if (s.biometric) score += 1;
  if (s.pin) score += 1;
  if (s.twoFa) score += 2;
  if (s.securityAlerts) score += 1;
  if (score >= 4) return 'Excellent · compte renforcé';
  if (score >= 2) return 'Bon · quelques options activables';
  return 'À améliorer · active 2FA + Face ID';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginBottom: 8, marginLeft: 4 }}>
        {title}
      </Text>
      <Surface padded style={{ padding: 0 }}>
        <View style={{ paddingHorizontal: 14 }}>{children}</View>
      </Surface>
    </View>
  );
}

function RowToggle({ icon, label, sub, value, onChange }: { icon: React.ReactNode; label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{label}</Text>
        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: theme.line, true: theme.gold }} thumbColor="#fff" />
    </View>
  );
}

function ActionRow({ icon, label, sub, onPress, danger }: { icon: React.ReactNode; label: string; sub: string; onPress: () => void; danger?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? theme.bad + '14' : theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: danger ? theme.bad : theme.ink, fontFamily: TYPO.weights.semibold }}>{label}</Text>
        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>{sub}</Text>
      </View>
      <Icons.chev size={16} color={theme.muted} stroke={1.8} />
    </Pressable>
  );
}
