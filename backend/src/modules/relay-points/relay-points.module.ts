import { Module } from '@nestjs/common';
import { RelayPointsController } from './relay-points.controller';
import { RelayPointsService } from './relay-points.service';

@Module({
  controllers: [RelayPointsController],
  providers: [RelayPointsService],
  exports: [RelayPointsService],
})
export class RelayPointsModule {}
