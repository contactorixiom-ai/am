// Sur Android et iOS (moteur Hermes), le TextDecoder fourni par Expo ne
// connaît que l'UTF-8. Or jsPDF (via fast-png) crée un décodeur « latin1 »
// dès son chargement : l'erreur levée empêchait l'application de démarrer
// (« l'application comporte un bug »). Les navigateurs, eux, gèrent le latin1,
// d'où une version web qui fonctionnait.
//
// Ce module doit être importé avant tout le reste (première ligne d'App.tsx) :
// il ajoute le latin1 au décodeur existant, sans rien changer pour l'UTF-8.

type DecodeInput = ArrayBuffer | ArrayBufferView | null | undefined;
type DecoderCtor = new (label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean }) => {
  readonly encoding: string;
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;
  decode(input?: DecodeInput, options?: { stream?: boolean }): string;
};

const LATIN1_LABELS = new Set([
  'latin1', 'l1', 'iso-8859-1', 'iso8859-1', 'iso_8859-1', 'iso88591', 'iso-ir-100', 'csisolatin1',
  'windows-1252', 'cp1252', 'x-cp1252', 'cp819', 'ibm819', 'ascii', 'us-ascii', 'ansi_x3.4-1968',
]);

function toBytes(input: DecodeInput): Uint8Array {
  if (input == null) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return new Uint8Array(input);
}

function decodeLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return out;
}

function supportsLatin1(Ctor: DecoderCtor): boolean {
  try {
    new Ctor('latin1');
    return true;
  } catch {
    return false;
  }
}

const g = globalThis as unknown as { TextDecoder?: DecoderCtor };
const Base = g.TextDecoder;

if (Base && !supportsLatin1(Base)) {
  class TextDecoderWithLatin1 {
    readonly encoding: string;
    readonly fatal: boolean;
    readonly ignoreBOM: boolean;
    private readonly inner: InstanceType<DecoderCtor> | null;

    constructor(label: string = 'utf-8', options: { fatal?: boolean; ignoreBOM?: boolean } = {}) {
      const latin1 = LATIN1_LABELS.has(String(label).trim().toLowerCase());
      this.inner = latin1 ? null : new Base!(label, options);
      this.encoding = this.inner ? this.inner.encoding : 'windows-1252';
      this.fatal = this.inner ? this.inner.fatal : !!options.fatal;
      this.ignoreBOM = this.inner ? this.inner.ignoreBOM : !!options.ignoreBOM;
    }

    decode(input?: DecodeInput, options?: { stream?: boolean }): string {
      if (this.inner) return this.inner.decode(input, options);
      return decodeLatin1(toBytes(input));
    }
  }
  g.TextDecoder = TextDecoderWithLatin1 as unknown as DecoderCtor;
}

export {};
