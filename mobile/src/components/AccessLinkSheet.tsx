import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, Share, Text, View } from 'react-native';
import { AccessLink, createAccessLink } from '../api/auth';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { Button } from './Button';

/**
 * Lien d'accès à transmettre à un client dont Roger a saisi la commande.
 * Ce client n'a jamais choisi de mot de passe : sans ce lien, il ne peut
 * ni suivre son transport, ni signer son contrat, ni régler sa facture.
 */
export function AccessLinkSheet({
  target,
  onClose,
}: {
  target: { userId: string; name: string } | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const [link, setLink] = useState<AccessLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(null);
    setError(null);
    setCopied(false);
    if (!target) return;
    let alive = true;
    createAccessLink(target.userId)
      .then((l) => alive && setLink(l))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Création du lien impossible.'));
    return () => {
      alive = false;
    };
  }, [target]);

  const message = link
    ? `Bonjour ${link.firstName}, voici votre accès à l'application Axis Import pour suivre votre transport, ` +
      `signer vos documents et régler votre facture. Choisissez votre mot de passe ici (lien valable 7 jours) : ${link.url}\n` +
      `Ensuite, connectez-vous avec l'adresse ${link.email}.`
    : '';

  const phoneDigits = link?.phone?.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0(\d{9})$/, '33$1');

  const whatsapp = () => {
    if (!phoneDigits) return;
    Linking.openURL(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`);
  };
  const sms = () => {
    if (!link?.phone) return;
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${link.phone.replace(/\s/g, '')}${sep}body=${encodeURIComponent(message)}`);
  };
  const shareOrCopy = async () => {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator) : undefined;
      try {
        if (nav?.clipboard) {
          await nav.clipboard.writeText(message);
          setCopied(true);
          return;
        }
      } catch {
        /* on retombe sur le partage */
      }
    }
    try {
      await Share.share({ message });
    } catch {
      setError('Partage impossible : recopiez le lien affiché ci-dessus.');
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, gap: 12 }}
        >
          <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold }}>
            Accès client — {target?.name}
          </Text>
          <Text style={{ fontSize: 13, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 19 }}>
            Envoie ce lien au client : il y choisit son mot de passe et arrive directement dans son espace
            (suivi, contrat, paiement). Le lien est valable 7 jours et ne sert qu'une fois.
          </Text>

          {error ? (
            <Text style={{ fontSize: 13, color: theme.bad, fontFamily: TYPO.weights.medium }}>{error}</Text>
          ) : !link ? (
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium }}>Création du lien…</Text>
          ) : (
            <>
              <View style={{ padding: 10, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line }}>
                <Text selectable style={{ fontSize: 12, color: theme.ink, fontFamily: TYPO.weights.medium }}>
                  {link.url}
                </Text>
              </View>
              {phoneDigits ? (
                <Button kind="primary" fullWidth onPress={whatsapp}>
                  Envoyer par WhatsApp
                </Button>
              ) : null}
              {link.phone && Platform.OS !== 'web' ? (
                <Button kind="outline" fullWidth onPress={sms}>
                  Envoyer par SMS
                </Button>
              ) : null}
              <Button kind={phoneDigits ? 'outline' : 'primary'} fullWidth onPress={shareOrCopy}>
                {copied ? 'Message copié ✓' : Platform.OS === 'web' ? 'Copier le message' : 'Partager…'}
              </Button>
              {!link.phone ? (
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                  Pas de téléphone enregistré pour ce client : copie le message et envoie-le par e-mail.
                </Text>
              ) : null}
            </>
          )}
          <Button kind="ghost" fullWidth onPress={onClose}>
            Fermer
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
