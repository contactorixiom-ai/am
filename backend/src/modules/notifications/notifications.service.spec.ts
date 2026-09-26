import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

describe('NotificationsService — push', () => {
  const prisma = {
    notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    pushToken: {
      findMany: jest.fn().mockResolvedValue([
        { id: 't1', token: 'ExponentPushToken[aaa]' },
        { id: 't2', token: 'ExponentPushToken[bbb]' },
        { id: 't3', token: 'jeton-web-inutilisable' },
      ]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
  const fetchMock = jest.fn();

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('envoie aux appareils Expo et oublie ceux qui ont désinstallé l\'application', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: 'ok', id: 'r1' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    });
    const service = new NotificationsService(prisma as never, config);
    await service.notify('u1', 'MISSION_STARTED', 'En route', 'Votre véhicule est parti.', { missionId: 'm1' });
    await new Promise((r) => setImmediate(r));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.map((m: { to: string }) => m.to)).toEqual(['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]']);
    expect(sent[0].data).toMatchObject({ notificationId: 'n1', type: 'MISSION_STARTED', missionId: 'm1' });
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['t2'] } } });
  });

  it('une panne du service de push ne fait pas échouer la notification', async () => {
    fetchMock.mockRejectedValue(new Error('réseau'));
    const service = new NotificationsService(prisma as never, config);
    await expect(service.notify('u1', 'SYSTEM', 'Info', 'Texte')).resolves.toEqual({ id: 'n1' });
  });
});
