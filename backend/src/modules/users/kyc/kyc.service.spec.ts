import { KycService } from './kyc.service';

function doc(fileName: string, status: string, day: number) {
  return { id: fileName + day, type: 'DRIVER_LICENSE', fileName, status, createdAt: new Date(2026, 8, day) };
}

describe('KycService.overview — statut global', () => {
  async function statusOf(documents: unknown[]) {
    const prisma = { kycDocument: { findMany: jest.fn().mockResolvedValue(documents) } };
    return (await new KycService(prisma as never, {} as never).overview('u')).status;
  }

  it('un document refusé puis remplacé et validé ne bloque plus le compte', async () => {
    expect(await statusOf([doc('license_front.jpg', 'REJECTED', 1), doc('license_front.jpg', 'APPROVED', 2)])).toBe('APPROVED');
  });

  it('le dernier envoi refusé reste refusé', async () => {
    expect(await statusOf([doc('license_front.jpg', 'APPROVED', 1), doc('license_front.jpg', 'REJECTED', 2)])).toBe('REJECTED');
  });

  it('recto et verso sont des emplacements distincts', async () => {
    expect(await statusOf([doc('license_front.jpg', 'APPROVED', 1), doc('license_back.jpg', 'PENDING', 2)])).toBe('PENDING');
  });
});
