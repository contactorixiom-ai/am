// Conversion devise EUR → devise locale d'arrivée, value-add pour la diaspora.
// Taux indicatifs au 2026-06 — à brancher sur une API de change en prod (ECB, fixer.io).

export interface LocalCurrency {
  code: string;
  symbol: string;
  rate: number;     // 1 EUR = rate * unit
  decimals: number;
}

const TABLE: Record<string, LocalCurrency> = {
  // Franc CFA d'Afrique de l'Ouest (UEMOA)
  SN: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  CI: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  ML: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  BF: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  TG: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  BJ: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  NE: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  GW: { code: 'XOF', symbol: 'FCFA', rate: 655.957, decimals: 0 },

  // Franc CFA d'Afrique centrale (CEMAC) — même valeur faciale
  CM: { code: 'XAF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  GA: { code: 'XAF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  CG: { code: 'XAF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  TD: { code: 'XAF', symbol: 'FCFA', rate: 655.957, decimals: 0 },
  CF: { code: 'XAF', symbol: 'FCFA', rate: 655.957, decimals: 0 },

  // Autres
  CD: { code: 'CDF', symbol: 'FC',   rate: 3050,    decimals: 0 },  // Congo-Kinshasa (taux indicatif)
  GN: { code: 'GNF', symbol: 'FG',   rate: 9300,    decimals: 0 },  // Guinée
  MG: { code: 'MGA', symbol: 'Ar',   rate: 4860,    decimals: 0 },  // Madagascar
  DJ: { code: 'DJF', symbol: 'Fdj',  rate: 192,     decimals: 0 },  // Djibouti
};

export function getLocalCurrency(country: string): LocalCurrency | null {
  return TABLE[country.toUpperCase()] ?? null;
}

export function fmtLocal(eurCents: number, country: string): string | null {
  const curr = getLocalCurrency(country);
  if (!curr) return null;
  const eur = eurCents / 100;
  const local = eur * curr.rate;
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: curr.decimals,
    maximumFractionDigits: curr.decimals,
  }).format(local);
  return `${formatted} ${curr.symbol}`;
}

export function fmtEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
