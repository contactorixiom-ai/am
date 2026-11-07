import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

function service(allowSimulation: boolean) {
  const values: Record<string, unknown> = { 'stripe.currency': 'eur', 'stripe.allowSimulation': allowSimulation };
  const config = { get: (k: string, d?: unknown) => values[k] ?? d } as unknown as ConfigService;
  const mission = { clientId: 'client-1', priceCents: 42756, currency: 'EUR', status: 'PUBLISHED', reference: 'AXI-1', pickupCity: 'Paris', deliveryCity: 'Lyon' };
  const prisma = {
    payment: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'p1', ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    mission: { findUnique: jest.fn().mockResolvedValue(mission) },
    parcel: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockResolvedValue('FA-2026-000001'),
  };
  const mail = { enabled: false, send: jest.fn() };
  return { svc: new PaymentsService(config, prisma as never, { notify: jest.fn() } as never, mail as never), prisma };
}

const input = {
  missionId: 'm1',
  amountCents: 100,
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

  it('facture le prix de la commande, pas le montant envoyé par le téléphone', async () => {
    const { svc, prisma } = service(true);
    await svc.createCheckoutSession('client-1', input);
    expect(prisma.payment.create.mock.calls[0][0].data.amountCents).toBe(42756);
  });

  it('refuse de faire payer deux fois la même commande', async () => {
    const { svc, prisma } = service(true);
    prisma.payment.findFirst.mockResolvedValueOnce({ id: 'deja', status: 'PAID' });
    await expect(svc.createCheckoutSession('client-1', input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige une commande à régler', async () => {
    const { svc } = service(true);
    await expect(svc.createCheckoutSession('client-1', { ...input, missionId: undefined })).rejects.toBeInstanceOf(BadRequestException);
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
    const svc = new PaymentsService(config, prisma as never, { notify: jest.fn() } as never, { enabled: false } as never);
    const assign = (id: string) => (svc as unknown as { assignInvoiceNumber(id: string): Promise<string> }).assignInvoiceNumber(id);

    expect(await assign('a')).toBe('FA-2026-000042');
    expect(await assign('b')).toBe('FA-2026-000043');
    expect(await assign('a')).toBe('FA-2026-000042');
    expect(seq[2026]).toBe(43);
  });
});

describe('PaymentsService avec Stripe', () => {
  function withStripe(error: Record<string, unknown>) {
    const { svc, prisma } = service(false);
    (svc as unknown as { stripe: unknown }).stripe = {
      checkout: { sessions: { create: jest.fn().mockRejectedValue(error), retrieve: jest.fn() } },
    };
    return { svc, prisma };
  }

  it('clé refusée par Stripe : message explicite, pas « une erreur est survenue »', async () => {
    const { svc, prisma } = withStripe({ type: 'StripeAuthenticationError', message: 'Invalid API Key provided' });
    const err = await svc.createCheckoutSession('client-1', input).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toMatch(/STRIPE_SECRET_KEY/);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('compte Stripe incomplet : la raison donnée par Stripe est affichée', async () => {
    const { svc } = withStripe({ type: 'StripeInvalidRequestError', message: 'In order to use Checkout, you must set an account or business name' });
    const err = await svc.createCheckoutSession('client-1', input).catch((e) => e);
    expect(err.message).toMatch(/business name/);
  });

  it('aucun moyen de paiement actif : message en français pour le client', async () => {
    const { svc } = withStripe({ type: 'StripeInvalidRequestError', message: 'No valid payment method types for this Checkout Session.' });
    const err = await svc.createCheckoutSession('client-1', input).catch((e) => e);
    expect(err.message).toMatch(/aucun moyen de paiement/);
  });

  it('aucun moyen de paiement actif : nouvel essai en carte bancaire', async () => {
    const { svc } = service(false);
    const create = jest.fn()
      .mockRejectedValueOnce({ type: 'StripeInvalidRequestError', message: 'No valid payment method types for this Checkout Session.' })
      .mockResolvedValueOnce({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    (svc as unknown as { stripe: unknown }).stripe = { checkout: { sessions: { create, retrieve: jest.fn() } } };
    const res = await svc.createCheckoutSession('client-1', input);
    expect(res.url).toMatch(/checkout\.stripe\.com/);
    expect(create.mock.calls[1][0].payment_method_types).toEqual(['card']);
  });
});
