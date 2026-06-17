import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { Surface } from '../components/Surface';
import { Damage, DamageCode, DAMAGE_META, VehicleDiagram, ViewKey } from '../components/VehicleDiagram';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { generateContractPdf } from '../utils/pdf';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'top', label: 'Dessus' },
  { key: 'left', label: 'Gauche' },
  { key: 'right', label: 'Droite' },
  { key: 'front', label: 'Avant' },
  { key: 'rear', label: 'Arrière' },
];

const FUEL_LEVELS = [
  { v: 0, label: '0' },
  { v: 0.25, label: '¼' },
  { v: 0.5, label: '½' },
  { v: 0.75, label: '¾' },
  { v: 1, label: '1' },
];

const STEPS = ['Véhicule', 'Carrosserie', 'Signatures'];

export function VehicleInspectionScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VehicleInspection'>>();
  const phase = route.params?.phase ?? 'DÉPART';
  const reference = route.params?.reference ?? '2026-2847-FE12';
  const vehicleLabel = route.params?.vehicleLabel ?? 'BMW Série 3 · AX-2847';

  const [step, setStep] = useState(0);

  // Step 1
  const [km, setKm] = useState('');
  const [fuel, setFuel] = useState<number | null>(null);
  const [keys, setKeys] = useState('2');

  // Step 2
  const [view, setView] = useState<ViewKey>('top');
  const [damages, setDamages] = useState<Damage[]>([]);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<Damage | null>(null);

  // Step 3
  const [driverSigned, setDriverSigned] = useState(false);
  const [clientSigned, setClientSigned] = useState(false);
  const driverPad = useRef<SignaturePadHandle>(null);
  const clientPad = useRef<SignaturePadHandle>(null);

  const viewDamages = damages.filter((d) => d.view === view);

  const addDamage = (x: number, y: number) => setPendingPos({ x, y });

  const confirmDamage = (code: DamageCode, withPhoto: boolean) => {
    if (!pendingPos) return;
    setDamages((prev) => [
      ...prev,
      { id: `d${Date.now()}`, view, x: pendingPos.x, y: pendingPos.y, code, photo: withPhoto },
    ]);
    setPendingPos(null);
  };

  const removeDamage = (id: string) => {
    setDamages((prev) => prev.filter((d) => d.id !== id));
    setEditing(null);
  };

  const finish = async () => {
    await generateContractPdf({
      reference,
      copyLabel: 'EXEMPLAIRE\nCLIENT',
      vehicleCategory: 'Berline',
      driverName: 'Karim Diallo',
      clientName: 'Client Axis Import',
      vehicleBrandModel: vehicleLabel.split('·')[0].trim(),
      plate: vehicleLabel.split('·')[1]?.trim(),
      pickupDate: new Date().toLocaleDateString('fr-FR'),
      departureKm: km ? parseInt(km, 10) : undefined,
      departureFuel: (fuel ?? undefined) as 0 | 0.25 | 0.5 | 0.75 | 1 | undefined,
      departureDate: new Date().toLocaleDateString('fr-FR'),
      departureTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      departureObservations: summarizeDamages(damages),
      departureClientSigned: clientSigned,
      departureClientSignedDate: new Date().toLocaleDateString('fr-FR'),
      departureDriverSigned: driverSigned,
      departureDamages: damages.map((d) => ({ view: d.view, x: d.x, y: d.y, code: d.code })),
    });
    notify('État des lieux finalisé', 'Le PV a été généré et téléchargé. Il est envoyé au client et au garage.');
    nav.goBack();
  };

  const canNext =
    step === 0 ? !!km && fuel !== null :
    step === 1 ? true :
    driverSigned && clientSigned;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title={`État des lieux — ${phase}`} subtitle={`${vehicleLabel} · ${reference}`} />

      {/* Stepper */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: i <= step ? theme.gold : theme.bgSoft }} />
            <Text style={{ fontSize: 10.5, color: i === step ? theme.ink : theme.muted, fontFamily: i === step ? TYPO.weights.semibold : TYPO.weights.medium }}>
              {i + 1}. {s}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 24, gap: 14 }}>
        {step === 0 ? (
          <>
            <Surface padded style={{ padding: 16, gap: 14 }}>
              <Field label="Kilométrage" value={km} onChangeText={setKm} keyboardType="numeric" placeholder="48 230" hint="Relevé au compteur" />
              <View>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Niveau de carburant
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {FUEL_LEVELS.map((f) => {
                    const on = fuel === f.v;
                    return (
                      <Pressable
                        key={f.v}
                        onPress={() => setFuel(f.v)}
                        style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: on ? theme.navy : theme.line, backgroundColor: on ? theme.navy : theme.surface, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 16, color: on ? '#F5F1E8' : theme.ink, fontFamily: TYPO.weights.bold }}>{f.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Field label="Nombre de clés remises" value={keys} onChangeText={setKeys} keyboardType="numeric" />
            </Surface>
            <Surface padded style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icons.shield size={20} color={theme.gold} stroke={1.8} />
              <Text style={{ flex: 1, fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
                Toutes les données sont horodatées et géolocalisées pour valeur probante en cas de litige.
              </Text>
            </Surface>
          </>
        ) : step === 1 ? (
          <>
            {/* Sélecteur de vue */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {VIEWS.map((v) => {
                const on = view === v.key;
                const count = damages.filter((d) => d.view === v.key).length;
                return (
                  <Pressable
                    key={v.key}
                    onPress={() => setView(v.key)}
                    style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? theme.select : theme.line, backgroundColor: on ? theme.select : theme.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Text style={{ fontSize: 13, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.medium }}>{v.label}</Text>
                    {count > 0 ? <Text style={{ fontSize: 11, color: on ? theme.selectInk : theme.gold, fontFamily: TYPO.weights.bold }}>{count}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <VehicleDiagram view={view} damages={viewDamages} onAdd={addDamage} onMarkerPress={(id) => setEditing(damages.find((d) => d.id === id) ?? null)} height={280} />

            {/* Légende codes */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(DAMAGE_META) as DamageCode[]).map((c) => (
                <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: DAMAGE_META[c].color, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{c}</Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>{DAMAGE_META[c].label}</Text>
                </View>
              ))}
            </View>

            {/* Liste des dommages */}
            {damages.length > 0 ? (
              <Surface padded style={{ padding: 14 }}>
                <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginBottom: 8 }}>
                  {damages.length} dommage{damages.length > 1 ? 's' : ''} enregistré{damages.length > 1 ? 's' : ''}
                </Text>
                {damages.map((d) => (
                  <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.lineSoft }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: DAMAGE_META[d.code].color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{d.code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{DAMAGE_META[d.code].label}</Text>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                        {VIEWS.find((v) => v.key === d.view)?.label}{d.photo ? ' · 📷 photo' : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeDamage(d.id)} style={{ padding: 6 }}>
                      <Icons.x size={15} color={theme.muted} stroke={2} />
                    </Pressable>
                  </View>
                ))}
              </Surface>
            ) : (
              <Surface padded style={{ padding: 16, alignItems: 'center', gap: 4 }}>
                <Icons.check size={22} color={theme.good} stroke={2.2} />
                <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Aucun dommage signalé</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
                  Touche le schéma pour marquer un point si tu constates un défaut.
                </Text>
              </Surface>
            )}
          </>
        ) : (
          <>
            <SignatureBlock title="Signature du conducteur" who="Karim Diallo" padRef={driverPad} onSign={setDriverSigned} signed={driverSigned} />
            <SignatureBlock title="Signature du client" who="À faire signer au client" padRef={clientPad} onSign={setClientSigned} signed={clientSigned} />
            <Surface padded style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icons.warn size={18} color={theme.gold} stroke={1.8} />
              <Text style={{ flex: 1, fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
                Les deux signatures valident l'état des lieux. Signature électronique conforme eIDAS (UE) n°910/2014, valeur d'une signature manuscrite.
              </Text>
            </Surface>
          </>
        )}
      </ScrollView>

      {/* Footer nav */}
      <View style={{ flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface }}>
        {step > 0 ? (
          <Button kind="outline" size="lg" onPress={() => setStep((s) => s - 1)}>Retour</Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button kind="gold" size="lg" fullWidth disabled={!canNext} onPress={() => setStep((s) => s + 1)} rightIcon={<Icons.arrow size={18} color={theme.navy} stroke={2} />}>
            Continuer
          </Button>
        ) : (
          <Button kind="gold" size="lg" fullWidth disabled={!canNext} onPress={finish} rightIcon={<Icons.check size={18} color={theme.navy} stroke={2.4} />}>
            Finaliser le PV
          </Button>
        )}
      </View>

      {/* Modal choix dommage */}
      <Modal visible={!!pendingPos} transparent animationType="fade" onRequestClose={() => setPendingPos(null)}>
        <Pressable onPress={() => setPendingPos(null)} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderRadius: 20, padding: 18, gap: 14 }}>
            <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>Nature du dommage</Text>
            <View style={{ gap: 8 }}>
              {(Object.keys(DAMAGE_META) as DamageCode[]).map((c) => (
                <View key={c} style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => confirmDamage(c, false)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: DAMAGE_META[c].color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{c}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{DAMAGE_META[c].label}</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDamage(c, true)} style={{ width: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.camera size={18} color={theme.navy} stroke={1.8} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
              Touche 📷 pour joindre une photo au dommage
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal détail marqueur */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable onPress={() => setEditing(null)} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderRadius: 20, padding: 18, gap: 12 }}>
            {editing ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: DAMAGE_META[editing.code].color, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{editing.code}</Text>
                  </View>
                  <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>{DAMAGE_META[editing.code].label}</Text>
                </View>
                <Button kind="outline" size="lg" fullWidth onPress={() => removeDamage(editing.id)} rightIcon={<Icons.x size={16} color={theme.bad} stroke={2} />}>
                  Supprimer ce dommage
                </Button>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SignatureBlock({ title, who, padRef, onSign, signed }: { title: string; who: string; padRef: React.RefObject<SignaturePadHandle>; onSign: (v: boolean) => void; signed: boolean }) {
  const { theme } = useTheme();
  return (
    <Surface padded style={{ padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{title}</Text>
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{who}</Text>
        </View>
        {signed ? <Pill tone="good">✓ Signé</Pill> : null}
      </View>
      <SignaturePad ref={padRef} height={150} onChange={onSign} />
      <Pressable onPress={() => { padRef.current?.clear(); onSign(false); }} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 }}>
        <Icons.x size={14} color={theme.muted} stroke={2} />
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Effacer</Text>
      </Pressable>
    </Surface>
  );
}

function summarizeDamages(damages: Damage[]): string {
  if (damages.length === 0) return 'Aucun dommage constaté. Véhicule en parfait état.';
  const byView: Record<string, string[]> = {};
  damages.forEach((d) => {
    const v = d.view;
    if (!byView[v]) byView[v] = [];
    byView[v].push(`${DAMAGE_META[d.code].label}${d.photo ? ' (photo)' : ''}`);
  });
  const viewLabel: Record<string, string> = { top: 'Dessus', left: 'Gauche', right: 'Droite', front: 'Avant', rear: 'Arrière' };
  return Object.entries(byView).map(([v, list]) => `${viewLabel[v]} : ${list.join(', ')}`).join(' · ');
}
