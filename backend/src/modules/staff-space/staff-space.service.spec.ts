import { driverCompliance } from './staff-space.service';

describe('driverCompliance', () => {
  it('exige identité, permis, attestation de droits et carte Vitale', () => {
    const r = driverCompliance([
      { type: 'PASSPORT', status: 'APPROVED' },
      { type: 'DRIVER_LICENSE', status: 'APPROVED' },
      { type: 'HEALTH_INSURANCE_RIGHTS', status: 'PENDING' },
    ]);
    expect(r.complete).toBe(false);
    expect(Object.fromEntries(r.items.map((i) => [i.key, i.status]))).toEqual({
      ID: 'APPROVED', LICENSE: 'APPROVED', HEALTH: 'PENDING', VITALE: 'MISSING',
    });
  });

  it('dossier complet quand les quatre pièces sont validées', () => {
    const r = driverCompliance(
      ['IDENTITY_CARD', 'DRIVER_LICENSE', 'HEALTH_INSURANCE_RIGHTS', 'VITALE_CARD'].map((type) => ({ type, status: 'APPROVED' })),
    );
    expect(r.complete).toBe(true);
  });

  it('une pièce validée l\'emporte sur une ancienne pièce refusée', () => {
    const r = driverCompliance([
      { type: 'VITALE_CARD', status: 'REJECTED' },
      { type: 'VITALE_CARD', status: 'APPROVED' },
    ]);
    expect(r.items.find((i) => i.key === 'VITALE')?.status).toBe('APPROVED');
  });
});
