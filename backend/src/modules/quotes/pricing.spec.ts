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

describe('computeQuote — convoyage, grilles 2026', () => {
  it('particulier : frais de dossier + tarif au km TTC tout inclus', () => {
    const q = computeQuote({ ...base, service: 'CONVOY_CAR', distanceKm: 100, vehicleCategory: 'berline' });
    expect(q.totalCents).toBe(2900 + 100 * 98);
    expect(q.taxCents + q.subtotalCents).toBe(q.totalCents);
    expect(q.lines.map((l) => l.code)).toEqual(['CONVOY_FEE', 'CONVOY_KM']);
  });

  it('particulier : tarif longue distance au-delà de 350 km, sur tout le trajet', () => {
    const q = computeQuote({ ...base, service: 'CONVOY_CAR', distanceKm: 400, vehicleCategory: 'citadine' });
    expect(q.totalCents).toBe(2900 + 400 * 79);
  });

  it('particulier : minimum 69 € TTC sous 50 km', () => {
    const q = computeQuote({ ...base, service: 'CONVOY_CAR', distanceKm: 20, vehicleCategory: 'citadine' });
    expect(q.totalCents).toBe(6900);
  });

  it('professionnel : forfait urbain, régional, puis €/km HT', () => {
    const pro = { ...base, service: 'CONVOY_CAR' as const, customerType: 'PROFESSIONAL' as const };
    expect(computeQuote({ ...pro, distanceKm: 15, vehicleCategory: 'berline' }).subtotalCents).toBe(4500);
    expect(computeQuote({ ...pro, distanceKm: 40, vehicleCategory: 'utilitaire' }).subtotalCents).toBe(7500);
    const long = computeQuote({ ...pro, distanceKm: 300, vehicleCategory: 'suv' });
    expect(long.subtotalCents).toBe(300 * 75);
    expect(long.totalCents).toBe(Math.round(300 * 75 * 1.2));
  });

  it('plateau : forfait ≤ 200 km, paliers au km, jamais moins cher qu\'un trajet plus court', () => {
    const q200 = computeQuote({ ...base, service: 'CONVOY_FLATBED', distanceKm: 150, vehicleCategory: 'citadine' });
    expect(q200.totalCents).toBe(18000);
    const q210 = computeQuote({ ...base, service: 'CONVOY_FLATBED', distanceKm: 210, vehicleCategory: 'citadine' });
    expect(q210.totalCents).toBe(18000); // 210 × 0,68 = 142,80 < 180 : plancher
    const q800 = computeQuote({ ...base, service: 'CONVOY_FLATBED', distanceKm: 800, vehicleCategory: 'berline' });
    expect(q800.totalCents).toBe(800 * 58);
    const pro = computeQuote({ ...base, service: 'CONVOY_FLATBED', distanceKm: 100, vehicleCategory: 'utilitaire', customerType: 'PROFESSIONAL' });
    expect(pro.subtotalCents).toBe(21000);
  });

  it('plateau : véhicule non roulant = colonne hors d\'usage + treuil', () => {
    const q = computeQuote({ ...base, service: 'CONVOY_FLATBED', distanceKm: 100, vehicleCategory: 'berline', options: ['NON_ROLLING'] });
    expect(q.totalCents).toBe(23000 + 4500);
  });
});

describe('computeQuote — voiture vers l\'Afrique (RORO)', () => {
  it('dépôt au port : prix RORO de départ, TTC, sans frais de douane ni minimum', () => {
    const q = computeQuote({ ...base, service: 'MERCHANDISE', flow: 'VEHICLE', items: [{ code: 'RORO_CAR', quantity: 1 }] });
    expect(q.transportMode).toBe('SEA');
    expect(q.totalCents).toBe(115000);
    expect(q.lines.map((l) => l.code)).toEqual(['RORO_CAR']);
    expect(q.disclaimer).toMatch(/1.300/);
  });

  it('convoyage jusqu\'au port : km × tarif du type de véhicule', () => {
    const q = computeQuote({
      ...base, service: 'MERCHANDISE', flow: 'VEHICLE', pickupMode: 'HOME_PICKUP', convoyToPortKm: 200,
      items: [{ code: 'RORO_SUV', quantity: 1 }],
    });
    const convoy = q.lines.find((l) => l.code === 'CONVOY_TO_PORT');
    expect(convoy?.totalCents).toBe(200 * 100);
    expect(q.totalCents).toBe(145000 + 20000);
  });

  it('refuse un convoyage sans distance et un article d\'un autre parcours', () => {
    expect(() => computeQuote({ ...base, service: 'MERCHANDISE', flow: 'VEHICLE', pickupMode: 'HOME_PICKUP', items: [{ code: 'RORO_CAR', quantity: 1 }] }))
      .toThrow(/port/);
    expect(() => computeQuote({ ...base, service: 'MERCHANDISE', flow: 'VEHICLE', items: [{ code: 'PALLET', quantity: 1 }] }))
      .toThrow(/ne se commande pas/);
    expect(() => computeQuote({ ...base, service: 'MERCHANDISE', flow: 'VEHICLE', items: [{ code: 'RORO_CAR', quantity: 6 }] }))
      .toThrow(/devis/);
  });

  it('les véhicules restent hors des parcours colis', () => {
    expect(() => computeQuote({ ...base, service: 'MERCHANDISE', transportMode: 'SEA', items: [{ code: 'RORO_CAR', quantity: 1 }] }))
      .toThrow(/ne se commande pas/);
  });
});

describe('computeQuote — import Afrique → France', () => {
  it('épicerie aérienne : facturée 30 kg minimum', () => {
    const q = computeQuote({ ...base, service: 'PARCEL', flow: 'IMPORT', items: [{ code: 'EXPORT_FOOD_AIR', quantity: 12 }] });
    expect(q.transportMode).toBe('AIR');
    expect(q.lines[0].quantity).toBe(30);
    expect(q.lines[0].label).toContain('minimum 30');
    expect(q.totalCents).toBe(30 * 850);
  });

  it('épicerie au-delà du minimum : au kg réel', () => {
    const q = computeQuote({ ...base, service: 'PARCEL', flow: 'IMPORT', items: [{ code: 'EXPORT_FOOD_AIR', quantity: 45 }] });
    expect(q.totalCents).toBe(45 * 850);
  });

  it('artisanat maritime au m³, avec minimum de perception', () => {
    const q = computeQuote({ ...base, service: 'PARCEL', flow: 'IMPORT', items: [{ code: 'EXPORT_CRAFT_SEA', quantity: 0.3 }] });
    expect(q.transportMode).toBe('SEA');
    expect(q.lines.map((l) => l.code)).toEqual(['EXPORT_CRAFT_SEA', 'MINIMUM']);
    expect(q.totalCents).toBe(9500);
  });

  it('échantillons au forfait ; aérien et maritime pas dans la même commande', () => {
    const q = computeQuote({ ...base, service: 'PARCEL', flow: 'IMPORT', items: [{ code: 'EXPORT_SAMPLES_AIR', quantity: 1 }] });
    expect(q.totalCents).toBe(12000);
    expect(() => computeQuote({
      ...base, service: 'PARCEL', flow: 'IMPORT',
      items: [{ code: 'EXPORT_SAMPLES_AIR', quantity: 1 }, { code: 'EXPORT_CRAFT_SEA', quantity: 1 }],
    })).toThrow(/séparément/);
  });

  it('dépôt chez le correspondant uniquement', () => {
    expect(() => computeQuote({ ...base, service: 'PARCEL', flow: 'IMPORT', pickupMode: 'HOME_PICKUP', items: [{ code: 'EXPORT_SAMPLES_AIR', quantity: 1 }] }))
      .toThrow(/correspondant/);
  });
});
