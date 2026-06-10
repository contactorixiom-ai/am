import { Module } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  controllers: [QuotesController, CitiesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
