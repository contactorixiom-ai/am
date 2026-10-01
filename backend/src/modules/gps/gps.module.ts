import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GpsController } from './gps.controller';
import { GpsGateway } from './gps.gateway';
import { GpsService } from './gps.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [GpsController],
  providers: [GpsService, GpsGateway],
  exports: [GpsService, GpsGateway],
})
export class GpsModule {}
