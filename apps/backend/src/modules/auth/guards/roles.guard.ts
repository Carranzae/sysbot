import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredRoles) {
            return true;
        }
        const { user } = context.switchToHttp().getRequest();

        // Si no hay usuario (no autenticado) o no tiene rol, denegar
        if (!user || !user.role) {
            return false;
        }

        // SUPER_ADMIN tiene acceso a todo si se requiere ADMIN o cualquier otro rol
        if (user.role === UserRole.SUPER_ADMIN) {
            return true;
        }

        return requiredRoles.some((role) => user.role === role);
    }
}
