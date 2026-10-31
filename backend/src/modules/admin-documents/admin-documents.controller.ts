import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminDocumentsService } from './admin-documents.service';
import { SaveAdminDocumentDto } from './save-admin-document.dto';

@ApiTags('admin-documents')
@ApiBearerAuth()
@Roles(UserRole.ADMIN) // administrateur et responsables d'exploitation
@Controller('admin-documents')
export class AdminDocumentsController {
  constructor(private readonly docs: AdminDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Équipe : historique des documents officiels générés' })
  list(@CurrentUser() user: AuthenticatedUser, @Query('take') take?: string) {
    return this.docs.list(user, take ? Number(take) || 200 : 200);
  }

  @Post()
  @ApiOperation({ summary: 'Équipe : enregistrer un document généré' })
  save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveAdminDocumentDto) {
    return this.docs.save(user, dto);
  }

  @Get('sequence/:typeId')
  @ApiOperation({ summary: 'Équipe : prochain numéro pour ce type de document' })
  peek(@Param('typeId') typeId: string) {
    return this.docs.peek(typeId);
  }

  @Post('sequence/:typeId/:used')
  @ApiOperation({ summary: 'Équipe : enregistrer le numéro utilisé' })
  commit(@Param('typeId') typeId: string, @Param('used', ParseIntPipe) used: number) {
    return this.docs.commit(typeId, used);
  }
}
