import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParcelStatus } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { AddParcelEventDto } from './dto/parcel-event.dto';
import { ParcelsService } from './parcels.service';

@ApiTags('parcels')
@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcels: ParcelsService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Créer un colis (diaspora)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateParcelDto) {
    return this.parcels.create(userId, dto);
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Mes colis (ou tous, si admin)' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: ParcelStatus,
  ) {
    const { data, total } = await this.parcels.list(user, {
      skip: pagination.skip,
      take: pagination.take,
      status,
    });
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Public()
  @Get('track/:reference')
  @ApiOperation({ summary: 'Suivi public d\'un colis via sa référence' })
  track(@Param('reference') reference: string) {
    return this.parcels.track(reference);
  }

  @ApiBearerAuth()
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.parcels.findOne(id, user);
  }

  @ApiBearerAuth()
  @Post(':id/events')
  @ApiOperation({ summary: 'Ajouter un événement de tracking (admin uniquement)' })
  addEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddParcelEventDto,
  ) {
    return this.parcels.addEvent(id, dto, user);
  }
}
