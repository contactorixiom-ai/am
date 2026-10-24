import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GpsService } from './gps.service';

describe('GpsService.assertCanView', () => {
  const prisma = { mission: { findUnique: jest.fn().mockResolvedValue({ clientId: 'client', driverId: 'driver' }) } };
  const svc = new GpsService(prisma as never);

  it.each([
    ['le client', { id: 'client', role: UserRole.CLIENT }],
    ['le convoyeur affecté', { id: 'driver', role: UserRole.DRIVER }],
    ['Axis', { id: 'roger', role: UserRole.ADMIN }],
  ])('laisse voir la position à %s', async (_l, user) => {
    await expect(svc.assertCanView('m1', user)).resolves.toBeUndefined();
  });

  it.each([
    ['un autre client', { id: 'autre', role: UserRole.CLIENT }],
    ['un autre convoyeur', { id: 'autre', role: UserRole.DRIVER }],
  ])('refuse %s', async (_l, user) => {
    await expect(svc.assertCanView('m1', user)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
