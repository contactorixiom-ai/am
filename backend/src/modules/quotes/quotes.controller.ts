import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Calculer un devis (anonyme ou connecté)' })
  create(@Body() dto: CreateQuoteDto, @Req() req: Request) {
    const user = req.user as AuthenticatedUser | undefined;
    return this.quotes.create(dto, user);
  }

  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({ summary: 'Mes devis sauvegardés' })
  async listMine(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    const { data, total } = await this.quotes.listMine(userId, pagination.skip, pagination.take);
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un devis par id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    const user = req.user as AuthenticatedUser | undefined;
    return this.quotes.findOne(id, user);
  }
}
