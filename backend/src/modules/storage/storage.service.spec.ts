import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

function serviceAt(root: string): StorageService {
  const values: Record<string, unknown> = {
    'storage.driver': 'local',
    'storage.localPath': root,
    'storage.publicUrl': 'https://api.example/api/v1/storage/file',
    'storage.onVolume': true,
  };
  const config = { get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback) } as unknown as ConfigService;
  return new StorageService(config);
}

describe('StorageService.removeByUrl', () => {
  const root = mkdtempSync(join(tmpdir(), 'axis-storage-'));
  const name = '0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
  const storage = serviceAt(root);

  beforeEach(() => {
    mkdirSync(join(root, 'kyc'), { recursive: true });
    writeFileSync(join(root, 'kyc', name), 'piece-identite');
  });

  it('efface la pièce d\'identité désignée par son URL', async () => {
    await expect(storage.removeByUrl(`https://api.example/api/v1/storage/file/kyc/${name}`)).resolves.toBe(true);
    expect(existsSync(join(root, 'kyc', name))).toBe(false);
  });

  it('ignore une URL étrangère, un dossier inconnu ou un nom piégé', async () => {
    await expect(storage.removeByUrl('https://ailleurs.example/photo.jpg')).resolves.toBe(false);
    await expect(storage.removeByUrl(`https://api.example/api/v1/storage/file/secret/${name}`)).resolves.toBe(false);
    await expect(storage.removeByUrl('https://api.example/api/v1/storage/file/kyc/..%2F..%2Fetc%2Fpasswd')).resolves.toBe(false);
    expect(existsSync(join(root, 'kyc', name))).toBe(true);
  });

  it('un fichier déjà absent ne lève pas d\'erreur', async () => {
    await expect(storage.removeByUrl('https://api.example/api/v1/storage/file/kyc/11111111-2222-4333-8444-555555555555.png')).resolves.toBe(false);
  });
});
