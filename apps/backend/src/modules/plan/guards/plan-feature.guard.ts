import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PlanService } from '../plan.service';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly planService: PlanService,
    private readonly requiredFeature: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const businessId = request.user?.businessId;

    if (!businessId) {
      throw new ForbiddenException('Business ID not found');
    }

    const hasAccess = await this.planService.hasFeatureAccess(
      businessId,
      this.requiredFeature,
    );

    if (!hasAccess) {
      const subscription = await this.planService.getBusinessSubscription(businessId);
      throw new ForbiddenException(
        `Esta función requiere un plan superior. Tu plan actual: ${subscription.planType}. ` +
        `Actualiza tu plan para acceder a esta característica.`,
      );
    }

    return true;
  }
}

// Factory para crear guards con feature específico
export function RequireFeature(feature: string) {
  @Injectable()
  class FeatureGuardMixin extends PlanFeatureGuard {
    constructor(planService: PlanService) {
      super(planService, feature);
    }
  }
  return FeatureGuardMixin;
}
