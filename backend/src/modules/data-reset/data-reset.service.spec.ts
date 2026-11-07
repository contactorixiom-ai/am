import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataResetService } from './data-reset.service';

function prismaMock(doneAt: Date | null) {
  const model = () => ({ count: jest.fn().mockResolvedValue(2), deleteMany: jest.fn().mockReturnValue('del'), findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockReturnValue('upd') });
  const names = ['mission', 'parcel', 'quote', 'payment', 'document', 'inspection', 'conversation', 'notification', 'adminDocument', 'vehicle',
    'invoiceSequence', 'review', 'call', 'message', 'conversationParticipant', 'inspectionPhoto', 'missionLocation', 'missionStatusHistory',
    'quoteOption', 'cargoTrackingNote', 'parcelTrackingEvent', 'parcelItem', 'vehiclePhoto', 'documentSequence', 'driverProfile'];
  const p: Record<string, any> = Object.fromEntries(names.map((n) => [n, model()]));
  p.mission.groupBy = jest.fn().mockResolvedValue([]); p.review.groupBy = jest.fn().mockResolvedValue([]);
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

  describe('suppression ciblée (à tout moment)', () => {
    it('exige « EFFACER » et au moins une opération', async () => {
      const svc = new DataResetService(prismaMock(null) as any, storage as any);
      await expect(svc.deleteOperations('admin', 'oui', { missionIds: ['m1'] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.deleteOperations('admin', 'EFFACER', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reste disponible après la remise à zéro et ne touche qu\'aux opérations cochées', async () => {
      const p = prismaMock(new Date('2026-10-28'));
      p.mission.findMany = jest.fn()
        .mockResolvedValueOnce([{ id: 'm1', reference: 'AXI-1', vehicleId: 'v1', driverId: null }])
        .mockResolvedValue([]);
      p.payment.findMany = jest.fn().mockResolvedValue([{ id: 'pay1', invoiceNumber: 'FA-2026-000009', status: 'PAID' }]);
      const svc = new DataResetService(p as any, storage as any);
      const res = await svc.deleteOperations('admin', 'effacer', { missionIds: ['m1'] });
      expect(res.deleted).toEqual(['AXI-1']);
      expect(res.invoices).toEqual(['FA-2026-000009']);
      expect(p.mission.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['m1'] } } });
      // Rien d'autre n'est vidé : ni devis, ni numérotation des factures.
      expect(p.quote.deleteMany).not.toHaveBeenCalled();
      expect(p.invoiceSequence.deleteMany).not.toHaveBeenCalled();
      expect(p.auditLog.create).toHaveBeenCalled();
    });
  });
});
