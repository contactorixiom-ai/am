import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { StorageService } from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Uploader un fichier (base64) et récupérer son URL' })
  async upload(@Body() dto: UploadFileDto) {
    const result = await this.storage.uploadBase64(
      dto.data,
      dto.fileName,
      dto.mimeType,
      dto.folder ?? 'misc',
    );
    return {
      url: result.url,
      path: result.path,
      fileName: result.fileName,
      mimeType: result.mimeType,
      fileSize: result.size,
    };
  }

  /**
   * Relecture d'un fichier stocké. Rien n'exposait ces fichiers jusqu'ici :
   * l'upload renvoyait une URL que personne ne servait.
   *
   * L'accès demande d'être connecté, et une pièce KYC n'est visible que par
   * la personne qui l'a transmise ou par un administrateur — ce sont des
   * documents d'identité, pas des images publiques.
   */
  @Get('file/:folder/:name')
  @ApiOperation({ summary: 'Télécharger un fichier stocké (authentifié)' })
  async file(
    @Param('folder') folder: string,
    @Param('name') name: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const found = await this.storage.locate(folder, name);

    if (folder === 'kyc' && user.role !== UserRole.ADMIN) {
      const owned = await this.prisma.kycDocument.findFirst({
        where: { userId: user.id, fileUrl: { endsWith: `${folder}/${name}` } },
        select: { id: true },
      });
      if (!owned) throw new ForbiddenException('Ce document ne vous appartient pas.');
    }

    res.set({
      'Content-Type': found.mimeType,
      'Content-Length': String(found.size),
      'Cache-Control': 'private, max-age=300',
    });
    return new StreamableFile(this.storage.stream(found.path));
  }
}
