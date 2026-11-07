// Invitation d'un convoyeur (onglet Convoyeurs de l'espace admin).
//
// Roger — ou un responsable d'exploitation — crée le compte du convoyeur et
// lui envoie un lien d'accès (WhatsApp, SMS). Le convoyeur choisit son mot de
// passe, envoie son permis et sa pièce d'identité, puis Roger valide les
// pièces ci-dessous comme pour une inscription spontanée.
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { InvitedDriver, inviteDriver, listInvitedDrivers } from '../api/staff';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field } from './Field';
import { Pill } from './Pill';
import { Surface } from './Surface';

interface Props {
  /** Ouvre la fenêtre « lien d'accès » (WhatsApp / SMS / copier). */
  onSendAccess: (target: { userId: string; name: string }) => void;
}

const EMPTY = { firstName: '', lastName: '', email: '', phone: '' };

export function DriverInvitePanel({ onSendAccess }: Props) {
  const { theme } = useTheme();
  const [invited, setInvited] = useState<InvitedDriver[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listInvitedDrivers().then(setInvited).catch(() => setInvited([]));
  }, []);
  useEffect(load, [load]);

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('Prénom, nom et e-mail sont requis.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Le téléphone est requis : c\'est par lui que tu lui envoies le lien.');
      return;
    }
    setSaving(true);
    try {
      const created = await inviteDriver({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setForm(EMPTY);
      setOpen(false);
      load();
      onSendAccess({ userId: created.id, name: `${created.firstName} ${created.lastName}`.trim() });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Invitation impossible. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {open ? (
        <Surface padded style={{ gap: 10 }}>
          <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>Inviter un convoyeur</Text>
          <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
            Son compte est créé tout de suite. Tu lui envoies le lien d'accès : il choisit son mot de passe, puis envoie son permis et sa
            pièce d'identité. Tu valides ses pièces ici avant qu'il reçoive des missions.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field containerStyle={{ flex: 1 }} label="Prénom" value={form.firstName} onChangeText={set('firstName')} autoCapitalize="words" />
            <Field containerStyle={{ flex: 1 }} label="Nom" value={form.lastName} onChangeText={set('lastName')} autoCapitalize="words" />
          </View>
          <Field label="E-mail" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" hint="Ce sera son identifiant de connexion." />
          <Field label="Téléphone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+33 6 12 34 56 78" />
          {error ? <Text style={{ color: theme.bad, fontSize: 12.5, fontFamily: TYPO.weights.semibold }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button kind="ghost" size="md" style={{ flex: 1 }} onPress={() => { setOpen(false); setError(null); }}>Annuler</Button>
            <Button kind="primary" size="md" style={{ flex: 1 }} loading={saving} onPress={submit}>Créer et envoyer</Button>
          </View>
        </Surface>
      ) : (
        <Button kind="gold" size="lg" fullWidth onPress={() => setOpen(true)}>Inviter un convoyeur</Button>
      )}

      {invited.length ? (
        <Surface padded style={{ gap: 10 }}>
          <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            Invités, pas encore connectés
          </Text>
          {invited.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={`${d.firstName} ${d.lastName}`} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                  {d.firstName} {d.lastName}
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {d.phone ?? d.email}
                </Text>
              </View>
              {d.status === 'SUSPENDED' ? (
                <Pill tone="bad">Suspendu</Pill>
              ) : (
                <Button kind="outline" size="sm" onPress={() => onSendAccess({ userId: d.id, name: `${d.firstName} ${d.lastName}`.trim() })}>
                  Renvoyer le lien
                </Button>
              )}
            </View>
          ))}
        </Surface>
      ) : null}
    </View>
  );
}
