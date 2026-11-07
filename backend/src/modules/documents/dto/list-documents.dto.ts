import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Les filtres vivent dans le même DTO que la pagination : la validation
 * globale est en `forbidNonWhitelisted`, donc tout paramètre déclaré ailleurs
 * est rejeté — c'est ce qui rendait `?category=` et `?missionId=` inutilisables.
 */
export class ListDocumentsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parcelId?: string;
}
