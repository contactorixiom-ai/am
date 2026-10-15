import { assertProductionSecrets } from './assert-secrets';

const strong = (c: string) => c.repeat(48);

describe('assertProductionSecrets', () => {
  it('ne contrôle rien hors production', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('refuse de démarrer sans clés en production', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET n'est pas défini/);
  });

  it('refuse les valeurs d\'exemple', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: 'change-me', JWT_REFRESH_SECRET: 'change-me-too' }),
    ).toThrow(/valeur d'exemple/);
  });

  it('refuse les clés trop courtes', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: 'abc', JWT_REFRESH_SECRET: 'def' }),
    ).toThrow(/moins de 32 caractères/);
  });

  it('refuse deux clés identiques', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: strong('x'), JWT_REFRESH_SECRET: strong('x') }),
    ).toThrow(/identiques/);
  });

  it('démarre avec deux clés longues et distinctes', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: strong('a'), JWT_REFRESH_SECRET: strong('b') }),
    ).not.toThrow();
  });
});
