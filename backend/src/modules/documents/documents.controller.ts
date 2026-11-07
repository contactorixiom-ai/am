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
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate } from '../../common/dto/pagination.dto';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';

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
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListDocumentsDto) {
    const { data, total } = await this.documents.list(user, {
      skip: query.skip,
      take: query.take,
      category: query.category,
      missionId: query.missionId,
      parcelId: query.parcelId,
    });
    return paginate(data, total, query.page, query.pageSize);
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
