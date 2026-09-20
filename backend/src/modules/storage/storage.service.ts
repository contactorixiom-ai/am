import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { randomUUID } from 'crypto';

export interface UploadedFile {
  url: string;
  /** Chemin relatif « dossier/nom », indépendant du domaine de l'API. */
  path: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  size: number;
}

/** Taille maximale d'un fichier uploadé (10 Mo) — protège contre les abus. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];

/** Dossiers de rangement autorisés — mêmes valeurs que le DTO d'upload. */
export const STORAGE_FOLDERS = ['kyc', 'signatures', 'documents', 'avatars', 'misc'] as const;
export type StorageFolder = (typeof STORAGE_FOLDERS)[number];

/** Nom de fichier tel que nous le générons : UUID + extension. Rien d'autre
 *  n'est accepté à la lecture, ce qui exclut toute remontée d'arborescence. */
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[A-Za-z0-9]{1,8})?$/;

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.heic': 'image/heic', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 's3';
  private readonly localPath: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.driver = config.get<'local' | 's3'>('storage.driver', 'local');
    this.localPath = config.get<string>('storage.localPath', './uploads');
    this.publicUrl = config.get<string>('storage.publicUrl', 'http://localhost:3000/uploads');

    if (this.driver === 's3') {
      // Mieux vaut refuser de démarrer que de découvrir le trou au premier
      // upload d'une pièce d'identité.
      throw new Error(
        'STORAGE_DRIVER=s3 : le pilote S3 n\'est pas implémenté. Utilisez le pilote local avec un volume.',
      );
    }

    // Sans volume, le disque du conteneur repart à zéro à chaque
    // déploiement : les pièces KYC déjà transmises deviendraient
    // introuvables. On le dit fort plutôt que de le laisser arriver.
    const onVolume = config.get<boolean>('storage.onVolume', false);
    if (!onVolume && config.get<string>('nodeEnv') === 'production') {
      this.logger.error(
        'Aucun volume de stockage : les fichiers envoyés (pièces KYC, photos) ' +
          'seront perdus au prochain déploiement. Attachez un volume au service, ' +
          'ou définissez STORAGE_LOCAL_PATH vers un disque persistant.',
      );
    }
  }

  /** Emplacement sur disque d'un fichier déjà stocké, après validation. */
  async locate(folder: string, name: string): Promise<{ path: string; mimeType: string; size: number }> {
    if (!(STORAGE_FOLDERS as readonly string[]).includes(folder) || !STORED_NAME.test(name)) {
      throw new NotFoundException('Fichier introuvable');
    }
    const base = resolve(this.localPath);
    const path = resolve(join(base, folder, name));
    // Ceinture et bretelles : le chemin résolu doit rester sous la racine.
    if (!path.startsWith(base) || !existsSync(path)) {
      throw new NotFoundException('Fichier introuvable');
    }
    const info = await stat(path);
    return {
      path,
      mimeType: MIME_BY_EXT[extname(name).toLowerCase()] ?? 'application/octet-stream',
      size: info.size,
    };
  }

  stream(path: string) {
    return createReadStream(path);
  }

  /**
   * Décode un contenu base64 (data URL ou base64 brut) puis stocke le fichier.
   * Valide le type MIME et la taille avant écriture.
   */
  async uploadBase64(
    data: string,
    originalName: string,
    mimeType: string,
    folder = 'misc',
  ): Promise<UploadedFile> {
    if (!this.isAllowedMime(mimeType)) {
      throw new BadRequestException(`Type de fichier non autorisé: ${mimeType}`);
    }

    // Retire un éventuel préfixe data URL (`data:image/jpeg;base64,`).
    const base64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('Contenu base64 invalide');
    }
    if (buffer.length === 0) throw new BadRequestException('Fichier vide');
    if (buffer.length > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('Fichier trop volumineux (max 10 Mo)');
    }

    return this.upload(buffer, originalName, mimeType, folder);
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'misc',
  ): Promise<UploadedFile> {
    if (this.driver === 's3') {
      // TODO: implement S3 upload using @aws-sdk/client-s3
      throw new Error('S3 driver not yet implemented');
    }
    const ext = extname(originalName) || '';
    const storedName = `${randomUUID()}${ext}`;
    const dir = join(this.localPath, folder);
    await mkdir(dir, { recursive: true });
    const fullPath = join(dir, storedName);
    await writeFile(fullPath, buffer);
    this.logger.debug(`Stored file at ${fullPath}`);
    return {
      url: `${this.publicUrl}/${folder}/${storedName}`,
      path: `${folder}/${storedName}`,
      fileName: originalName,
      storedName,
      mimeType,
      size: buffer.length,
    };
  }

  private isAllowedMime(mimeType: string): boolean {
    return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
  }
}
