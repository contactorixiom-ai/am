import { Module } from '@nestjs/common';
import { StaffSpaceController } from './staff-space.controller';
import { StaffSpaceService } from './staff-space.service';

@Module({
  controllers: [StaffSpaceController],
  providers: [StaffSpaceService],
  exports: [StaffSpaceService],
})
export class StaffSpaceModule {}
