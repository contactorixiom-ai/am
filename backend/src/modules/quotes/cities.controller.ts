import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { listCities } from '../../common/geocoding';
import { searchPlaces } from '../../common/place-search';

@ApiTags('quotes')
@Controller('cities')
export class CitiesController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Villes disponibles pour devis (EU + Afrique)' })
  list(@Query('region') region?: 'EU' | 'AFRICA') {
    return listCities(region === 'EU' || region === 'AFRICA' ? region : undefined);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } })
  @Get('search')
  @ApiOperation({ summary: 'Rechercher une commune (France, Europe, Afrique)' })
  search(@Query('q') q = '', @Query('region') region?: string) {
    return searchPlaces(String(q).slice(0, 80), region === 'EU' || region === 'AFRICA' ? region : undefined);
  }
}
