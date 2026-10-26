// Onglet « Équipe » de l'espace admin (administrateur uniquement).
//
// Chaque responsable d'exploitation a son propre compte : Roger le crée ici,
// lui envoie un lien d'accès (WhatsApp, SMS) pour qu'il choisisse son mot de
// passe, et peut lui retirer l'accès à tout moment. Les responsables pilotent
// l'activité (envois, statuts, convoyeurs, documents, messages) mais ne voient
// ni cet onglet, ni le chiffre d'affaires, et ne remboursent pas.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { createManager, listStaff, restoreManager, revokeManager, StaffMember } from '../api/staff';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { confirmAction, notify } from '../utils/notify';
import { roleLabel } from '../utils/roles';
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

export function StaffPanel({ onSendAccess }: Props) {
  const { theme } = useTheme();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    listStaff().then(setStaff).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('Prénom, nom et e-mail sont requis.');
      return;
    }
    setSaving(true);
    try {
      const created = await createManager({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      setForm(EMPTY);
      setAdding(false);
      load();
      // Le compte n'a pas de mot de passe : on propose tout de suite le lien.
      onSendAccess({ userId: created.id, name: `${created.firstName} ${created.lastName}`.trim() });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Création impossible. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAccess = (m: StaffMember) => {
    const suspended = m.status === 'SUSPENDED';
    confirmAction(
      suspended ? 'Rendre l\'accès' : 'Retirer l\'accès',
      suspended
        ? `${m.firstName} pourra de nouveau se connecter avec son mot de passe.`
        : `${m.firstName} est déconnecté de tous ses appareils et ne peut plus se connecter. Son historique est conservé.`,
      async () => {
        try {
          if (suspended) await restoreManager(m.id);
          else await revokeManager(m.id);
          load();
        } catch (e) {
          notify('Action impossible', e instanceof Error ? e.message : 'Réessaie dans un instant.');
        }
      },
      suspended ? 'Rendre l\'accès' : 'Retirer l\'accès',
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Surface padded style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>Responsables d'exploitation</Text>
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
          Chacun son compte, distinct du tien. Ils suivent et font avancer les envois, valident les convoyeurs, gèrent les documents
          et répondent aux messages. Ils ne voient ni cet onglet, ni le chiffre d'affaires, et ne peuvent pas rembourser.
        </Text>
      </Surface>

      {staff === null && !failed ? <ActivityIndicator color={theme.navy} /> : null}
      {failed ? (
        <Surface padded style={{ gap: 8 }}>
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>Équipe indisponible pour le moment.</Text>
          <Button kind="outline" size="sm" onPress={load} style={{ alignSelf: 'flex-start' }}>Réessayer</Button>
        </Surface>
      ) : null}

      {(staff ?? []).map((m) => {
        const suspended = m.status === 'SUSPENDED';
        const pending = m.status === 'PENDING';
        return (
          <Surface key={m.id} padded style={{ gap: 10, opacity: suspended ? 0.7 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={`${m.firstName} ${m.lastName}`} size={40} tone={m.role === 'ADMIN' ? 'gold' : 'navy'} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                  {m.firstName} {m.lastName}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {m.email}{m.phone ? ` · ${m.phone}` : ''}
                </Text>
              </View>
              <Pill tone={suspended ? 'bad' : pending ? 'warn' : m.role === 'ADMIN' ? 'gold' : 'good'}>
                {suspended ? 'Accès retiré' : pending ? 'Invitation envoyée' : roleLabel(m.role)}
              </Pill>
            </View>
            {m.role === 'MANAGER' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {!suspended ? (
                  <Button
                    kind="outline"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => onSendAccess({ userId: m.id, name: `${m.firstName} ${m.lastName}`.trim() })}
                  >
                    {pending ? 'Renvoyer le lien' : 'Lien d\'accès'}
                  </Button>
                ) : null}
                <Button kind={suspended ? 'primary' : 'ghost'} size="sm" style={{ flex: 1 }} onPress={() => toggleAccess(m)}>
                  {suspended ? 'Rendre l\'accès' : 'Retirer l\'accès'}
                </Button>
              </View>
            ) : null}
          </Surface>
        );
      })}

      {adding ? (
        <Surface padded style={{ gap: 10 }}>
          <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.bold }}>Nouveau responsable</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field containerStyle={{ flex: 1 }} label="Prénom" value={form.firstName} onChangeText={set('firstName')} autoCapitalize="words" />
            <Field containerStyle={{ flex: 1 }} label="Nom" value={form.lastName} onChangeText={set('lastName')} autoCapitalize="words" />
          </View>
          <Field
            label="E-mail professionnel"
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            hint="Ce sera son identifiant de connexion."
          />
          <Field label="Téléphone (facultatif)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          {error ? <Text style={{ color: theme.bad, fontSize: 12.5, fontFamily: TYPO.weights.semibold }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button kind="ghost" size="md" style={{ flex: 1 }} onPress={() => { setAdding(false); setError(null); }}>
              Annuler
            </Button>
            <Button kind="primary" size="md" style={{ flex: 1 }} loading={saving} onPress={submit}>
              Créer le compte
            </Button>
          </View>
        </Surface>
      ) : (
        <Button kind="gold" size="lg" fullWidth onPress={() => setAdding(true)}>
          Ajouter un responsable d'exploitation
        </Button>
      )}
    </View>
  );
}
