import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from '../../modules/auth/dto/register.dto';
import { frenchValidationErrors } from './french-errors';

describe('frenchValidationErrors', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: frenchValidationErrors,
  });

  async function messages(body: unknown): Promise<string[]> {
    try {
      await pipe.transform(body, { type: 'body', metatype: RegisterDto });
      return [];
    } catch (e) {
      return (e as { getResponse(): { message: string[] } }).getResponse().message;
    }
  }

  it('traduit les erreurs courantes', async () => {
    const m = await messages({ email: 'pas-un-email', password: 'court', firstName: 'A', lastName: 'B' });
    expect(m).toContain('E-mail : adresse e-mail invalide.');
    expect(m).toContain('Mot de passe : au moins 8 caractères.');
  });

  it('garde les messages déjà en français et signale les champs inconnus', async () => {
    const m = await messages({
      email: 'a@b.fr', password: 'motdepasse1', firstName: 'A', lastName: 'B', role: 'ADMIN', pirate: 1,
    });
    expect(m).toContain('Seuls les rôles CLIENT et DRIVER sont possibles à l\'inscription.');
    expect(m).toContain('Champ non reconnu : pirate.');
  });
});
