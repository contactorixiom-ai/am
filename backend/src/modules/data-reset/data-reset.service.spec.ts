import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataResetService } from './data-reset.service';

function prismaMock(doneAt: Date | null) {
  const model = () => ({ count: jest.fn().mockResolvedValue(2), deleteMany: jest.fn().mockReturnValue('del'), findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockReturnValue('upd') });
  const names = ['mission', 'parcel', 'quote', 'payment', 'document', 'inspection', 'conversation', 'notification', 'adminDocument', 'vehicle',
    'invoiceSequence', 'review', 'call', 'message', 'conversationParticipant', 'inspectionPhoto', 'missionLocation', 'missionStatusHistory',
    'quoteOption', 'cargoTrackingNote', 'parcelTrackingEvent', 'parcelItem', 'vehiclePhoto', 'documentSequence', 'driverProfile'];
  const p: Record<string, any> = Object.fromEntries(names.map((n) => [n, model()]));
  p.auditLog = { findFirst: jest.fn().mockResolvedValue(doneAt ? { createdAt: doneAt } : null), create: jest.fn().mockReturnValue('log') };
  p.$transaction = jest.fn().mockResolvedValue([]);
  return p;
}

describe('DataResetService', () => {
  const storage = { removeByUrl: jest.fn().mockResolvedValue(true) };

  it('exige la confirmation « EFFACER »', async () => {
    const svc = new DataResetService(prismaMock(null) as any, storage as any);
    await expect(svc.reset('admin', 'oui')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ne s\'exécute qu\'une fois', async () => {
    const svc = new DataResetService(prismaMock(new Date('2026-10-28')) as any, storage as any);
    await expect(svc.reset('admin', 'EFFACER')).rejects.toBeInstanceOf(ConflictException);
  });

  it('efface l\'activité et garde les comptes', async () => {
    const p = prismaMock(null);
    const svc = new DataResetService(p as any, storage as any);
    const res = await svc.reset('admin', 'effacer');
    expect(p.$transaction).toHaveBeenCalledTimes(1);
    expect(p.mission.deleteMany).toHaveBeenCalled();
    expect(p.payment.deleteMany).toHaveBeenCalled();
    expect(p.auditLog.create).toHaveBeenCalled();
    expect(p.user).toBeUndefined();
    expect(res.missions).toBe(2);
  });
});
