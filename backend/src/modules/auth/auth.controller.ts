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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Créer un compte (client, convoyeur ou pro)' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Connexion par email + mot de passe' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Renouveler les tokens via refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiOperation({ summary: 'Déconnexion (révoque le refresh token)' })
  async logout(@CurrentUser('id') userId: string, @Body() body: Partial<RefreshDto>) {
    await this.auth.logout(userId, body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Lister ses sessions / appareils connectés' })
  sessions(
    @CurrentUser('id') userId: string,
    @Query('refreshToken') refreshToken?: string,
  ) {
    return this.auth.listSessions(userId, refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Révoquer une session (déconnecter un appareil)' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.auth.revokeSession(userId, id);
  }
}
