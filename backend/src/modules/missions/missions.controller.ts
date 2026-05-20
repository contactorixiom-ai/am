import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateMissionDto } from './dto/create-mission.dto';
import { SearchMissionsDto } from './dto/search-missions.dto';
import { MissionsService } from './missions.service';

class CancelMissionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('missions')
@ApiBearerAuth()
@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une mission de convoyage (DRAFT)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateMissionDto) {
    return this.missions.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister/rechercher les missions visibles par l\'utilisateur' })
  async search(@CurrentUser() user: AuthenticatedUser, @Query() query: SearchMissionsDto) {
    const { data, total } = await this.missions.search(query, user);
    return paginate(data, total, query.page, query.pageSize);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missions.findOne(id, user);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publier la mission (DRAFT -> PUBLISHED)' })
  publish(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') userId: string) {
    return this.missions.publish(id, userId);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Un convoyeur accepte la mission' })
  accept(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') driverId: string) {
    return this.missions.accept(id, driverId);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Démarrer le convoyage (après état des lieux pré-départ)' })
  start(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') driverId: string) {
    return this.missions.start(id, driverId);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: 'Marquer comme livré' })
  deliver(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') driverId: string) {
    return this.missions.deliver(id, driverId);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Le client clôture la mission' })
  complete(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') userId: string) {
    return this.missions.complete(id, userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Annuler la mission' })
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() body: CancelMissionDto,
  ) {
    return this.missions.cancel(id, userId, body.reason);
  }
}
