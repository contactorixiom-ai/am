// Photo de profil modifiable : un appui ouvre le choix (photo ou galerie),
// l'image est envoyée au stockage Axis puis enregistrée sur le compte.
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { updateProfile } from '../api/auth';
import { uploadFile } from '../api/kyc';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { extOfMime, mimeOfDataUrl, shrinkForUpload, uriToDataUrl } from '../utils/imageData';
import { askYesNo, confirmAction, notify } from '../utils/notify';
import { pickSquarePhoto } from '../utils/pickImage';
import { Avatar } from './Avatar';
import { Icons } from './Icons';

export function ProfilePhoto({ size = 52, tone = 'gold' }: { size?: number; tone?: 'navy' | 'gold' }) {
  const { theme } = useTheme();
  const { user, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Moi';

  const save = async (avatarUrl: string) => {
    await updateProfile({ avatarUrl });
    await refresh();
  };

  const change = async () => {
    if (busy) return;
    // Sur le web, pas d'appareil photo : on ouvre directement le choix d'image.
    const source = Platform.OS === 'web'
      ? 'library'
      : (await askYesNo('Photo de profil', 'Prendre une photo maintenant, ou en choisir une dans la galerie ?', 'Prendre une photo', 'Galerie'))
        ? 'camera'
        : 'library';
    const uri = await pickSquarePhoto(source);
    if (!uri) return;
    setBusy(true);
    try {
      const raw = await uriToDataUrl(uri);
      if (!raw) throw new Error('Photo illisible. Réessaie.');
      const data = await shrinkForUpload(raw);
      const mimeType = mimeOfDataUrl(data);
      const up = await uploadFile({ data, mimeType, fileName: `avatar.${extOfMime(mimeType)}`, folder: 'avatars' });
      await save(up.url);
    } catch (e) {
      notify('Photo non enregistrée', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => confirmAction('Retirer la photo ?', 'Tes initiales seront affichées à la place.', () => {
    setBusy(true);
    save('').catch(() => notify('Action impossible', 'Réessaie.')).finally(() => setBusy(false));
  }, 'Retirer');

  return (
    <Pressable
      onPress={() => void change()}
      onLongPress={user?.avatarUrl ? remove : undefined}
      accessibilityRole="button"
      accessibilityLabel={user?.avatarUrl ? 'Changer ma photo de profil (appui long pour la retirer)' : 'Ajouter une photo de profil'}
      style={{ width: size, height: size }}
    >
      <Avatar name={name} url={user?.avatarUrl} size={size} tone={tone} />
      <View style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.4, height: size * 0.4, borderRadius: size, backgroundColor: theme.gold, borderWidth: 2, borderColor: theme.navy, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator size="small" color={theme.navyDeep} /> : <Icons.camera size={size * 0.2} color={theme.navyDeep} stroke={2} />}
      </View>
    </Pressable>
  );
}
