// Point d'entrée de l'application.
//
// En version publiée, une erreur JavaScript non rattrapée ferme l'application
// avec le seul message d'Android « Axis Import s'est fermée car elle comporte
// un bug », sans rien d'exploitable. On affiche à la place l'erreur exacte :
// une capture d'écran suffit pour la corriger.
import { registerRootComponent } from 'expo';
import React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';

let lastError = null;
let notify = null;

function describe(error) {
  if (!error) return 'Erreur inconnue';
  const message = error.message || String(error);
  const stack = typeof error.stack === 'string' ? error.stack.split('\n').slice(0, 12).join('\n') : '';
  return stack && !stack.startsWith(message) ? `${message}\n\n${stack}` : stack || message;
}

function record(error) {
  lastError = error;
  if (notify) notify(error);
}

const handlers = global.ErrorUtils;
if (handlers && Platform.OS !== 'web') {
  const previous = handlers.getGlobalHandler();
  handlers.setGlobalHandler((error, isFatal) => {
    if (isFatal) record(error);
    else if (previous) previous(error, isFatal);
  });
}

let App = null;
try {
  App = require('./App').default;
} catch (error) {
  record(error);
}

function CrashScreen({ error }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B2545', paddingTop: 60, paddingHorizontal: 20 }}>
      <Text style={{ color: '#C9A55C', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
        Axis Import a rencontré une erreur
      </Text>
      <Text style={{ color: '#FFFFFF', fontSize: 14, marginBottom: 16 }}>
        Faites une capture de cet écran et envoyez-la à l'équipe Axis Import.
      </Text>
      <ScrollView style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginBottom: 40 }}>
        <Text selectable style={{ color: '#FFFFFF', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
          {`${Platform.OS} ${Platform.Version}\n\n${describe(error)}`}
        </Text>
      </ScrollView>
    </View>
  );
}

function Root() {
  const [error, setError] = React.useState(lastError);
  React.useEffect(() => {
    notify = setError;
    if (lastError) setError(lastError);
    return () => { notify = null; };
  }, []);
  if (error || !App) return <CrashScreen error={error} />;
  return <App />;
}

registerRootComponent(Root);
