import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  private isPublic(context: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.isPublic(context)) return (await super.canActivate(context)) as boolean;
    // Route publique : on identifie quand même l'utilisateur s'il envoie un
    // jeton valide (un devis demandé par un client connecté lui est ainsi
    // rattaché). Jeton absent ou expiré : la route reste ouverte.
    try {
      await super.canActivate(context);
    } catch {
      /* anonyme */
    }
    return true;
  }

  handleRequest<TUser>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    if (this.isPublic(context)) return (user || undefined) as TUser;
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException();
    return user;
  }
}
