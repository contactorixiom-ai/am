import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffFileKind, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { StaffSpaceService } from './staff-space.service';
import { ANNOUNCE_ROLES, EXPENSE_ROLES, hasRole, HR_ROLES, PERSONNEL_VIEWERS, TEAM_ROLES, TRAVEL_ROLES } from '../../common/auth/staff';
import {
  AnnouncementDto,
  MyStaffFileDto,
  PersonStaffFileDto,
  ReviewStaffFileDto,
  StaffRequestDto,
} from './staff-space.dto';

const { ADMIN, DRIVER } = UserRole;

/** Le garde admet le responsable avec l'administrateur : on resserre ici. */
function only(list: UserRole[], user: AuthenticatedUser, message: string) {
  if (!hasRole(list, user.role)) throw new ForbiddenException(message);
}
const TEAM = [ADMIN, ...TEAM_ROLES];
const PERSONNEL = [DRIVER, ...TEAM_ROLES];

/**
 * Mon espace (convoyeurs et salariés) et dossiers du personnel (équipe Axis).
 * Rappel : @Roles(ADMIN) admet aussi le responsable d'exploitation.
 */
@ApiTags('staff-space')
@ApiBearerAuth()
@Controller('staff-space')
export class StaffSpaceController {
  constructor(private readonly space: StaffSpaceService) {}

  // ─── Mon espace ────────────────────────────────────────────────────────────

  @Get('me')
  @Roles(...PERSONNEL)
  @ApiOperation({ summary: 'Mes billets, frais, documents, demandes et annonces' })
  me(@CurrentUser('id') userId: string) {
    return this.space.mySpace(userId);
  }

  @Post('me/files')
  @Roles(...PERSONNEL)
  @ApiOperation({ summary: 'Envoyer un justificatif de frais ou un document à la RH' })
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: MyStaffFileDto) {
    return this.space.submitMine(user, dto);
  }

  @Patch('me/files/:id/seen')
  seen(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.space.markSeen(userId, id);
  }

  @Delete('me/files/:id')
  removeMine(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.space.removeMine(userId, id);
  }

  // ─── Dossiers du personnel ─────────────────────────────────────────────────

  @Get('people')
  @Roles(...TEAM)
  @ApiOperation({ summary: 'Convoyeurs et salariés, avec ce qui attend une action' })
  people(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: string) {
    only(PERSONNEL_VIEWERS, user, 'Accès réservé à l\'équipe Axis.');
    return this.space.people(user, q);
  }

  @Get('people/:id')
  @Roles(...TEAM)
  person(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    only(PERSONNEL_VIEWERS, user, 'Accès réservé à l\'équipe Axis.');
    return this.space.person(user, id);
  }

  @Post('people/:id/files')
  @Roles(...TEAM)
  @ApiOperation({ summary: 'Déposer un billet, une réservation ou un document RH' })
  addFile(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PersonStaffFileDto) {
    only(PERSONNEL_VIEWERS, user, 'Accès réservé à l\'équipe Axis.');
    return this.space.addForPerson(user, id, dto);
  }

  @Delete('files/:id')
  @Roles(...TEAM)
  removeFile(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    only([...TRAVEL_ROLES, ...HR_ROLES], user, 'Action non autorisée pour votre compte.');
    return this.space.removeByStaff(user, id);
  }

  @Post('people/:id/requests')
  @Roles(...TEAM)
  @ApiOperation({ summary: 'RH : demander une pièce ou une information' })
  request(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffRequestDto) {
    only(HR_ROLES, user, 'Réservé à la RH et à l\'administrateur.');
    return this.space.createRequest(user, id, dto);
  }

  @Patch('requests/:id/cancel')
  @Roles(...TEAM)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    only(HR_ROLES, user, 'Réservé à la RH et à l\'administrateur.');
    return this.space.cancelRequest(id);
  }

  // ─── Comptabilité ──────────────────────────────────────────────────────────

  @Get('expenses')
  @Roles(...TEAM)
  @ApiOperation({ summary: 'Comptabilité : justificatifs de frais' })
  expenses(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    only(EXPENSE_ROLES, user, 'Réservé à la comptabilité et à l\'administrateur.');
    return this.space.inbox(StaffFileKind.EXPENSE, { status, from, to });
  }

  @Patch('expenses/:id')
  @Roles(...TEAM)
  reviewExpense(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewStaffFileDto) {
    only(EXPENSE_ROLES, user, 'Réservé à la comptabilité et à l\'administrateur.');
    return this.space.review(user, id, dto, StaffFileKind.EXPENSE);
  }

  // ─── RH : pièces reçues ────────────────────────────────────────────────────

  @Get('documents')
  @Roles(...TEAM)
  @ApiOperation({ summary: 'RH : pièces envoyées par les convoyeurs et salariés' })
  documents(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    only(HR_ROLES, user, 'Réservé à la RH et à l\'administrateur.');
    return this.space.inbox(StaffFileKind.EMPLOYEE_DOCUMENT, { status });
  }

  @Patch('documents/:id')
  @Roles(...TEAM)
  reviewDocument(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewStaffFileDto) {
    only(HR_ROLES, user, 'Réservé à la RH et à l\'administrateur.');
    return this.space.review(user, id, dto, StaffFileKind.EMPLOYEE_DOCUMENT);
  }

  // ─── Annonces ──────────────────────────────────────────────────────────────

  @Post('announcements')
  @Roles(...TEAM)
  @ApiOperation({ summary: 'Secrétariat : relayer une information à l\'équipe ou à des personnes' })
  announce(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnnouncementDto) {
    only(ANNOUNCE_ROLES, user, 'Réservé à l\'équipe Axis (annonces).');
    return this.space.announce(user, dto);
  }

  @Get('announcements')
  @Roles(...TEAM)
  announcements(@CurrentUser() user: AuthenticatedUser) {
    only(ANNOUNCE_ROLES, user, 'Réservé à l\'équipe Axis (annonces).');
    return this.space.listAnnouncements();
  }
}
