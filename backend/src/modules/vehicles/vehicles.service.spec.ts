import { ConflictException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

function service(existing: { id: string; ownerId: string } | null) {
  const prisma = {
    vehicle: {
      findFirst: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
    },
  };
  return { svc: new VehiclesService(prisma as never), prisma };
}

const dto = { make: 'Peugeot', model: '308', year: 2019, licensePlate: 'AB-123-CD', registrationCountry: 'FR' } as never;

describe('VehiclesService.create', () => {
  it('crée la fiche d\'un nouveau véhicule', async () => {
    const { svc, prisma } = service(null);
    const v = await svc.create('client-1', dto);
    expect(v.id).toBe('new');
    expect(prisma.vehicle.create).toHaveBeenCalled();
  });

  it('reprend la fiche du même client (deuxième convoyage, commande relancée)', async () => {
    const { svc, prisma } = service({ id: 'v1', ownerId: 'client-1' });
    const v = await svc.create('client-1', dto);
    expect(v.id).toBe('v1');
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
    expect(prisma.vehicle.update.mock.calls[0][0].data.deletedAt).toBeNull();
  });

  it('refuse le véhicule d\'un autre client, avec un message clair', async () => {
    const { svc } = service({ id: 'v1', ownerId: 'client-2' });
    await expect(svc.create('client-1', dto)).rejects.toThrow(ConflictException);
  });
});
