import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreateCheckoutInput {
  amountCents: number;
  currency?: string;
  reference?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
}

const SIM_PREFIX = 'cs_sim_';

/**
 * Paiements via Stripe Checkout (cartes + Apple Pay + Google Pay + Link activés
 * automatiquement selon la configuration du compte Stripe). Aucune donnée
 * bancaire ne transite par notre API : Stripe héberge la page de paiement.
 *
 * Tant que STRIPE_SECRET_KEY n'est pas fourni (variable d'environnement Railway),
 * le service tourne en mode SIMULATION : il renvoie directement l'URL de succès,
 * sans aucun débit — l'app reste démontrable de bout en bout.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe | null;
  private readonly defaultCurrency: string;

  constructor(config: ConfigService) {
    const key = config.get<string>('stripe.secretKey');
    this.defaultCurrency = config.get<string>('stripe.currency', 'eur');
    this.stripe = key ? new Stripe(key) : null;
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY absent — paiements en mode SIMULATION (aucun débit réel).',
      );
    }
  }

  get configured(): boolean {
    return this.stripe !== null;
  }

  async createCheckoutSession(input: CreateCheckoutInput) {
    const amount = Math.round(input.amountCents);
    if (!Number.isFinite(amount) || amount < 100) {
      throw new BadRequestException('Montant invalide (minimum 1,00).');
    }
    const currency = (input.currency ?? this.defaultCurrency).toLowerCase();

    if (!this.stripe) {
      // Mode simulation : on renvoie l'URL de succès (aucun débit).
      const id = `${SIM_PREFIX}${Date.now()}`;
      return {
        provider: 'simulation' as const,
        configured: false,
        id,
        url: input.successUrl.replace('{CHECKOUT_SESSION_ID}', id),
      };
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: { name: input.description || 'Commande Axis Import' },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.reference,
      metadata: input.reference ? { reference: input.reference } : undefined,
    });

    return {
      provider: 'stripe' as const,
      configured: true,
      id: session.id,
      url: session.url,
    };
  }

  async getSession(id: string) {
    if (!this.stripe || id.startsWith(SIM_PREFIX)) {
      // Simulation : la session est considérée payée.
      return { id, provider: 'simulation' as const, paid: true, status: 'complete' };
    }
    const s = await this.stripe.checkout.sessions.retrieve(id);
    return {
      id: s.id,
      provider: 'stripe' as const,
      paid: s.payment_status === 'paid',
      status: s.status ?? 'open',
      amountTotal: s.amount_total,
      currency: s.currency,
    };
  }
}
