import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

function service(allowSimulation: boolean) {
  const values: Record<string, unknown> = { 'stripe.currency': 'eur', 'stripe.allowSimulation': allowSimulation };
  const config = { get: (k: string, d?: unknown) => values[k] ?? d } as unknown as ConfigService;
  const prisma = {
    payment: { create: jest.fn().mockResolvedValue({}) },
    mission: { findFirst: jest.fn().mockResolvedValue(null) },
    parcel: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return { svc: new PaymentsService(config, prisma as never, { notify: jest.fn() } as never), prisma };
}

const input = {
  amountCents: 12000,
  successUrl: 'https://app/ok?s={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://app/ko',
};

describe('PaymentsService sans clé Stripe', () => {
  it('refuse de simuler un paiement en production', async () => {
    const { svc, prisma } = service(false);
    await expect(svc.createCheckoutSession('client-1', input)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('simule en développement', async () => {
    const { svc } = service(true);
    await expect(svc.createCheckoutSession('client-1', input)).resolves.toMatchObject({ provider: 'simulation' });
  });
});

describe('Numérotation des factures', () => {
  it('attribue des numéros consécutifs, une seule fois par paiement', async () => {
    const payments: Record<string, { invoiceNumber: string | null; paidAt: Date }> = {
      a: { invoiceNumber: null, paidAt: new Date('2026-10-01') },
      b: { invoiceNumber: null, paidAt: new Date('2026-10-02') },
    };
    const seq: Record<number, number> = { 2026: 41 };
    const tx = {
      payment: {
        findUnique: async ({ where }: { where: { id: string } }) => payments[where.id],
        update: async ({ where, data }: { where: { id: string }; data: { invoiceNumber: string } }) => {
          payments[where.id].invoiceNumber = data.invoiceNumber;
        },
      },
      invoiceSequence: {
        upsert: async ({ where }: { where: { year: number } }) => {
          seq[where.year] = (seq[where.year] ?? 0) + 1;
          return { year: where.year, last: seq[where.year] };
        },
      },
    };
    const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
    const config = { get: (_k: string, d?: unknown) => d } as unknown as ConfigService;
    const svc = new PaymentsService(config, prisma as never, { notify: jest.fn() } as never);
    const assign = (id: string) => (svc as unknown as { assignInvoiceNumber(id: string): Promise<string> }).assignInvoiceNumber(id);

    expect(await assign('a')).toBe('FA-2026-000042');
    expect(await assign('b')).toBe('FA-2026-000043');
    expect(await assign('a')).toBe('FA-2026-000042');
    expect(seq[2026]).toBe(43);
  });
});
