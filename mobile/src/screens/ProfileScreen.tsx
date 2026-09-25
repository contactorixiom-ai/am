import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { fetchKycOverview } from '../api/kyc';
import { LEGAL_PRIVACY_URL } from '../config/company';
import { confirmAction, notify } from '../utils/notify';
import Svg, { Circle } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SAFE_AREA_TOP, TYPO } from '../theme/tokens';

export function ProfileScreen() {
  const { theme, isDark, setMode } = useTheme();
  const { user, logout } = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [kycStatus, setKycStatus] = useState<'verified' | 'pending' | 'incomplete'>('incomplete');

  // Statut d'identité d'après le serveur (il était lu sur le téléphone et
  // restait « incomplet » une fois les pièces validées par Axis).
  useEffect(() => {
    if (user?.role !== 'DRIVER') return;
    const refresh = () => {
      fetchKycOverview()
        .then((o) => setKycStatus(o.status === 'APPROVED' ? 'verified' : o.status === 'PENDING' ? 'pending' : 'incomplete'))
        .catch(() => undefined);
    };
    refresh();
    const unsub = nav.addListener('focus', refresh);
    return unsub;
  }, [nav, user?.role]);

  // Le KYC exige un permis de conduire : il ne concerne que les convoyeurs.
  // Un client qui envoie un colis n'a aucune raison de fournir le sien.
  const isDriver = user?.role === 'DRIVER' || user?.role === 'ADMIN';

  const handleLogout = () => {
    confirmAction('Déconnexion', 'Tu es sûr ?', () => logout(), 'Se déconnecter');
  };

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Invité';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header navy avec profil + stats — repris du drawer menu maquette */}
        <View
          style={{
            paddingTop: SAFE_AREA_TOP - 8,
            paddingBottom: 22,
            paddingHorizontal: 22,
            backgroundColor: theme.navy,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Decorative gold ring */}
          <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -60, width: 220, height: 220, opacity: 0.14 }}>
            <Svg width={220} height={220} viewBox="0 0 200 200">
              <Circle cx="100" cy="100" r="90" stroke={theme.gold} strokeWidth={1} fill="none" />
              <Circle cx="100" cy="100" r="60" stroke={theme.gold} strokeWidth={1} fill="none" />
            </Svg>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={fullName} size={52} tone="gold" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16, color: '#F5F1E8', fontFamily: TYPO.weights.semibold, letterSpacing: -0.2 }}>
                  {fullName}
                </Text>
                {kycStatus === 'verified' ? (
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.check size={10} color={theme.navyDeep} stroke={3} />
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.62)', marginTop: 2, fontFamily: TYPO.weights.medium }}>
                {user?.email ?? ''}
              </Text>
            </View>
          </View>

          {/* Vérification d'identité — convoyeurs uniquement */}
          {isDriver ? (
          <Pressable
            onPress={() => nav.navigate('KycVerification')}
            style={({ pressed }) => ({
              marginTop: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: pressed ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            })}
          >
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: kycStatus === 'verified' ? theme.gold + '40' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.shield size={16} color={kycStatus === 'verified' ? theme.goldHi : '#F5F1E8'} stroke={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, color: '#F5F1E8', fontFamily: TYPO.weights.semibold }}>
                {kycStatus === 'verified' ? 'Identité vérifiée' : kycStatus === 'pending' ? 'Vérification en cours' : 'Vérifier mon identité'}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(245,241,232,0.6)', marginTop: 1, fontFamily: TYPO.weights.medium }}>
                {kycStatus === 'verified'
                  ? 'Permis et pièce d\'identité validés'
                  : kycStatus === 'pending'
                  ? 'Notre équipe contrôle tes documents'
                  : 'Permis + ID requis · 2 min'}
              </Text>
            </View>
            <Icons.chev size={16} color="rgba(245,241,232,0.7)" stroke={2} />
          </Pressable>
          ) : null}

          {/* Badge de rôle. Les compteurs « missions » et « total dépensé »
              qui figuraient ici n'ont jamais été branchés : ils affichaient
              zéro en permanence. Les vrais chiffres sont dans l'onglet Suivi. */}
          <View style={{ marginTop: 16, flexDirection: 'row' }}>
            <View style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: theme.gold + '2E' }}>
              <Text style={{ fontSize: 10.5, color: theme.goldHi, letterSpacing: 0.6, fontFamily: TYPO.weights.semibold }}>
                {user?.role === 'ADMIN' ? 'ADMINISTRATEUR' : user?.role === 'DRIVER' ? 'CONVOYEUR' : 'CLIENT'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        <View style={{ paddingHorizontal: 8, paddingTop: 14 }}>
          {/* Le client a quatre besoins : demander un devis, suivre ses
              transports, signer ses documents, lire les actualités. Tout
              cela vit dans les onglets. Le profil ne garde donc que ce qui
              n'a pas sa place ailleurs — et rien qui ne soit branché. */}
          <MenuSection label="Mon compte">
            <MenuRow
              iconKey="user"
              label="Mes informations"
              sub={user?.accountType === 'PROFESSIONAL' ? 'Société, SIRET, adresse de facturation' : 'Identité, téléphone, adresse de facturation'}
              onPress={() => nav.navigate('ProfileInfo')}
            />
            <MenuRow
              iconKey="shield"
              label="Sécurité du compte"
              sub="Mot de passe, appareils connectés, mes données"
              onPress={() => nav.navigate('SecuritySettings')}
            />
          </MenuSection>

          <MenuSection label="Aide">
            <MenuRow
              iconKey="chat"
              label="Contacter Axis"
              sub={user?.role === 'DRIVER' ? 'Une question sur une mission en cours' : 'Une question sur un envoi en cours'}
              onPress={() => nav.navigate('Conversations')}
            />
            <MenuRow iconKey="news" label="Actualités transport" onPress={() => nav.navigate('News')} />
            {/* L'App Store impose que la politique de confidentialité soit
                accessible ; la garder à portée de main dans l'application
                évite d'avoir à la chercher sur le site. */}
            <MenuRow
              iconKey="shield"
              label="Confidentialité et conditions"
              sub="Ce que nous collectons, et pourquoi"
              onPress={() => Linking.openURL(LEGAL_PRIVACY_URL).catch(() => notify(
                'Page indisponible',
                'Impossible d\'ouvrir la page. Réessaie avec une connexion.',
              ))}
            />
          </MenuSection>

          {/* Accès réservés : n'apparaissent que pour les rôles concernés. */}
          {user?.role === 'ADMIN' || user?.role === 'DRIVER' ? (
            <MenuSection label="Axis">
              {user?.role === 'ADMIN' ? (
                <MenuRow
                  iconKey="sliders"
                  label="Espace admin"
                  sub="Tableau de bord · documents · envois"
                  onPress={() => nav.navigate('Admin')}
                />
              ) : null}
              {/* Pour le convoyeur, le mode chauffeur est déjà un onglet :
                  on ne double pas l'entrée. L'admin, lui, n'a pas cet onglet. */}
              {user?.role === 'ADMIN' ? (
                <MenuRow
                  iconKey="pin"
                  label="Mode chauffeur"
                  sub="Suivi GPS, état des lieux, contrat"
                  onPress={() => nav.navigate('DriverMode')}
                />
              ) : null}
              <MenuRow
                iconKey="car"
                label="Documents véhicule"
                sub="Carte grise, contrôle technique, assurance"
                onPress={() => nav.navigate('VehicleDocs')}
              />
            </MenuSection>
          ) : null}

          <MenuSection label="Préférences">
            <MenuRow iconKey="bell" label="Notifications" onPress={() => nav.navigate('Notifications')} />
            <MenuRowToggle
              label="Mode sombre"
              value={isDark}
              onChange={(v) => setMode(v ? 'dark' : 'light')}
            />
          </MenuSection>

          {/* Logout */}
          <View style={{ paddingHorizontal: 12, marginTop: 6 }}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => ({
                paddingVertical: 13,
                borderRadius: RADII.md,
                borderWidth: 1,
                borderColor: theme.bad + '4D',
                backgroundColor: pressed ? theme.bad + '14' : 'transparent',
                alignItems: 'center',
              })}
            >
              <Text style={{ color: theme.bad, fontSize: 14, fontFamily: TYPO.weights.semibold }}>
                Se déconnecter
              </Text>
            </Pressable>
            <Text
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: theme.faint,
                marginTop: 14,
                fontFamily: TYPO.weights.medium,
              }}
            >
              Axis Import · v0.1.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontSize: 11,
          color: theme.muted,
          letterSpacing: 0.9,
          textTransform: 'uppercase',
          fontFamily: TYPO.weights.semibold,
          paddingHorizontal: 16,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function MenuRow({
  iconKey,
  label,
  sub,
  trailing,
  badge,
  onPress,
}: {
  iconKey: keyof typeof Icons;
  label: string;
  sub?: string;
  trailing?: string;
  badge?: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const IconComp = Icons[iconKey];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: RADII.md,
        backgroundColor: pressed ? theme.bgSoft : 'transparent',
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.bgSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconComp size={18} color={theme.navy} stroke={1.6} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.medium }}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 1, fontFamily: TYPO.weights.medium }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View
          style={{
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: 999,
            backgroundColor: theme.gold + '24',
          }}
        >
          <Text style={{ fontSize: 10.5, color: theme.goldDeep, fontFamily: TYPO.weights.semibold }}>{badge}</Text>
        </View>
      ) : null}
      {trailing ? (
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{trailing}</Text>
      ) : null}
      <Icons.chev size={16} color={theme.faint} stroke={1.6} />
    </Pressable>
  );
}

function MenuRowToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.bgSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icons.bolt size={18} color={theme.navy} stroke={1.6} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.medium }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.line, true: theme.gold }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
