import { ApiPropertyOptional } from '@nestjs/swagger';
import { MissionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class SearchMissionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MissionStatus })
  @IsOptional()
  @IsEnum(MissionStatus)
  status?: MissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;
}
