import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BusinessIsolationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // El Super Admin (SYS_ADMIN) tiene acceso global
    if (user.role === 'SYS_ADMIN') {
      return true;
    }

    // Extraer businessId de query param, param de ruta o del body
    const reqBusinessId = request.query.businessId || request.params.businessId || request.body.businessId;

    // Si el endpoint no requiere businessId, se asume que no opera sobre datos del cliente o la propia capa del controller lo maneja.
    // Para rutas con businessId, lo validamos estrictamente:
    if (reqBusinessId) {
      // Verificar si el usuario es dueño del negocio o es parte de la organización
      const business = await this.prisma.business.findFirst({
        where: {
          id: reqBusinessId,
          ownerId: user.userId, // Sólo dueño (se podría expandir a members si existe)
        },
      });

      if (!business) {
        throw new ForbiddenException('Strict Tenant Isolation: Access denied to this business context.');
      }
      return true;
    }

    return true; // Si no hay reqBusinessId en la solicitud, delegamos a la lógica interna.
  }
}
