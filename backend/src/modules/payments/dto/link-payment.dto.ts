import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class LinkPaymentDto {
  @ApiPropertyOptional({ description: 'Convoyage créé après le règlement du devis.' })
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiPropertyOptional({ description: 'Colis créé après le règlement du devis.' })
  @IsOptional()
  @IsUUID()
  parcelId?: string;
}
