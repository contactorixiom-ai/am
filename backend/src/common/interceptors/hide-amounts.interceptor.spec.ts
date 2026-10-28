import { stripAmounts } from './hide-amounts.interceptor';

describe('stripAmounts', () => {
  it('retire prix et montants, garde les valeurs douanières', () => {
    const date = new Date();
    const out = stripAmounts({
      data: [{ reference: 'AXP-1', priceCents: 4500, pickupFeeCents: 0, declaredValueCents: 30000, createdAt: date,
        payments: [{ amountCents: 4500, status: 'PAID' }], items: [{ valueCents: 100 }] }],
      values: { amountEur: '45', clientName: 'X' },
      total: 1,
    }) as any;
    expect(out.data[0]).toEqual({ reference: 'AXP-1', declaredValueCents: 30000, createdAt: date, payments: [{ status: 'PAID' }], items: [{ valueCents: 100 }] });
    expect(out.values).toEqual({ clientName: 'X' });
    expect(out.total).toBe(1);
  });
});
