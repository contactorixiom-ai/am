import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DataResetService } from './data-reset.service';

class ResetDto {
  @IsString()
  @MaxLength(20)
  confirmation!: string;
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

  @Post()
  @ApiOperation({ summary: 'Administrateur : effacer toute l\'activité de test (une seule fois)' })
  run(@CurrentUser('id') adminId: string, @Body() dto: ResetDto) {
    return this.reset.reset(adminId, dto.confirmation);
  }
}
