import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RelayCarrier } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { RelayPointsService } from './relay-points.service';

@ApiTags('relay-points')
@Controller('relay-points')
export class RelayPointsController {
  constructor(private readonly service: RelayPointsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Rechercher des points relais (Mondial Relay, La Poste, hub Axis, etc.)' })
  search(
    @Query('city') city?: string,
    @Query('country') country?: string,
    @Query('carrier') carrier?: RelayCarrier,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.search({
      city,
      country,
      carrier,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
      radiusKm: radius ? parseFloat(radius) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }
}
