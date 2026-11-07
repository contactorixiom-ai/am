import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DataResetService } from './data-reset.service';

class ResetDto {
  @IsString()
  @MaxLength(20)
  confirmation!: string;

  /** Convoyages réels à garder. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  keepMissionIds?: string[];

  /** Colis / envois réels à garder. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  keepParcelIds?: string[];
}

class DeleteOperationsDto {
  @IsString()
  @MaxLength(20)
  confirmation!: string;

  /** Convoyages de test à supprimer. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  missionIds?: string[];

  /** Colis / envois de test à supprimer. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  parcelIds?: string[];
}

@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin/reset')
export class DataResetController {
  constructor(private readonly reset: DataResetService) {}

  @Get()
  @ApiOperation({ summary: 'Administrateur : ce que la remise à zéro effacerait' })
  preview() {
    return this.reset.preview();
  }

  @Get('operations')
  @ApiOperation({ summary: 'Administrateur : toutes les opérations (choix de celles à garder, export)' })
  operations() {
    return this.reset.operations();
  }

  @Post()
  @ApiOperation({ summary: 'Administrateur : effacer l\'activité de test, sauf les opérations gardées (une seule fois)' })
  run(@CurrentUser('id') adminId: string, @Body() dto: ResetDto) {
    return this.reset.reset(adminId, dto.confirmation, { missionIds: dto.keepMissionIds, parcelIds: dto.keepParcelIds });
  }

  @Post('operations/delete')
  @ApiOperation({ summary: 'Administrateur : supprimer les opérations cochées (et seulement elles), à tout moment' })
  deleteOperations(@CurrentUser('id') adminId: string, @Body() dto: DeleteOperationsDto) {
    return this.reset.deleteOperations(adminId, dto.confirmation, { missionIds: dto.missionIds, parcelIds: dto.parcelIds });
  }
}
