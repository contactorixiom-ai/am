import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // Placeholder — à brancher sur Stripe / Adyen / Mangopay plus tard.
  async createPaymentIntent(missionId: string, amountCents: number, currency = 'EUR'): Promise<{
    provider: string;
    clientSecret: string;
    amountCents: number;
    currency: string;
    missionId: string;
  }> {
    this.logger.warn(`PaymentsService.createPaymentIntent stubbed — wire Stripe before going live`);
    return {
      provider: 'stub',
      clientSecret: `pi_stub_${missionId}_${Date.now()}`,
      amountCents,
      currency,
      missionId,
    };
  }
}
