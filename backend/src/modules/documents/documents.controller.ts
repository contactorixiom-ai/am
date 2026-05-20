import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentCategory } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un document (après upload via /storage)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDocumentDto) {
    return this.documents.create(userId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
    @Query('category') category?: DocumentCategory,
    @Query('missionId') missionId?: string,
  ) {
    const { data, total } = await this.documents.list(user, {
      skip: pagination.skip,
      take: pagination.take,
      category,
      missionId,
    });
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.findOne(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.documents.remove(id, user);
  }
}
