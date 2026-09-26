import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** E-mails transactionnels (Resend), disponibles dans tous les modules. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
