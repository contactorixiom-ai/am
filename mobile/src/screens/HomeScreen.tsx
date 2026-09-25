import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { fetchKycOverview, GlobalKycStatus } from '../api/kyc';
import { listMissions } from '../api/missions';
import { listNews, NewsArticle } from '../api/news';
import { listNotifications } from '../api/notifications';
import { listParcels } from '../api/parcels';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { countContractsToSign } from '../utils/clientDocs';
import { missionView, parcelView, ShipmentView, sortForClient } from '../utils/shipment';
import { Avatar } from '../components/Avatar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { notify } from '../utils/notify';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SAFE_AREA_TOP, TYPO } from '../theme/tokens';

export function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Statut KYC pour afficher une bannière d'incitation si nécessaire.
  // Repli silencieux en mode hors-ligne (on n'embête pas l'utilisateur démo).
  const [kycStatus, setKycStatus] = useState<GlobalKycStatus | null>(null);
  const isDriver = user?.role === 'DRIVER' || user?.role === 'ADMIN';
  // Un convoyeur n'est pas un client : il ne commande rien, il exécute.
  // L'administrateur, lui, passe aussi des commandes pour ses clients :
  // il garde donc l'interface cliente complète.
  const isDriverOnly = user?.role === 'DRIVER';
  useEffect(() => {
    // Inutile d'interroger l'API pour un client : le KYC ne le concerne pas.
    if (!isDriver) return;
    let cancelled = false;
    fetchKycOverview()
      .then((o) => { if (!cancelled) setKycStatus(o.status); })
      .catch(() => { /* offline → on n'affiche pas la bannière */ });
    return () => { cancelled = true; };
  }, [isDriver]);

  // Envois réels du client : convoyages + colis, fusionnés et triés.
  // Aucune donnée d'exemple — si le client n'a rien, il voit un appel à l'action.
  const [shipments, setShipments] = useState<ShipmentView[] | null>(null);
  const [toSign, setToSign] = useState(0);
  const [unread, setUnread] = useState(0);
  const [latestNews, setLatestNews] = useState<NewsArticle | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        // Le convoyeur n'a pas de colis et ne signe pas de contrat client :
        // on ne charge que ses missions, et uniquement celles qui lui sont
        // affectées (l'API lui renvoie aussi les missions publiées).
        const [mRes, pRes] = await Promise.allSettled([
          listMissions(),
          isDriverOnly ? Promise.resolve({ data: [] as Awaited<ReturnType<typeof listParcels>>['data'] }) : listParcels(),
        ]);
        if (cancelled) return;
        const allMissions = mRes.status === 'fulfilled' ? mRes.value.data : [];
        const missions = isDriverOnly
          ? allMissions.filter((m) => m.driver?.id && m.driver.id === user?.id)
          : allMissions;
        const views: ShipmentView[] = [
          ...missions.map(missionView),
          ...(pRes.status === 'fulfilled' ? pRes.value.data.map(parcelView) : []),
        ];
        setShipments(sortForClient(views));
        if (isDriverOnly) {
          setToSign(0);
        } else {
          const n = await countContractsToSign(missions);
          if (!cancelled) setToSign(n);
        }

        // Pastille de notifications et aperçu actualités : silencieux si
        // l'API ne répond pas, ces blocs sont secondaires.
        const [notifs, news] = await Promise.allSettled([listNotifications(), listNews()]);
        if (cancelled) return;
        setUnread(notifs.status === 'fulfilled' ? notifs.value.filter((x) => !x.readAt).length : 0);
        setLatestNews(news.status === 'fulfilled' ? news.value.data[0] ?? null : null);
      })();
      return () => { cancelled = true; };
    }, [isDriverOnly, user?.id]),
  );

  const primary = shipments?.[0] ?? null;
  const secondary = shipments?.[1] ?? null;

  const callDriver = (view: ShipmentView) => {
    if (!view.driverPhone) {
      notify('Coordonnées indisponibles', 'Le convoyeur n\'a pas encore communiqué son numéro.');
      return;
    }
    Linking.openURL(`tel:${view.driverPhone.replace(/\s/g, '')}`).catch(() =>
      notify('Appel impossible', view.driverPhone ?? ''),
    );
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Bonne nuit';
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bonjour';
    return 'Bonsoir';
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: SAFE_AREA_TOP - 12,
          paddingHorizontal: 20,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* L'avatar mène au profil. L'icône de réglages qui figurait ici
            laissait croire à des paramètres, alors que l'onglet Profil est
            déjà dans la barre du bas. */}
        <Pressable onPress={() => nav.getParent()?.navigate('AppTabs', { screen: 'Profile' } as never)}>
          <Avatar name={user ? `${user.firstName} ${user.lastName}` : 'Axis'} size={42} tone="navy" />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
            {greeting},
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.semibold, lineHeight: 19 }}
          >
            {user ? `${user.firstName} ${user.lastName}` : 'Bienvenue'}
          </Text>
        </View>
        <Pressable
          onPress={() => nav.navigate('Notifications')}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.line,
            backgroundColor: pressed ? theme.bgSoft : theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icons.bell size={20} color={theme.ink} stroke={1.6} />
          {unread > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 9,
                right: 11,
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: theme.gold,
                borderWidth: 2,
                borderColor: theme.surface,
              }}
            />
          ) : null}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 18 }}>
        {/* Bannière KYC — convoyeurs uniquement. Le KYC exige un permis de
            conduire : le réclamer à un client qui envoie un colis n'a aucun
            sens, et c'est ce qu'il voyait dès l'ouverture de l'application.
            Masquée aussi hors ligne, l'API n'ayant alors pas répondu. */}
        {isDriverOnly && kycStatus !== null && kycStatus !== 'APPROVED' ? (
          <Banner
            tone={kycStatus === 'REJECTED' ? 'error' : 'info'}
            title={
              kycStatus === 'REJECTED'
                ? 'Identité refusée'
                : kycStatus === 'PENDING'
                  ? 'Identité en cours de vérification'
                  : 'Vérifie ton identité'
            }
            message={
              kycStatus === 'REJECTED'
                ? 'Reprends les pièces refusées pour pouvoir continuer.'
                : kycStatus === 'PENDING'
                  ? 'Axis vérifie tes documents et te prévient dès que c\'est fait.'
                  : isDriverOnly
                    ? '2 min : permis et pièce d\'identité pour pouvoir convoyer.'
                    : '2 min pour pouvoir envoyer un colis ou un véhicule.'
            }
            action={
              kycStatus === 'PENDING'
                ? undefined
                : { label: kycStatus === 'REJECTED' ? 'Corriger' : 'Vérifier', onPress: () => nav.navigate('KycVerification') }
            }
          />
        ) : null}

        {/* Accès direct Espace admin — réservé aux opérateurs (rôle ADMIN) */}
        {user?.role === 'ADMIN' ? (
          <Pressable
            onPress={() => nav.navigate('Admin')}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: theme.gold + '66',
              backgroundColor: pressed ? theme.bgSoft : theme.surface,
              borderRadius: RADII.xxl,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            })}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.gold + '26', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.sliders size={22} color={theme.goldDeep} stroke={1.7} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Espace admin</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>
                Documents officiels · envois à traiter
              </Text>
            </View>
            <Icons.chev size={18} color={theme.muted} stroke={2} />
          </Pressable>
        ) : null}

        {/* Envoi en cours — données réelles du client */}
        {shipments === null ? (
          <Skeleton variant="card" count={1} />
        ) : primary === null ? (
          <Surface padded style={{ padding: 4 }}>
            {isDriverOnly ? (
              <EmptyState
                iconKey="truck"
                title="Aucune mission affectée"
                subtitle="Dès qu'Axis t'affecte un convoyage, il apparaît ici avec l'itinéraire et le suivi GPS."
                cta={{
                  label: 'Ouvrir le mode chauffeur',
                  onPress: () => nav.getParent()?.navigate('AppTabs', { screen: 'Missions' } as never),
                }}
              />
            ) : (
              <EmptyState
                iconKey="truck"
                title="Aucun envoi en cours"
                subtitle="Demande un convoyage de véhicule ou envoie un colis : tu suivras tout ici."
                cta={{ label: 'Faire une demande', onPress: () => nav.navigate('ServicePicker') }}
              />
            )}
          </Surface>
        ) : (
          <Surface padded style={{ padding: 16, overflow: 'hidden' }}>
            {/* Header cliquable → ouvre le dossier complet (sans englober les boutons) */}
            <Pressable
              onPress={() =>
                primary.kind === 'mission'
                  ? nav.navigate('MissionDetails', { reference: primary.reference })
                  : nav.navigate('Tracking', { kind: 'parcel', id: primary.id, reference: primary.reference })
              }
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
            >
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Pill tone={primary.active ? 'navy' : 'good'}>{`● ${primary.step}`}</Pill>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: theme.muted,
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    fontFamily: TYPO.weights.medium,
                    fontVariant: ['tabular-nums'],
                  }}
                  numberOfLines={1}
                >
                  {primary.reference}
                </Text>
                <Icons.chev size={14} color={theme.muted} stroke={2} />
              </View>
            </Pressable>
            <Text
              style={{
                fontFamily: TYPO.weights.bold,
                fontSize: 28,
                lineHeight: 28 * 1.05,
                color: theme.ink,
                letterSpacing: -0.3,
              }}
            >
              {primary.from}
              {'\n'}
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular }}>vers</Text> {primary.to}
            </Text>
            {primary.stepDetail ? (
              <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 6 }} numberOfLines={1}>
                Dernier point : {primary.stepDetail}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, marginBottom: 14 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.medium }}>
                  {primary.etaLabel}
                </Text>
                <Text style={{ fontFamily: TYPO.weights.bold, fontSize: primary.eta ? 26 : 18, color: primary.eta ? theme.ink : theme.muted, lineHeight: 28, marginTop: 2 }} numberOfLines={1}>
                  {primary.eta ?? 'À confirmer'}
                </Text>
              </View>
              {primary.distanceKm ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.medium }}>
                    Distance
                  </Text>
                  <Text style={{ fontFamily: TYPO.weights.bold, fontSize: 26, color: theme.ink, lineHeight: 28, marginTop: 2 }}>
                    {Math.round(primary.distanceKm)} km
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Avancement déduit du statut réel de l'envoi */}
            <View style={{ height: 4, backgroundColor: theme.bgSoft, borderRadius: 2, marginBottom: 14 }}>
              <View
                style={{
                  width: `${Math.round(primary.progress * 100)}%`,
                  height: '100%',
                  backgroundColor: theme.gold,
                  borderRadius: 2,
                }}
              />
            </View>

            {/* Convoyeur affecté — masqué tant qu'il n'y en a pas.
                Côté convoyeur on inverse : c'est le client qu'il doit voir,
                pas son propre nom avec un bouton « Appeler ». */}
            {isDriverOnly ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.medium }}>
                    Donneur d'ordre
                  </Text>
                  <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={1}>
                    {primary.clientName ?? 'Axis Import'}
                  </Text>
                </View>
                <Button
                  kind="primary"
                  size="sm"
                  onPress={() => nav.getParent()?.navigate('AppTabs', { screen: 'Missions' } as never)}
                >
                  Mode chauffeur
                </Button>
              </View>
            ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {primary.driverName ? (
                <>
                  <Avatar name={primary.driverName} size={36} tone="gold" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                      {primary.driverName}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }} numberOfLines={1}>
                      {primary.vehicleLabel ?? 'Ton convoyeur'}
                    </Text>
                  </View>
                  <Button
                    kind="outline"
                    size="sm"
                    leftIcon={<Icons.phone size={14} color={theme.ink} stroke={1.8} />}
                    onPress={() => callDriver(primary)}
                  >
                    Appeler
                  </Button>
                </>
              ) : (
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                    {primary.kind === 'mission'
                      ? 'Convoyeur en cours d\'affectation par Axis.'
                      : 'Ton colis est pris en charge par Axis.'}
                  </Text>
                </View>
              )}
              <Button
                kind="primary"
                size="sm"
                onPress={() => nav.navigate('Tracking', { kind: primary.kind, id: primary.id, reference: primary.reference })}
              >
                Suivre
              </Button>
            </View>
            )}
          </Surface>
        )}

        {/* Raccourcis du convoyeur — il ne commande pas de transport et n'a
            aucune facture à régler : ces deux cartes étaient celles du client. */}
        {isDriverOnly ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => nav.getParent()?.navigate('AppTabs', { screen: 'Missions' } as never)}
              style={({ pressed }) => ({
                flex: 1.4,
                borderWidth: 1,
                borderColor: theme.navy,
                backgroundColor: pressed ? theme.navyDeep : theme.navy,
                padding: 16,
                borderRadius: RADII.xxl,
                overflow: 'hidden',
                position: 'relative',
              })}
            >
              <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.12 }}>
                <Icons.truck size={90} color={theme.gold} stroke={1.5} />
              </View>
              <Text
                style={{
                  fontSize: 11.5,
                  color: theme.gold,
                  letterSpacing: 0.9,
                  textTransform: 'uppercase',
                  fontFamily: TYPO.weights.semibold,
                }}
              >
                Mode chauffeur
              </Text>
              <Text
                style={{
                  fontFamily: TYPO.weights.bold,
                  fontSize: 24,
                  lineHeight: 24 * 1.05,
                  marginTop: 6,
                  color: '#F5F1E8',
                  letterSpacing: -0.2,
                }}
              >
                Démarrer le suivi
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.65)', marginTop: 10, fontFamily: TYPO.weights.medium }}>
                Position partagée avec le client
              </Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate('VehicleDocs')}
              style={({ pressed }) => ({
                flex: 1,
                borderWidth: 1,
                borderColor: theme.line,
                backgroundColor: pressed ? theme.bgSoft : theme.surface,
                padding: 16,
                borderRadius: RADII.xxl,
              })}
            >
              <Icons.doc size={24} color={theme.gold} stroke={1.6} />
              <Text
                style={{
                  fontSize: 14,
                  color: theme.ink,
                  marginTop: 10,
                  lineHeight: 16,
                  fontFamily: TYPO.weights.semibold,
                }}
              >
                Documents{'\n'}véhicule
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 6, fontFamily: TYPO.weights.medium }}>
                Carte grise · CT · assurance
              </Text>
            </Pressable>
          </View>
        ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => nav.navigate('ServicePicker')}
            style={({ pressed }) => ({
              flex: 1.4,
              borderWidth: 1,
              borderColor: theme.navy,
              backgroundColor: pressed ? theme.navyDeep : theme.navy,
              padding: 16,
              borderRadius: RADII.xxl,
              overflow: 'hidden',
              position: 'relative',
            })}
          >
            <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.12 }}>
              <Icons.bolt size={90} color={theme.gold} stroke={1.5} />
            </View>
            <Text
              style={{
                fontSize: 11.5,
                color: theme.gold,
                letterSpacing: 0.9,
                textTransform: 'uppercase',
                fontFamily: TYPO.weights.semibold,
              }}
            >
              Nouvelle demande
            </Text>
            <Text
              style={{
                fontFamily: TYPO.weights.bold,
                fontSize: 24,
                lineHeight: 24 * 1.05,
                marginTop: 6,
                color: '#F5F1E8',
                letterSpacing: -0.2,
              }}
            >
              Convoyer ou expédier
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.65)', marginTop: 10, fontFamily: TYPO.weights.medium }}>
              4 services · prix affiché tout de suite
            </Text>
          </Pressable>
          <Pressable
            onPress={() => nav.getParent()?.navigate('AppTabs', { screen: 'Documents' } as never)}
            style={({ pressed }) => ({
              flex: 1,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: pressed ? theme.bgSoft : theme.surface,
              padding: 16,
              borderRadius: RADII.xxl,
            })}
          >
            <Icons.doc size={24} color={theme.gold} stroke={1.6} />
            <Text
              style={{
                fontSize: 14,
                color: theme.ink,
                marginTop: 10,
                lineHeight: 16,
                fontFamily: TYPO.weights.semibold,
              }}
            >
              Documents{'\n'}& factures
            </Text>
            <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 6, fontFamily: TYPO.weights.medium }}>
              {toSign > 0 ? `${toSign} à signer` : 'Tout est à jour'}
            </Text>
          </Pressable>
        </View>
        )}

        {/* Deuxième envoi en cours, s'il y en a un */}
        {secondary ? (
          <Pressable
            onPress={() => nav.navigate('Tracking', { kind: secondary.kind, id: secondary.id, reference: secondary.reference })}
          >
            <Surface padded style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  <Pill tone={secondary.active ? 'gold' : 'good'}>{`● ${secondary.step}`}</Pill>
                </View>
                <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, fontVariant: ['tabular-nums'], flexShrink: 0 }} numberOfLines={1}>
                  {secondary.reference}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.medium, marginBottom: 10 }} numberOfLines={2}>
                {secondary.from} → {secondary.to}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, height: 3, backgroundColor: theme.bgSoft, borderRadius: 2 }}>
                  <View
                    style={{
                      width: `${Math.round(secondary.progress * 100)}%`,
                      height: '100%',
                      backgroundColor: theme.gold,
                      borderRadius: 2,
                    }}
                  />
                </View>
                {secondary.eta ? (
                  <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                    {secondary.etaLabel === 'Arrivée prévue' ? 'Arrivée' : 'Enlèvement'} {secondary.eta}
                  </Text>
                ) : null}
              </View>
            </Surface>
          </Pressable>
        ) : null}

        {/* Aperçu actualités — masqué tant qu'Axis n'a rien publié */}
        {latestNews ? (
          <View>
            <SectionHead
              title="Actualités transport"
              action="Voir tout"
              onAction={() => nav.navigate('News')}
            />
            <Pressable onPress={() => nav.navigate('News')}>
              <Surface padded>
                {latestNews.category ? <Pill tone="gold">{latestNews.category.name}</Pill> : null}
                <Text
                  style={{
                    fontSize: 14.5,
                    color: theme.ink,
                    marginTop: latestNews.category ? 10 : 0,
                    lineHeight: 14.5 * 1.3,
                    fontFamily: TYPO.weights.semibold,
                    letterSpacing: -0.1,
                  }}
                  numberOfLines={3}
                >
                  {latestNews.title}
                </Text>
                {latestNews.publishedAt ? (
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6, fontFamily: TYPO.weights.medium }}>
                    {new Date(latestNews.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </Text>
                ) : null}
              </Surface>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
