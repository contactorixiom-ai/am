import { driverCompliance } from './staff-space.service';

const ALL = ['IDENTITY_CARD', 'PROOF_OF_ADDRESS', 'DRIVER_LICENSE', 'BANK_DETAILS', 'VITALE_CARD', 'HEALTH_INSURANCE_RIGHTS', 'SELFIE'];

describe('driverCompliance', () => {
  it('liste les sept pièces obligatoires', () => {
    const r = driverCompliance([
      { type: 'PASSPORT', status: 'APPROVED' },
      { type: 'DRIVER_LICENSE', status: 'APPROVED' },
      { type: 'HEALTH_INSURANCE_RIGHTS', status: 'PENDING' },
    ]);
    expect(r.complete).toBe(false);
    expect(r.canWork).toBe(false);
    expect(Object.fromEntries(r.items.map((i) => [i.key, i.status]))).toEqual({
      ID: 'APPROVED', ADDRESS: 'MISSING', LICENSE: 'APPROVED', RIB: 'MISSING', VITALE: 'MISSING', HEALTH: 'PENDING', SELFIE: 'MISSING',
    });
  });

  it('dossier complet quand toutes les pièces sont validées', () => {
    const r = driverCompliance(ALL.map((type) => ({ type, status: 'APPROVED' })));
    expect(r.complete).toBe(true);
    expect(r.canWork).toBe(true);
  });

  it('peut travailler : identité et permis validés, le reste simplement envoyé', () => {
    const r = driverCompliance(ALL.map((type) => ({ type, status: ['IDENTITY_CARD', 'DRIVER_LICENSE'].includes(type) ? 'APPROVED' : 'PENDING' })));
    expect(r.canWork).toBe(true);
    expect(r.complete).toBe(false);
  });

  it('hébergé : la pièce d\'identité de l\'hébergeant devient obligatoire', () => {
    const docs = [...ALL.map((type) => ({ type, status: 'APPROVED' })), { type: 'HOSTING_CERTIFICATE', status: 'PENDING' }];
    expect(driverCompliance(docs).blocking).toEqual(['Pièce d\'identité de l\'hébergeant']);
    expect(driverCompliance([...docs, { type: 'HOST_IDENTITY', status: 'PENDING' }]).canWork).toBe(true);
  });

  it('une pièce validée l\'emporte sur une ancienne pièce refusée', () => {
    const r = driverCompliance([
      { type: 'VITALE_CARD', status: 'REJECTED' },
      { type: 'VITALE_CARD', status: 'APPROVED' },
    ]);
    expect(r.items.find((i) => i.key === 'VITALE')?.status).toBe('APPROVED');
  });
});
