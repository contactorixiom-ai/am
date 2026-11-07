import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DIRECTORY_SEGMENTS, DirectorySegment } from '../users.service';

/** Recherche dans l'annuaire : nom, e-mail, téléphone, société, SIRET. */
export class DirectoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DIRECTORY_SEGMENTS })
  @IsOptional()
  @IsIn(DIRECTORY_SEGMENTS)
  segment?: DirectorySegment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** Convoyeurs actifs, filtrables par ville de rattachement. */
export class DriverQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
