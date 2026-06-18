import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomsService } from './customs.service';
import {
  CreateCargoNoteDto,
  UpdateCargoNoteStatusDto,
} from './dto/cargo-note.dto';
import {
  CreateCountryRegulationDto,
  UpdateCountryRegulationDto,
} from './dto/country-regulation.dto';

@ApiTags('customs')
@Controller('customs')
export class CustomsController {
  constructor(private readonly customs: CustomsService) {}

  // ─── Réglementation par pays ─────────────────────────────────────────────

  @Public()
  @Get('regulations')
  @ApiOperation({ summary: 'Liste des réglementations douanières par pays' })
  listRegulations() {
    return this.customs.listRegulations();
  }

  @Public()
  @Get('requirements/:countryCode')
  @ApiOperation({
    summary: 'Réglementation + checklist des documents requis pour un pays',
  })
  @ApiQuery({ name: 'parcelId', required: false })
  getRequirements(
    @Param('countryCode') countryCode: string,
    @Query('parcelId') parcelId?: string,
  ) {
    return this.customs.getRequirements(countryCode, parcelId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('regulations')
  @ApiOperation({ summary: 'Créer une réglementation pays (admin)' })
  createRegulation(@Body() dto: CreateCountryRegulationDto) {
    return this.customs.createRegulation(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('regulations/seed')
  @ApiOperation({ summary: 'Initialiser la matrice réglementaire pilote (admin)' })
  seed() {
    return this.customs.seedRegulations();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('regulations/:countryCode')
  @ApiOperation({ summary: 'Mettre à jour une réglementation pays (admin)' })
  updateRegulation(
    @Param('countryCode') countryCode: string,
    @Body() dto: UpdateCountryRegulationDto,
  ) {
    return this.customs.updateRegulation(countryCode, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('regulations/:countryCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une réglementation pays (admin)' })
  async deleteRegulation(@Param('countryCode') countryCode: string) {
    await this.customs.deleteRegulation(countryCode);
  }

  // ─── Bordereaux de suivi de cargaison ────────────────────────────────────

  @ApiBearerAuth()
  @Post('cargo-notes')
  @ApiOperation({ summary: 'Créer un bordereau de suivi pour un colis' })
  createCargoNote(@Body() dto: CreateCargoNoteDto) {
    return this.customs.createCargoNote(dto);
  }

  @ApiBearerAuth()
  @Get('cargo-notes')
  @ApiOperation({ summary: 'Lister les bordereaux (filtre par colis)' })
  @ApiQuery({ name: 'parcelId', required: false })
  listCargoNotes(@Query('parcelId') parcelId?: string) {
    return this.customs.listCargoNotes(parcelId);
  }

  @ApiBearerAuth()
  @Patch('cargo-notes/:id/status')
  @ApiOperation({ summary: 'Mettre à jour le statut d\'un bordereau' })
  updateCargoNoteStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCargoNoteStatusDto,
  ) {
    return this.customs.updateCargoNoteStatus(id, dto);
  }
}
