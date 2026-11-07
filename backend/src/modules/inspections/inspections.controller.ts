import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddInspectionPhotoDto } from './dto/add-photo.dto';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { SignInspectionDto } from './dto/sign-inspection.dto';
import { InspectionsService } from './inspections.service';

@ApiTags('inspections')
@ApiBearerAuth()
@Controller()
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Post('missions/:missionId/inspections')
  @ApiOperation({ summary: 'Créer un état des lieux pour une mission' })
  create(
    @Param('missionId', new ParseUUIDPipe()) missionId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInspectionDto,
  ) {
    return this.inspections.create(missionId, userId, dto);
  }

  @Get('missions/:missionId/inspections')
  list(
    @Param('missionId', new ParseUUIDPipe()) missionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inspections.listByMission(missionId, user);
  }

  @Get('inspections/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inspections.findOne(id, user);
  }

  @Post('inspections/:id/photos')
  @ApiOperation({ summary: 'Ajouter une photo à l\'état des lieux' })
  addPhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddInspectionPhotoDto,
  ) {
    return this.inspections.addPhoto(id, user, dto);
  }

  @Post('inspections/:id/submit')
  @ApiOperation({ summary: 'Soumettre l\'état des lieux pour signature' })
  submit(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inspections.submit(id, user);
  }

  @Post('inspections/:id/sign')
  @ApiOperation({ summary: 'Signer (CLIENT ou DRIVER)' })
  sign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignInspectionDto,
  ) {
    return this.inspections.sign(id, user, dto);
  }
}
