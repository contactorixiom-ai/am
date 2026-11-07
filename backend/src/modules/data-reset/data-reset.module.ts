import { Module } from '@nestjs/common';
import { DataResetController } from './data-reset.controller';
import { DataResetService } from './data-reset.service';

@Module({
  controllers: [DataResetController],
  providers: [DataResetService],
  exports: [DataResetService],
})
export class DataResetModule {}
