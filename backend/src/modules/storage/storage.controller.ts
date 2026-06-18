import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UploadFileDto } from './dto/upload-file.dto';
import { StorageService } from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

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
      fileName: result.fileName,
      mimeType: result.mimeType,
      fileSize: result.size,
    };
  }
}
