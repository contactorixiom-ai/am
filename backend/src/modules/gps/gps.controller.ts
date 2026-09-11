import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TrackLocationDto } from './dto/track-location.dto';
import { GpsGateway } from './gps.gateway';
import { GpsService } from './gps.service';

@ApiTags('gps')
@ApiBearerAuth()
@Controller('missions/:missionId/gps')
export class GpsController {
  constructor(
    private readonly gps: GpsService,
    private readonly gateway: GpsGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Convoyeur : envoyer un point GPS' })
  async track(
    @Param('missionId', new ParseUUIDPipe()) missionId: string,
    @CurrentUser('id') driverId: string,
    @Body() dto: TrackLocationDto,
  ) {
    const point = await this.gps.track(missionId, driverId, dto);
    this.gateway.broadcastLocation(missionId, point);
    return point;
  }

  @Get('latest')
  @ApiOperation({ summary: 'Dernière position connue' })
  latest(@Param('missionId', new ParseUUIDPipe()) missionId: string) {
    return this.gps.latest(missionId);
  }

  @Get('trail')
  @ApiOperation({ summary: 'Historique des positions (trace)' })
  trail(@Param('missionId', new ParseUUIDPipe()) missionId: string) {
    return this.gps.trail(missionId);
  }
}
