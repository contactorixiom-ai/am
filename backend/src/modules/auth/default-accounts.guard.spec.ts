import * as argon2 from 'argon2';
import { DefaultAccountsGuard } from './default-accounts.guard';

describe('DefaultAccountsGuard', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  async function run(nodeEnv: string) {
    process.env.NODE_ENV = nodeEnv;
    const published = await argon2.hash('ChangeMe123!');
    const personal = await argon2.hash('UnVraiMotDePasse!');
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', email: 'admin@axisimport.com', passwordHash: published },
          { id: 'b', email: 'roger@axisimport.com', passwordHash: personal },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
    };
    await new DefaultAccountsGuard(prisma as never).onApplicationBootstrap();
    return prisma;
  }

  it('suspend en production le compte au mot de passe publié, et lui seul', async () => {
    const prisma = await run('production');
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { status: 'SUSPENDED' } });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien hors production', async () => {
    const prisma = await run('development');
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
