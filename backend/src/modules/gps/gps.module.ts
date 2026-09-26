import { Module } from '@nestjs/common';
import { GpsController } from './gps.controller';
import { GpsGateway } from './gps.gateway';
import { GpsService } from './gps.service';

@Module({
  controllers: [GpsController],
  providers: [GpsService, GpsGateway],
  exports: [GpsService, GpsGateway],
})
export class GpsModule {}
