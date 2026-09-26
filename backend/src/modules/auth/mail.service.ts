import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envoi d'e-mails transactionnels via l'API HTTP de Resend.
 * Facultatif : sans RESEND_API_KEY, rien n'est envoyé et l'appelant se
 * rabat sur un lien que l'administrateur transmet lui-même.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('mail.resendApiKey'));
  }

  /** Renvoie true si le message a été accepté par le fournisseur. */
  async send(message: MailMessage): Promise<boolean> {
    const apiKey = this.config.get<string>('mail.resendApiKey');
    if (!apiKey) return false;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.config.get<string>('mail.from'),
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Envoi d'e-mail refusé (${res.status}) : ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Envoi d'e-mail impossible : ${(err as Error).message}`);
      return false;
    }
  }
}
