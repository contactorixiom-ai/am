import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
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
  createCheckout(@Body() dto: CreateCheckoutDto) {
    return this.payments.createCheckoutSession(dto);
  }

  @ApiBearerAuth()
  @Get('session/:id')
  @ApiOperation({ summary: 'Statut de paiement d\'une session Checkout' })
  getSession(@Param('id') id: string) {
    return this.payments.getSession(id);
  }
}
