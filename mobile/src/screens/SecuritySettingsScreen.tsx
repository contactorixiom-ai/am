import React, { useEffect, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, Share, Text, View } from 'react-native';
import { changePassword, deleteAccount, exportMyData } from '../api/auth';
import { ApiError } from '../api/client';
import { fetchSessions, revokeSession, type AuthSession } from '../api/security';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { Surface } from '../components/Surface';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { confirmAction, notify } from '../utils/notify';

// Cet écran ne montre que ce qui fonctionne réellement. Il proposait Face ID,
// un code PIN, une double authentification et des alertes de connexion :
// des interrupteurs enregistrés sur le téléphone et jamais appliqués.

interface Session {
  id: string;
  device: string;
  ip: string;
  lastSeen: string;
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
    ip: maskIp(s.ipAddress),
    lastSeen: relativeLabel(s.createdAt),
  };
}

export function SecuritySettingsScreen() {
  const { theme } = useTheme();
  const { logout } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);

  // Changement de mot de passe
  const [pwdOpen, setPwdOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  const loadSessions = () =>
    fetchSessions()
      .then((list) => setSessions(list.map(toScreenSession)))
      .catch(() => setSessions([]));

  useEffect(() => {
    void loadSessions();
  }, []);

  const savePassword = async () => {
    setPwdError(null);
    if (next.length < 8) return setPwdError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    if (next !== confirm) return setPwdError('Les deux nouveaux mots de passe ne correspondent pas.');
    setPwdSaving(true);
    try {
      await changePassword(current, next);
      setPwdOpen(false);
      setCurrent(''); setNext(''); setConfirm('');
      notify('Mot de passe changé', 'Tes autres appareils ont été déconnectés.');
      void loadSessions();
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : 'Changement impossible.');
    } finally {
      setPwdSaving(false);
    }
  };

  const revoke = (id: string) => {
    confirmAction('Déconnecter cet appareil ?', 'Il devra se reconnecter avec le mot de passe.', async () => {
      try {
        await revokeSession(id);
        setSessions((prev) => (prev ?? []).filter((x) => x.id !== id));
        notify('Appareil déconnecté', 'La session a été fermée.');
      } catch (e) {
        notify('Déconnexion impossible', e instanceof ApiError && e.isNetworkError ? 'Pas de connexion. Réessaie.' : 'Réessaie dans un instant.');
      }
    }, 'Déconnecter');
  };

  // Droit d'accès et de portabilité (RGPD) : un fichier réel, tout de suite.
  const exportData = async () => {
    setExporting(true);
    try {
      const data = await exportMyData();
      const json = JSON.stringify(data, null, 2);
      const name = `axis-import-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        notify('Export prêt', 'Le fichier de tes données a été téléchargé.');
      } else {
        await Share.share({ title: name, message: json });
      }
    } catch {
      notify('Export impossible', 'Réessaie dans un instant.');
    } finally {
      setExporting(false);
    }
  };

  // L'App Store impose que la suppression du compte se lance depuis
  // l'application (règle 5.1.1(v)).
  const removeAccount = () => {
    confirmAction(
      'Supprimer définitivement ton compte',
      "Ton accès et tes informations personnelles seront supprimés immédiatement. Les factures, contrats signés et états des lieux sont conservés : la loi nous y oblige. Cette action est irréversible.",
      async () => {
        setDeleting(true);
        try {
          await deleteAccount();
          notify('Compte supprimé', 'Ton compte a été supprimé. Tu peux en créer un nouveau à tout moment.');
          await logout();
        } catch {
          notify('Suppression impossible', 'Le serveur est injoignable. Réessaie dans un instant.');
        } finally {
          setDeleting(false);
        }
      },
      'Supprimer',
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Sécurité et données" subtitle="Mot de passe, appareils, données personnelles" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
        <Section title="Mot de passe">
          {pwdOpen ? (
            <View style={{ gap: 10, paddingVertical: 12 }}>
              <Field label="Mot de passe actuel" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
              <Field label="Nouveau mot de passe" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint="Au moins 8 caractères" />
              <Field label="Confirmer" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
              {pwdError ? <Text style={{ fontSize: 13, color: theme.bad, fontFamily: TYPO.weights.medium }}>{pwdError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button kind="ghost" style={{ flex: 1 }} onPress={() => { setPwdOpen(false); setPwdError(null); }}>Annuler</Button>
                <Button kind="primary" style={{ flex: 1 }} loading={pwdSaving} onPress={savePassword}>Enregistrer</Button>
              </View>
            </View>
          ) : (
            <ActionRow
              icon={<Icons.shield size={18} color={theme.navy} stroke={1.8} />}
              label="Changer mon mot de passe"
              sub="Tes autres appareils seront déconnectés"
              onPress={() => setPwdOpen(true)}
            />
          )}
        </Section>

        <Section title="Appareils connectés">
          {sessions === null ? (
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium, paddingVertical: 12 }}>Chargement…</Text>
          ) : sessions.length === 0 ? (
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium, paddingVertical: 12 }}>Aucun appareil à afficher.</Text>
          ) : (
            sessions.map((sess, i) => (
              <View key={sess.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.lineSoft }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.globe size={16} color={theme.ink} stroke={1.8} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{sess.device}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                    {sess.ip} · connecté {sess.lastSeen.toLowerCase()}
                  </Text>
                </View>
                <Pressable onPress={() => revoke(sess.id)} style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: pressed ? theme.bad + '22' : 'transparent' })}>
                  <Text style={{ fontSize: 12.5, color: theme.bad, fontFamily: TYPO.weights.semibold }}>Déconnecter</Text>
                </Pressable>
              </View>
            ))
          )}
        </Section>

        <Section title="Mes données (RGPD)">
          <ActionRow
            icon={<Icons.doc size={18} color={theme.navy} stroke={1.8} />}
            label={exporting ? 'Préparation…' : 'Exporter mes données'}
            sub="Fichier immédiat : profil, envois, paiements, documents"
            onPress={exporting ? () => undefined : exportData}
          />
          <ActionRow
            icon={<Icons.x size={18} color={theme.bad} stroke={2} />}
            label={deleting ? 'Suppression en cours…' : 'Supprimer mon compte'}
            sub="Immédiate et irréversible"
            danger
            onPress={deleting ? () => undefined : removeAccount}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
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
