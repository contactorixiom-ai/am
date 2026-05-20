import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un véhicule' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Mes véhicules' })
  async listMine(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    const { data, total } = await this.vehicles.listByOwner(userId, pagination.skip, pagination.take);
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.vehicles.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') userId: string) {
    await this.vehicles.remove(id, userId);
  }
}
