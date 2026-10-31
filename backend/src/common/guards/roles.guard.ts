import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const adminOnly = this.reflector.getAllAndOverride<boolean | undefined>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (adminOnly) {
      if (user?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Réservé à l\'administrateur.');
      }
      return true;
    }
    if (!required || required.length === 0) return true;

    // Le responsable d'exploitation est admis partout où l'administrateur
    // l'est, sauf mention @AdminOnly().
    const allowed = required.includes(UserRole.ADMIN) ? [...required, UserRole.MANAGER] : required;
    if (!user || !allowed.includes(user.role)) {
      throw new ForbiddenException('Cette action n\'est pas autorisée pour votre compte.');
    }
    return true;
  }
}
