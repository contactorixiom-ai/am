import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour son profil' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.users.updateProfile(userId, dto);
  }

  @Put('me/driver-profile')
  @ApiOperation({ summary: 'Créer ou mettre à jour son profil convoyeur' })
  upsertDriver(@CurrentUser('id') userId: string, @Body() dto: UpsertDriverProfileDto) {
    return this.users.upsertDriverProfile(userId, dto);
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
