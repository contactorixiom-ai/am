import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NewsStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateArticleDto } from './dto/create-article.dto';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(opts: { skip: number; take: number; tag?: string; categorySlug?: string }) {
    const where: Prisma.NewsArticleWhereInput = {
      status: NewsStatus.PUBLISHED,
      publishedAt: { lte: new Date() },
    };
    if (opts.tag) where.tags = { has: opts.tag };
    if (opts.categorySlug) where.category = { slug: opts.categorySlug };

    const [data, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          category: true,
        },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.newsArticle.count({ where }),
    ]);
    return { data, total };
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        category: true,
      },
    });
    if (!article || article.status !== NewsStatus.PUBLISHED) {
      throw new NotFoundException('Article not found');
    }
    await this.prisma.newsArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });
    return article;
  }

  async create(user: AuthenticatedUser, dto: CreateArticleDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    return this.prisma.newsArticle.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        excerpt: dto.excerpt,
        body: dto.body,
        coverUrl: dto.coverUrl,
        status: dto.status ?? NewsStatus.DRAFT,
        categoryId: dto.categoryId,
        tags: dto.tags ?? [],
        authorId: user.id,
        publishedAt: dto.status === NewsStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async listCategories() {
    return this.prisma.newsCategory.findMany({ orderBy: { name: 'asc' } });
  }
}
