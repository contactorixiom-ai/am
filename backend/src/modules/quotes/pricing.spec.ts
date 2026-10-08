import { computeQuote } from './pricing';

const base = { options: [] };

describe('computeQuote — grille import-export', () => {
  it('effets personnels en maritime : prix à la pièce + 65 € de douane, TTC', () => {
    const q = computeQuote({
      ...base,
      service: 'PARCEL',
      transportMode: 'SEA',
      items: [{ code: 'DRUM_200', quantity: 2 }, { code: 'CARTON', quantity: 3 }],
    });
    expect(q.totalCents).toBe(2 * 13000 + 3 * 4000 + 6500);
    expect(q.subtotalCents + q.taxCents).toBe(q.totalCents);
    expect(q.lines.map((l) => l.code)).toEqual(['DRUM_200', 'CARTON', 'CUSTOMS_FEE']);
    // Fourchette (carton 40 à 70 €) : prix de départ, ajusté au dépôt.
    expect(q.disclaimer).toContain('70');
    expect(q.uncertaintyPct).toBeNull();
  });

  it('fûts sans fourchette : pas d\'avertissement de prix', () => {
    const q = computeQuote({ ...base, service: 'PARCEL', transportMode: 'SEA', items: [{ code: 'DRUM_100', quantity: 1 }] });
    expect(q.totalCents).toBe(10000 + 6500);
    expect(q.disclaimer).toBeNull();
  });

  it('regroupe les quantités d\'un même article', () => {
    const q = computeQuote({
      ...base, service: 'PARCEL', transportMode: 'SEA',
      items: [{ code: 'BAG', quantity: 1 }, { code: 'BAG', quantity: 2 }],
    });
    const bag = q.lines.find((l) => l.code === 'BAG');
    expect(bag?.quantity).toBe(3);
    expect(bag?.totalCents).toBe(3 * 6000);
  });

  it('refuse un envoi maritime sans contenu', () => {
    expect(() => computeQuote({ ...base, service: 'PARCEL', transportMode: 'SEA' })).toThrow(/fûts, cartons/);
  });

  it('refuse un article qui n\'est pas de ce parcours', () => {
    expect(() => computeQuote({ ...base, service: 'PARCEL', transportMode: 'SEA', items: [{ code: 'PALLET', quantity: 1 }] }))
      .toThrow(/ne se commande pas/);
    expect(() => computeQuote({ ...base, service: 'PARCEL', transportMode: 'SEA', items: [{ code: 'RORO_CAR', quantity: 1 }] }))
      .toThrow(/ne se commande pas/);
    expect(() => computeQuote({ ...base, service: 'PARCEL', transportMode: 'SEA', items: [{ code: 'XXX', quantity: 1 }] }))
      .toThrow(/inconnu/);
  });

  it('refuse les quantités incohérentes', () => {
    expect(() => computeQuote({ ...base, service: 'PARCEL', transportMode: 'SEA', items: [{ code: 'CARTON', quantity: 1.5 }] }))
      .toThrow(/à l'unité/);
    expect(() => computeQuote({ ...base, service: 'PARCEL', transportMode: 'SEA', items: [{ code: 'CARTON', quantity: 51 }] }))
      .toThrow(/devis/);
  });

  it('aérien : 8,50 €/kg avec un minimum de perception de 95 €', () => {
    const small = computeQuote({ ...base, service: 'PARCEL', transportMode: 'AIR', weightKg: 2 });
    expect(small.totalCents).toBe(9500);
    expect(small.lines.map((l) => l.code)).toEqual(['AIR_KG', 'MINIMUM']);
    const big = computeQuote({ ...base, service: 'PARCEL', transportMode: 'AIR', weightKg: 20 });
    expect(big.totalCents).toBe(17000);
    expect(big.lines.map((l) => l.code)).toEqual(['AIR_KG']);
  });

  it('aérien sans poids : refusé', () => {
    expect(() => computeQuote({ ...base, service: 'PARCEL', transportMode: 'AIR' })).toThrow(/poids/);
  });

  it('marchandise maritime : palettes et m³, minimum 95 €', () => {
    const pallet = computeQuote({ ...base, service: 'MERCHANDISE', transportMode: 'SEA', items: [{ code: 'PALLET', quantity: 1 }] });
    expect(pallet.totalCents).toBe(23000);
    expect(pallet.volumeM3).toBe(1.8);
    const small = computeQuote({ ...base, service: 'MERCHANDISE', transportMode: 'SEA', items: [{ code: 'CBM', quantity: 0.4 }] });
    expect(small.totalCents).toBe(9500);
    const m3 = computeQuote({ ...base, service: 'MERCHANDISE', transportMode: 'SEA', items: [{ code: 'CBM', quantity: 2.5 }] });
    expect(m3.totalCents).toBe(45000);
    expect(m3.disclaimer).toContain('230');
  });

  it('enlèvement à domicile : forfait affiché ajouté tel quel', () => {
    const q = computeQuote({
      ...base, service: 'PARCEL', transportMode: 'SEA', pickupMode: 'HOME_PICKUP',
      items: [{ code: 'APPLIANCE', quantity: 1 }],
    });
    expect(q.totalCents).toBe(14000 + 6500 + 2500);
    expect(q.lines.find((l) => l.code === 'PICKUP')?.totalCents).toBe(2500);
  });

  it('décomposition HT / TVA cohérente avec le total', () => {
    for (const cents of [1, 2, 5, 7, 11, 13]) {
      const q = computeQuote({ ...base, service: 'PARCEL', transportMode: 'AIR', weightKg: 12 + cents / 100 });
      expect(q.subtotalCents + q.taxCents).toBe(q.totalCents);
      expect(q.variablePriceCents + q.pickupFeeCents + q.addonsPriceCents).toBe(q.subtotalCents);
    }
  });
});

describe('computeQuote — convoyage (inchangé)', () => {
  it('tarif kilométrique HT + TVA', () => {
    const q = computeQuote({ ...base, service: 'CONVOY_CAR', distanceKm: 100, vehicleCategory: 'berline' });
    expect(q.subtotalCents).toBe(7000);
    expect(q.totalCents).toBe(8400);
    expect(q.lines).toEqual([]);
  });

  it('forfait minimum sous 60 km', () => {
    const q = computeQuote({ ...base, service: 'CONVOY_CAR', distanceKm: 20, vehicleCategory: 'citadine' });
    expect(q.subtotalCents).toBe(4000);
  });
});
