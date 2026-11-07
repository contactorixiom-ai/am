import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function check(role: UserRole, meta: { roles?: UserRole[]; adminOnly?: boolean }) {
  const reflector = { getAllAndOverride: (key: string) => (key === ROLES_KEY ? meta.roles : key === ADMIN_ONLY_KEY ? meta.adminOnly : undefined) } as unknown as Reflector;
  const ctx = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', role } }) }) } as never;
  return new RolesGuard(reflector).canActivate(ctx);
}

describe('RolesGuard — équipe Axis', () => {
  it('le responsable d\'exploitation accède aux actions de pilotage', () => {
    expect(check(UserRole.MANAGER, { roles: [UserRole.ADMIN] })).toBe(true);
    expect(check(UserRole.MANAGER, { roles: [UserRole.DRIVER, UserRole.ADMIN] })).toBe(true);
  });

  it('mais pas à ce qui est réservé à l\'administrateur', () => {
    expect(() => check(UserRole.MANAGER, { roles: [UserRole.ADMIN], adminOnly: true })).toThrow(ForbiddenException);
    expect(check(UserRole.ADMIN, { roles: [UserRole.ADMIN], adminOnly: true })).toBe(true);
  });

  it('clients et convoyeurs restent exclus', () => {
    expect(() => check(UserRole.CLIENT, { roles: [UserRole.ADMIN] })).toThrow(ForbiddenException);
    expect(() => check(UserRole.DRIVER, { roles: [UserRole.ADMIN] })).toThrow(ForbiddenException);
    expect(() => check(UserRole.CLIENT, { adminOnly: true })).toThrow(ForbiddenException);
  });

  it('un rôle convoyeur requis n\'est pas ouvert au responsable', () => {
    expect(() => check(UserRole.MANAGER, { roles: [UserRole.DRIVER] })).toThrow(ForbiddenException);
  });
});
