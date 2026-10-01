import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

// Filet de sécurité global : si un écran plante au rendu, on affiche un écran
// de récupération lisible au lieu d'un écran blanc. L'utilisateur peut
// réessayer sans avoir à recharger toute l'app.
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    // On pourra brancher un reporting (Sentry…) ici plus tard.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#0B2545', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(201,165,92,0.2)', borderWidth: 2, borderColor: '#C9A55C', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 34 }}>⚠️</Text>
        </View>
        <Text style={{ color: '#F5F1E8', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
          Une erreur est survenue
        </Text>
        <Text style={{ color: 'rgba(245,241,232,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
          L'écran a rencontré un problème. Tu peux réessayer — tes données sont conservées.
        </Text>
        {this.state.message ? (
          <ScrollView style={{ maxHeight: 120, alignSelf: 'stretch', marginBottom: 20 }}>
            <Text style={{ color: 'rgba(245,241,232,0.5)', fontSize: 11, textAlign: 'center' }}>
              {this.state.message}
            </Text>
          </ScrollView>
        ) : null}
        <Pressable
          onPress={this.reset}
          style={{ backgroundColor: '#C9A55C', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 }}
        >
          <Text style={{ color: '#0B2545', fontSize: 15, fontWeight: '700' }}>Réessayer</Text>
        </Pressable>
        <Pressable
          onPress={() => { if (typeof window !== 'undefined') window.location.reload(); }}
          style={{ marginTop: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: 'rgba(245,241,232,0.7)', fontSize: 13 }}>Recharger l'application</Text>
        </Pressable>
      </View>
    );
  }
}
