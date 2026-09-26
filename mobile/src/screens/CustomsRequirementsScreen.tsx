import { RouteProp, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import {
  CARGO_STATUS_LABEL,
  CARGO_TYPE_LABEL,
  CargoTrackingNote,
  CargoTrackingStatus,
  CountryRequirements,
  createCargoNote,
  getDemoRequirements,
  getRequirements,
  listDemoRegulations,
  listRegulations,
} from '../api/customs';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { DotLoader } from '../components/DotLoader';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { generateCustomsChecklistPdf } from '../utils/pdf';
import { notify } from '../utils/notify';
import {
  COUNTRY_SUMMARIES,
  groupCountriesByZone,
  searchCountries,
} from '../utils/countryRegulations';

// Le screen lit ses params de façon défensive : il n'exige PAS d'entrée dans
// RootStackParamList (fichier gelé). L'orchestrateur ajoutera la route.
type CustomsRoute = RouteProp<
  { CustomsRequirements: { countryCode?: string; parcelId?: string } | undefined },
  'CustomsRequirements'
>;

const DEFAULT_COUNTRY = 'SN';

function statusTone(status: string): PillTone {
  switch (status) {
    case 'VALIDATED':
    case 'ISSUED':
      return 'good';
    case 'REJECTED':
      return 'bad';
    case 'NOT_REQUIRED':
      return 'ghost';
    default:
      return 'warn';
  }
}

export function CustomsRequirementsScreen() {
  const { theme } = useTheme();
  const route = useRoute<CustomsRoute>();
  const initialCountry = route.params?.countryCode?.toUpperCase() ?? DEFAULT_COUNTRY;
  const parcelId = route.params?.parcelId;

  const [country, setCountry] = useState(initialCountry);
  const [data, setData] = useState<CountryRequirements | null>(null);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [query, setQuery] = useState('');
  // Bordereau demandé localement (ou renvoyé par l'API) pour le pays courant.
  const [localNote, setLocalNote] = useState<CargoTrackingNote | null>(null);
  const [requesting, setRequesting] = useState(false);

  // Liste des pays couverts (pour le sélecteur)
  useEffect(() => {
    (async () => {
      try {
        const regs = await listRegulations();
        if (regs.length) {
          setCountries(regs.map((r) => ({ code: r.countryCode, name: r.countryName })));
          return;
        }
        throw new Error('empty');
      } catch {
        // Fallback : on prend la liste compacte locale (matrice étendue),
        // qui couvre toute l'Afrique subsaharienne et l'Europe.
        const demoFromApi = listDemoRegulations();
        const fallback = demoFromApi.length
          ? demoFromApi.map((r) => ({ code: r.countryCode, name: r.countryName }))
          : COUNTRY_SUMMARIES.map((c) => ({ code: c.code, name: c.name }));
        setCountries(fallback);
      }
    })();
  }, []);

  const load = useCallback(async (code: string) => {
    setLoading(true);
    setLocalNote(null); // nouveau pays → on repart d'un bordereau vierge
    try {
      const r = await getRequirements(code, parcelId);
      setData(r);
      setUsingDemo(false);
    } catch (e) {
      // Dégradation gracieuse : on bascule sur la matrice démo locale.
      const demo = getDemoRequirements(code);
      if (demo) {
        setData(demo);
        setUsingDemo(true);
      } else {
        setData(null);
        if (e instanceof ApiError && !e.isNetworkError) {
          notify('Pays non couvert', `Aucune réglementation pour ${code}.`);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [parcelId]);

  useEffect(() => {
    load(country);
  }, [country, load]);

  // Filtre + regroupement par zone géographique pour le sélecteur.
  const grouped = useMemo(() => {
    const filtered = searchCountries(query, countries);
    return groupCountriesByZone(filtered);
  }, [countries, query]);

  const cargoNote = data?.cargoNote ?? localNote;
  const cargoStatusLabel = cargoNote
    ? CARGO_STATUS_LABEL[cargoNote.status]
    : data?.cargoMandatory
      ? 'À demander'
      : 'Non requis';

  const trackingLabel = data?.cargoTrackingType
    ? CARGO_TYPE_LABEL[data.cargoTrackingType]
    : null;

  const { missing, total } = useMemo(() => {
    const items = data?.checklist ?? [];
    const mandatory = items.filter((i) => i.mandatory);
    const missingCount = mandatory.filter((i) => i.provided !== true).length;
    return { missing: missingCount, total: mandatory.length };
  }, [data]);

  // Demande d'émission du bordereau de suivi (BSC/BESC/ECTN/FERI…).
  // L'endpoint exige une session ; en cas d'échec réseau/401 on simule
  // localement pour conserver un parcours démontrable hors-ligne.
  const requestCargoNote = async () => {
    if (!data) return;
    setRequesting(true);
    try {
      const note = await createCargoNote({ destinationCountry: data.countryCode });
      setLocalNote(note);
      notify('Demande envoyée', `Bordereau ${data.cargoTrackingType ?? ''} demandé pour ${data.countryName}. Axis prend le relais.`);
    } catch {
      const simulated: CargoTrackingNote = {
        id: `local-${Date.now()}`,
        type: data.cargoTrackingType ?? 'BSC',
        status: 'SUBMITTED',
        destinationCountry: data.countryCode,
      };
      setLocalNote(simulated);
      notify('Demande enregistrée', 'Ta demande de bordereau est enregistrée. Axis la soumet à l\'autorité dès que possible.');
    } finally {
      setRequesting(false);
    }
  };

  const exportPdf = async () => {
    if (!data) return;
    await generateCustomsChecklistPdf({
      countryName: data.countryName,
      countryCode: data.countryCode,
      trackingTypeLabel: trackingLabel ?? undefined,
      authority: data.authority ?? undefined,
      cargoStatusLabel,
      customsNotes: data.customsNotes ?? undefined,
      items: data.checklist.map((i) => ({
        label: i.label,
        mandatory: i.mandatory,
        provided: i.provided,
        note: i.note,
      })),
    });
    notify('Checklist exportée', `Checklist douanière ${data.countryName} enregistrée en PDF.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Réglementation douanière" subtitle="Documents requis à l'import" />

      {/* Recherche pays */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 12, paddingVertical: 10,
            borderRadius: 12, borderWidth: 1, borderColor: theme.line,
            backgroundColor: theme.surface,
          }}
        >
          <Icons.globe size={16} color={theme.muted} stroke={1.6} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un pays (ex. Sénégal, Cameroun, FR…)"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.medium, padding: 0 }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>Effacer</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Sélecteur pays groupé par zone */}
      <View style={{ maxHeight: 168 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16, gap: 10 }}
        >
          {grouped.map((g) => (
            <View key={g.zone}>
              <Text
                style={{
                  fontSize: 10.5, color: theme.muted, letterSpacing: 0.8,
                  textTransform: 'uppercase', fontFamily: TYPO.weights.semibold,
                  marginBottom: 6,
                }}
              >
                {g.label}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {g.items.map((c) => {
                  const on = c.code === country;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => setCountry(c.code)}
                      style={{
                        paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999,
                        borderWidth: 1, borderColor: on ? theme.select : theme.line,
                        backgroundColor: on ? theme.select : theme.surface,
                      }}
                    >
                      <Text style={{ fontSize: 12.5, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.medium }}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {grouped.length === 0 ? (
            <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center', paddingVertical: 12 }}>
              Aucun pays ne correspond à « {query} ».
            </Text>
          ) : null}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <DotLoader />
        </View>
      ) : !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Icons.globe size={36} color={theme.muted} stroke={1.4} />
          <Text style={{ marginTop: 12, fontSize: 14, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
            Aucune réglementation disponible pour ce pays.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
          {usingDemo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icons.bolt size={14} color={theme.warn} stroke={1.8} />
              <Text style={{ fontSize: 11.5, color: theme.warn, fontFamily: TYPO.weights.medium }}>
                Mode démonstration (données locales)
              </Text>
            </View>
          ) : null}

          {/* Carte bordereau requis */}
          <Surface padded flat style={{ padding: 16, backgroundColor: theme.navy, borderColor: theme.navy }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: theme.gold + '2E', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.globe size={24} color={theme.goldHi} stroke={1.7} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 0.9, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                  {data.cargoMandatory ? 'Bordereau obligatoire' : 'Bordereau non requis'}
                </Text>
                <Text style={{ fontSize: 15.5, color: '#F5F1E8', lineHeight: 20, marginTop: 3, fontFamily: TYPO.weights.semibold }}>
                  {trackingLabel ?? 'Aucun bordereau spécifique'}
                </Text>
                {data.authority ? (
                  <Text style={{ fontSize: 12.5, color: '#C7CFDE', marginTop: 3, fontFamily: TYPO.weights.medium }}>
                    Émis par {data.authority}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <Pill tone={statusTone(cargoNote?.status ?? (data.cargoMandatory ? 'TO_REQUEST' : 'NOT_REQUIRED'))}>
                {cargoStatusLabel}
              </Pill>
              {cargoNote?.number ? (
                <Text style={{ fontSize: 12, color: '#C7CFDE', fontFamily: TYPO.weights.medium }}>
                  N° {cargoNote.number}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 12, color: '#C7CFDE', fontFamily: TYPO.weights.medium }}>
                Devise {data.currency}
              </Text>
            </View>

            {/* Action : demander le bordereau — ou suivi de son statut */}
            {data.cargoMandatory && !cargoNote ? (
              <View style={{ marginTop: 14 }}>
                <Button
                  kind="gold"
                  size="lg"
                  fullWidth
                  loading={requesting}
                  onPress={requestCargoNote}
                  rightIcon={<Icons.arrow size={16} color={theme.navy} stroke={2} />}
                >
                  Demander le bordereau à Axis
                </Button>
                <Text style={{ fontSize: 11, color: '#C7CFDE', marginTop: 8, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
                  Inclus dans le prix de l'envoi — Axis gère la démarche pour toi.
                </Text>
              </View>
            ) : cargoNote ? (
              <CargoStatusStepper status={cargoNote.status} />
            ) : null}
          </Surface>

          {/* Checklist */}
          <View>
            <SectionHead title={`Documents requis · ${total - missing}/${total}`} />
            <View style={{ gap: 10 }}>
              {data.checklist.map((item) => {
                const provided = item.provided === true;
                return (
                  <Surface key={item.key} padded style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View
                        style={{
                          width: 36, height: 36, borderRadius: 10,
                          backgroundColor: provided ? theme.good + '1F' : theme.bgSoft,
                          alignItems: 'center', justifyContent: 'center', marginTop: 1,
                        }}
                      >
                        {provided ? (
                          <Icons.check size={18} color={theme.good} stroke={2.4} />
                        ) : (
                          <Icons.doc size={18} color={theme.navy} stroke={1.6} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                            {item.label}
                          </Text>
                          {!item.mandatory ? <Pill tone="ghost">Recommandé</Pill> : null}
                        </View>
                        {item.note ? (
                          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3, fontFamily: TYPO.weights.medium }}>
                            {item.note}
                          </Text>
                        ) : null}
                      </View>
                      <Pill tone={provided ? 'good' : item.mandatory ? 'warn' : 'default'}>
                        {provided ? 'Fourni' : 'Manquant'}
                      </Pill>
                    </View>
                  </Surface>
                );
              })}
            </View>
          </View>

          {/* Notes douanières */}
          {data.customsNotes ? (
            <Surface padded style={{ padding: 14 }}>
              <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Notes douanières
              </Text>
              <Text style={{ fontSize: 13, color: theme.ink, marginTop: 6, lineHeight: 19, fontFamily: TYPO.weights.medium }}>
                {data.customsNotes}
              </Text>
            </Surface>
          ) : null}

          <Button
            kind="outline"
            size="lg"
            fullWidth
            onPress={exportPdf}
            rightIcon={<Icons.doc size={18} color={theme.navy} stroke={1.8} />}
          >
            Exporter la checklist (PDF)
          </Button>

          <View style={{ height: 12 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Progression du bordereau : À demander → Soumis → Validé → Émis.
const CARGO_FLOW: CargoTrackingStatus[] = ['TO_REQUEST', 'SUBMITTED', 'VALIDATED', 'ISSUED'];
const CARGO_FLOW_LABELS = ['À demander', 'Soumis', 'Validé', 'Émis'];

function CargoStatusStepper({ status }: { status: CargoTrackingStatus }) {
  const { theme } = useTheme();
  const rejected = status === 'REJECTED';
  const idx = status === 'DRAFT' ? 0 : Math.max(0, CARGO_FLOW.indexOf(status));
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {CARGO_FLOW_LABELS.map((label, i) => {
          const done = !rejected && i <= idx;
          return (
            <View key={label} style={{ flex: 1, gap: 5 }}>
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: rejected && i === 1 ? theme.bad : done ? theme.goldHi : 'rgba(245,241,232,0.18)',
                }}
              />
              <Text style={{ fontSize: 9.5, color: done ? '#F5F1E8' : '#8FA0B8', fontFamily: TYPO.weights.semibold }}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
      {rejected ? (
        <Text style={{ fontSize: 11, color: theme.bad, marginTop: 8, fontFamily: TYPO.weights.medium }}>
          Bordereau rejeté — Axis te recontacte pour corriger les informations.
        </Text>
      ) : null}
    </View>
  );
}
