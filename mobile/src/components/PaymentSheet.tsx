import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { Pill } from './Pill';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

// Faux flux de paiement Stripe / Apple Pay pour la démo.
// 3 étapes : choix moyen → traitement / 3DS → succès.

type Step = 'pick' | 'processing' | 'success';
type Method = 'card' | 'apple_pay' | 'sepa';

interface Props {
  visible: boolean;
  amountEur: number;
  reference?: string;
  description?: string;
  onClose: () => void;
  onPaid: () => void;
}

export function PaymentSheet({ visible, amountEur, reference, description, onClose, onPaid }: Props) {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>('pick');
  const [method, setMethod] = useState<Method>('apple_pay');

  const reset = () => { setStep('pick'); setMethod('apple_pay'); };

  const pay = () => {
    setStep('processing');
    setTimeout(() => setStep('success'), 2200);
  };

  const finish = () => {
    onPaid();
    onClose();
    setTimeout(reset, 400);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, gap: 16 }}>
          {step === 'pick' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                    Paiement sécurisé
                  </Text>
                  <Text style={{ fontSize: 22, color: theme.ink, fontFamily: TYPO.weights.bold, letterSpacing: -0.3, marginTop: 4 }}>
                    {amountEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </Text>
                  {description ? (
                    <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>
                      {description}{reference ? ` · ${reference}` : ''}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={onClose} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.x size={16} color={theme.ink} stroke={2} />
                </Pressable>
              </View>

              <View style={{ gap: 8 }}>
                <MethodRow
                  active={method === 'apple_pay'}
                  onPress={() => setMethod('apple_pay')}
                  label="Apple Pay"
                  sub="Authentification Face ID / Touch ID"
                  icon={<Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}> Pay</Text>}
                />
                <MethodRow
                  active={method === 'card'}
                  onPress={() => setMethod('card')}
                  label="Carte bancaire"
                  sub="Visa, Mastercard, CB · 3D Secure"
                  icon={<Icons.card size={18} color={theme.ink} stroke={1.8} />}
                />
                <MethodRow
                  active={method === 'sepa'}
                  onPress={() => setMethod('sepa')}
                  label="Prélèvement SEPA"
                  sub="Sous 1-2 j ouvrés"
                  icon={<Icons.euro size={18} color={theme.ink} stroke={1.8} />}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: theme.surface2 }}>
                <Icons.shield size={14} color={theme.gold} stroke={1.8} />
                <Text style={{ flex: 1, fontSize: 11.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
                  Paiement traité par Stripe (PCI DSS Level 1) · ta carte n'est jamais stockée par Axis.
                </Text>
              </View>

              <Pressable
                onPress={pay}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: RADII.lg,
                  backgroundColor: method === 'apple_pay' ? '#000' : pressed ? theme.goldDeep : theme.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                })}
              >
                {method === 'apple_pay' ? (
                  <>
                    <Text style={{ color: '#fff', fontSize: 16, fontFamily: TYPO.weights.semibold }}>Payer avec</Text>
                    <Text style={{ color: '#fff', fontSize: 18, fontFamily: TYPO.weights.bold }}> Pay</Text>
                  </>
                ) : (
                  <Text style={{ color: theme.navy, fontSize: 16, fontFamily: TYPO.weights.bold }}>
                    Payer {amountEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </Text>
                )}
              </Pressable>
            </>
          ) : step === 'processing' ? (
            <View style={{ paddingVertical: 30, alignItems: 'center', gap: 18 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: theme.gold, borderTopColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.shield size={26} color={theme.gold} stroke={1.8} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold }}>
                  {method === 'apple_pay' ? 'Authentification Face ID…' : method === 'card' ? '3D Secure en cours…' : 'Validation SEPA…'}
                </Text>
                <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
                  Confirme l'opération auprès de ta banque{'\n'}sans fermer l'app.
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ paddingVertical: 20, alignItems: 'center', gap: 16 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.good + '22', borderWidth: 2, borderColor: theme.good, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.check size={32} color={theme.good} stroke={3} />
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 20, color: theme.ink, fontFamily: TYPO.weights.bold, letterSpacing: -0.3 }}>Paiement confirmé</Text>
                <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
                  {amountEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € débité{reference ? ` pour ${reference}` : ''}
                </Text>
              </View>
              <View style={{ width: '100%', padding: 14, borderRadius: 12, backgroundColor: theme.surface2, gap: 6 }}>
                <RowKv label="Référence Stripe" value={`pi_${Math.random().toString(36).slice(2, 14)}`} />
                <RowKv label="Moyen" value={method === 'apple_pay' ? 'Apple Pay · Visa ••4242' : method === 'card' ? 'Visa ••4242' : 'SEPA FR76 ••3210'} />
                <RowKv label="Date" value={new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} />
              </View>
              <Pressable onPress={finish} style={({ pressed }) => ({ width: '100%', height: 50, borderRadius: RADII.lg, backgroundColor: pressed ? theme.goldDeep : theme.gold, alignItems: 'center', justifyContent: 'center' })}>
                <Text style={{ color: theme.navy, fontSize: 15, fontFamily: TYPO.weights.bold }}>Terminer</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MethodRow({ active, onPress, label, sub, icon }: { active: boolean; onPress: () => void; label: string; sub: string; icon: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: active ? theme.navy : theme.line,
        backgroundColor: pressed ? theme.bgSoft : theme.surface,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{label}</Text>
        <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>{sub}</Text>
      </View>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? theme.navy : theme.line, alignItems: 'center', justifyContent: 'center' }}>
        {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.navy }} /> : null}
      </View>
    </Pressable>
  );
}

function RowKv({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{label}</Text>
      <Text style={{ fontSize: 11.5, color: theme.ink, fontFamily: TYPO.weights.semibold, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{value}</Text>
    </View>
  );
}
