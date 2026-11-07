import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

const base = {
  email: 'marc@exemple.fr',
  password: 'MotDePasseSolide2026',
  firstName: 'Marc',
  lastName: 'Dupont',
};

async function errorsFor(extra: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, { ...base, ...extra });
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('RegisterDto — rôle choisi à l\'inscription', () => {
  it('accepte une inscription sans rôle (client par défaut)', async () => {
    expect(await errorsFor({})).toEqual([]);
  });

  it('accepte le rôle CLIENT', async () => {
    expect(await errorsFor({ role: 'CLIENT' })).toEqual([]);
  });

  it('accepte le rôle DRIVER', async () => {
    expect(await errorsFor({ role: 'DRIVER' })).toEqual([]);
  });

  it('refuse le rôle ADMIN : il ne s\'obtient que par promotion', async () => {
    expect(await errorsFor({ role: 'ADMIN' })).toContain('role');
  });
});
