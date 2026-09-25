import { ManualPaymentDto } from './dto/manual-payment.dto';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { LinkPaymentDto } from './dto/link-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Indique si Stripe est configuré côté serveur' })
  config() {
    return { configured: this.payments.configured };
  }

  @ApiBearerAuth()
  @Post('checkout-session')
  @ApiOperation({ summary: 'Crée une session de paiement Stripe Checkout' })
  createCheckout(@CurrentUser('id') userId: string, @Body() dto: CreateCheckoutDto) {
    return this.payments.createCheckoutSession(userId, dto);
  }

  @ApiBearerAuth()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('manual')
  @ApiOperation({ summary: 'Admin : enregistrer un règlement reçu hors application (virement, espèces…)' })
  manual(@CurrentUser('id') adminId: string, @Body() dto: ManualPaymentDto) {
    return this.payments.recordManual(adminId, dto);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Encaissements du mois et restes à encaisser' })
  summary() {
    return this.payments.summary();
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Règlements du client connecté (tous pour un administrateur)' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    const { data, total } = await this.payments.list(user, query.skip, query.take);
    return paginate(data, total, query.page, query.pageSize);
  }

  @ApiBearerAuth()
  @Post('session/:id/link')
  @ApiOperation({ summary: 'Rattache un règlement au convoyage ou au colis créé' })
  link(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LinkPaymentDto,
  ) {
    return this.payments.link(id, user, dto);
  }

  @ApiBearerAuth()
  @Get('session/:id')
  @ApiOperation({ summary: 'Statut de paiement d\'une session Checkout' })
  getSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.getSession(id, user);
  }
}
