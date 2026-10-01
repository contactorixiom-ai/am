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

  get replyTo(): string | undefined {
    return this.config.get<string>('mail.replyTo') || undefined;
  }

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
          // Réponses du client : vers une boîte lue par Axis, pas vers no-reply.
          ...(this.config.get<string>('mail.replyTo') ? { reply_to: this.config.get<string>('mail.replyTo') } : {}),
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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Gabarit commun des e-mails : en-tête bleu marine, texte, bouton doré.
 * Mise en page en tableaux et styles en ligne, seuls compris par Gmail,
 * Outlook et les messageries des téléphones.
 */
export function mailLayout(opts: {
  title: string;
  paragraphs: string[];
  rows?: Array<[string, string]>;
  cta?: { label: string; url: string };
  footer?: string;
}): string {
  const p = (t: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#1B2A3D">${t}</p>`;
  const rows = (opts.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;font-size:13px;color:#6B7686;border-bottom:1px solid #EEE7D6">${escapeHtml(k)}</td>` +
        `<td style="padding:8px 0;font-size:14px;color:#0B2545;font-weight:600;text-align:right;border-bottom:1px solid #EEE7D6">${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:#C9A55C;border-radius:10px">` +
      `<a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:700;color:#0B2545;text-decoration:none">${escapeHtml(opts.cta.label)}</a>` +
      `</td></tr></table>`
    : '';
  return (
    `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#F4EFE4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE4;padding:24px 12px"><tr><td align="center">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden">` +
    `<tr><td style="background:#0B2545;padding:22px 28px">` +
    `<div style="font-size:18px;font-weight:700;letter-spacing:0.5px;color:#F5F1E8">AXIS <span style="color:#C9A55C">IMPORT</span></div></td></tr>` +
    `<tr><td style="padding:28px">` +
    `<h1 style="margin:0 0 16px;font-size:21px;line-height:28px;color:#0B2545">${escapeHtml(opts.title)}</h1>` +
    opts.paragraphs.map(p).join('') +
    (rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">${rows}</table>` : '') +
    cta +
    `</td></tr>` +
    `<tr><td style="padding:16px 28px 24px;font-size:12px;line-height:18px;color:#8A93A0">${opts.footer ?? 'Axis Import — convoyage de véhicules et envois France ⇄ Afrique.'}</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}
