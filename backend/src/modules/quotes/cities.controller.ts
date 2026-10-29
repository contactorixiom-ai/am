import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { listCities } from '../../common/geocoding';
import { searchPlaces } from '../../common/place-search';
import { searchAddresses } from '../../common/address-search';

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

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60 * 1000 } })
  @Get('addresses')
  @ApiOperation({ summary: 'Adresses suggérées pendant la saisie (numéro et rue)' })
  addresses(@Query('q') q = '', @Query('country') country?: string, @Query('city') city?: string) {
    return searchAddresses(String(q).slice(0, 120), country ? String(country) : undefined, city ? String(city).slice(0, 80) : undefined);
  }
}
