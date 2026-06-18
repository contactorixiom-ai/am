import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { KycController } from './kyc/kyc.controller';
import { KycService } from './kyc/kyc.service';
import { SignaturesController } from './signatures/signatures.controller';
import { SignaturesService } from './signatures/signatures.service';

@Module({
  controllers: [UsersController, KycController, SignaturesController],
  providers: [UsersService, KycService, SignaturesService],
  exports: [UsersService, KycService],
})
export class UsersModule {}
