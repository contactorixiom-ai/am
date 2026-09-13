import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { KycService } from './kyc.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

@ApiTags('kyc')
@ApiBearerAuth()
@Controller('users')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('me/kyc')
  @ApiOperation({ summary: 'Déposer un document KYC' })
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitKycDto) {
    return this.kyc.submit(userId, dto);
  }

  @Get('me/kyc')
  @ApiOperation({ summary: 'Lister ses documents KYC + statut global' })
  overview(@CurrentUser('id') userId: string) {
    return this.kyc.overview(userId);
  }

  @Patch('kyc/:id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Approuver ou rejeter un document KYC' })
  review(
    @CurrentUser('id') reviewerId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kyc.review(reviewerId, id, dto);
  }
}
