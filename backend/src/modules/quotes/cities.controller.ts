import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { listCities } from '../../common/geocoding';

@ApiTags('quotes')
@Controller('cities')
export class CitiesController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Villes disponibles pour devis (EU + Afrique)' })
  list(@Query('region') region?: 'EU' | 'AFRICA') {
    return listCities(region === 'EU' || region === 'AFRICA' ? region : undefined);
  }
}
