import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

export interface UploadedFile {
  url: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  size: number;
}

/** Taille maximale d'un fichier uploadé (10 Mo) — protège contre les abus. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];

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
