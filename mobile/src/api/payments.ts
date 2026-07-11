import { apiFetch } from './client';

// Paiement via Stripe Checkout (cartes + Apple Pay + Google Pay + Link).
// Le backend crée la session ; l'app redirige vers la page hébergée Stripe,
// puis vérifie le statut au retour. En l'absence de clé Stripe côté serveur,
// le backend répond en mode « simulation » (aucun débit) et l'app finalise
// directement — le parcours reste démontrable.

export interface CheckoutSession {
  provider: 'stripe' | 'simulation';
  configured: boolean;
  id: string;
  url: string | null;
}

export interface PaymentSessionStatus {
  id: string;
  provider: 'stripe' | 'simulation';
  paid: boolean;
  status: string;
  amountTotal?: number | null;
  currency?: string | null;
}

export interface CreateCheckoutInput {
  amountCents: number;
  currency?: string;
  reference?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
  return apiFetch<CheckoutSession>('/payments/checkout-session', { method: 'POST', body: input });
}

export async function getPaymentSession(id: string): Promise<PaymentSessionStatus> {
  return apiFetch<PaymentSessionStatus>(`/payments/session/${encodeURIComponent(id)}`);
}

export async function getPaymentsConfig(): Promise<{ configured: boolean }> {
  return apiFetch<{ configured: boolean }>('/payments/config', { skipAuth: true });
}
