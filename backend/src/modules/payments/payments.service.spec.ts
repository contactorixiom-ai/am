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
