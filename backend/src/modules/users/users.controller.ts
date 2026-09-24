import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpsertDriverProfileDto } from './dto/upsert-driver-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Récupérer le profil de l\'utilisateur connecté' })
  me(@CurrentUser('id') userId: string) {
    return this.users.findById(userId);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Exporter ses données personnelles (RGPD)' })
  exportMe(@CurrentUser('id') userId: string) {
    return this.users.exportData(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour son profil' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.users.updateProfile(userId, dto);
  }

  // Exigée par l'App Store (règle 5.1.1(v)) : la suppression du compte doit
  // pouvoir être lancée depuis l'application, pas seulement par courriel.
  @Delete('me')
  @ApiOperation({ summary: 'Supprimer son compte' })
  deleteMe(@CurrentUser('id') userId: string) {
    return this.users.deleteAccount(userId);
  }

  @Put('me/driver-profile')
  @ApiOperation({ summary: 'Créer ou mettre à jour son profil convoyeur' })
  upsertDriver(@CurrentUser('id') userId: string, @Body() dto: UpsertDriverProfileDto) {
    return this.users.upsertDriverProfile(userId, dto);
  }

  @Get('clients')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin : annuaire des clients' })
  async listClients(@Query() pagination: PaginationDto, @Query('q') q?: string) {
    const { data, total } = await this.users.listClients({
      skip: pagination.skip,
      take: pagination.take,
      q,
    });
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Get('drivers')
  @ApiOperation({ summary: 'Lister les convoyeurs actifs' })
  async listDrivers(@Query() pagination: PaginationDto, @Query('city') city?: string) {
    const { data, total } = await this.users.listDrivers({
      skip: pagination.skip,
      take: pagination.take,
      city,
    });
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Profil public d\'un utilisateur' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.findById(id);
  }
}
