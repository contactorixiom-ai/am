import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CreateArticleDto } from './dto/create-article.dto';
import { NewsService } from './news.service';

// Les filtres font partie du DTO : la validation refuse tout champ inconnu.
class NewsQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(80) tag?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
}

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lister les actualités publiées' })
  async list(
    @Query() pagination: NewsQueryDto,
  ) {
    const { data, total } = await this.news.listPublished({
      skip: pagination.skip,
      take: pagination.take,
      tag: pagination.tag,
      categorySlug: pagination.category,
    });
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Public()
  @Get('categories')
  categories() {
    return this.news.listCategories();
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.news.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Créer un article (admin)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateArticleDto) {
    return this.news.create(user, dto);
  }
}
