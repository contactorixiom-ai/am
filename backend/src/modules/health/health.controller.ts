import { SkipThrottle } from '@nestjs/throttler';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
// Sondé en continu par Railway : ne compte pas dans la limite de débit.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  async check(): Promise<{ status: string; uptime: number; db: 'ok' | 'down'; storage: 'persistent' | 'ephemeral' }> {
    let db: 'ok' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      db,
      // Pièces d'identité, photos d'état des lieux, signatures : sans volume
      // Railway, elles disparaissent au prochain déploiement.
      storage: this.config.get<boolean>('storage.onVolume', false) ? 'persistent' : 'ephemeral',
    };
  }
}
