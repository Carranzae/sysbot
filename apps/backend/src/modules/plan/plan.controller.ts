import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PlanService, CheckLimitResult } from './plan.service';
import { SaaSCheckoutService } from './saas-checkout.service';
import {
  PlanType,
  PlanInterval,
  PlanConfig,
  BusinessSubscription,
} from './entities/plan.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CheckLimitDto } from './dto/check-limit.dto';

@ApiTags('Planes y Suscripciones')
@Controller('plans')
export class PlanController {
  constructor(
    private readonly planService: PlanService,
    private readonly saasCheckout: SaaSCheckoutService
  ) {}

  @Post('subscription/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear checkout para suscripción de la plataforma' })
  async createCheckout(
    @Request() req,
    @Body() dto: { planType: PlanType; interval: PlanInterval },
  ) {
    const businessId = req.user.businessId || req.body.businessId;
    if (!businessId) throw new Error('Se requiere Business ID');
    
    return this.saasCheckout.createSubscriptionCheckout(
      businessId,
      dto.planType,
      dto.interval,
    );
  }

  // ==================== PLANES PÚBLICOS ====================

  @Get()
  @ApiOperation({ summary: 'Obtener todos los planes disponibles' })
  @ApiResponse({ status: 200, description: 'Lista de planes' })
  async getAllPlans(): Promise<PlanConfig[]> {
    return this.planService.getAllPlans();
  }

  @Get('types')
  @ApiOperation({ summary: 'Obtener tipos de planes' })
  @ApiResponse({ status: 200, description: 'Tipos de planes disponibles' })
  getPlanTypes(): { types: string[]; intervals: string[] } {
    return {
      types: Object.values(PlanType),
      intervals: Object.values(PlanInterval),
    };
  }

  @Get('price')
  @ApiOperation({ summary: 'Calcular precio de un plan' })
  @ApiQuery({ name: 'planType', enum: PlanType })
  @ApiQuery({ name: 'interval', enum: PlanInterval })
  @ApiQuery({ name: 'industryType', required: false })
  @ApiResponse({ status: 200, description: 'Precio calculado' })
  async getPlanPrice(
    @Query('planType') planType: PlanType,
    @Query('interval') interval: PlanInterval,
    @Query('industryType') industryType?: string,
  ): Promise<{ price: number; currency: string }> {
    const price = await this.planService.getPlanPrice(planType, interval, industryType);
    return { price, currency: 'USD' };
  }

  @Get(':type')
  @ApiOperation({ summary: 'Obtener detalle de un plan específico' })
  @ApiResponse({ status: 200, description: 'Detalle del plan' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  async getPlanByType(@Param('type') type: PlanType): Promise<PlanConfig> {
    const plan = await this.planService.getPlanByType(type);
    if (!plan) {
      throw new Error('Plan not found');
    }
    return plan;
  }

  // ==================== SUSCRIPCIONES (Requieren Auth) ====================

  @Get('subscription/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mi suscripción actual' })
  @ApiResponse({ status: 200, description: 'Suscripción del negocio' })
  async getMySubscription(
    @Request() req,
  ): Promise<BusinessSubscription & { planDetails: PlanConfig | null }> {
    const businessId = req.user.businessId;
    const subscription = await this.planService.getBusinessSubscription(businessId);
    const planDetails = await this.planService.getPlanByType(subscription.planType);
    
    return {
      ...subscription,
      planDetails,
    };
  }

  @Post('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nueva suscripción' })
  @ApiResponse({ status: 201, description: 'Suscripción creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async createSubscription(
    @Request() req,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<BusinessSubscription> {
    return this.planService.createSubscription({
      businessId: req.user.businessId,
      planType: dto.planType,
      interval: dto.interval,
      industryType: req.user.business?.industryType,
      trialDays: dto.trialDays,
    });
  }

  @Put('subscription/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar suscripción (upgrade/downgrade)' })
  @ApiResponse({ status: 200, description: 'Suscripción actualizada' })
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @Request() req,
  ): Promise<BusinessSubscription> {
    return this.planService.updateSubscription(
      id,
      dto,
      req.user.business?.industryType,
    );
  }

  @Delete('subscription/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar suscripción' })
  @ApiResponse({ status: 200, description: 'Suscripción cancelada' })
  async cancelSubscription(
    @Param('id') id: string,
  ): Promise<{ message: string; subscription: BusinessSubscription }> {
    const subscription = await this.planService.cancelSubscription(id);
    return {
      message: 'Suscripción cancelada exitosamente',
      subscription,
    };
  }

  // ==================== LÍMITES (Requieren Auth) ====================

  @Post('limits/check-users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de usuarios' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkUserLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkUserLimit(req.user.businessId, dto.current);
  }

  @Post('limits/check-branches')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de sucursales' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkBranchLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkBranchLimit(req.user.businessId, dto.current);
  }

  @Post('limits/check-products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de productos' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkProductLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkProductLimit(req.user.businessId, dto.current);
  }

  @Post('limits/check-students')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de estudiantes' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkStudentLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkStudentLimit(req.user.businessId, dto.current);
  }

  @Post('limits/check-properties')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de propiedades' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkPropertyLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkPropertyLimit(req.user.businessId, dto.current);
  }

  @Post('limits/check-services')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de servicios' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkServiceLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkServiceLimit(req.user.businessId, dto.current);
  }

  @Post('limits/check-courses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de cursos' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkCourseLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkCourseLimit(req.user.businessId, dto.current);
  }

  @Post('limits/check-conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar límite de conversaciones' })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async checkConversationLimit(
    @Request() req,
    @Body() dto: CheckLimitDto,
  ): Promise<CheckLimitResult> {
    return this.planService.checkConversationLimit(req.user.businessId, dto.current);
  }

  // ==================== CARACTERÍSTICAS (Requieren Auth) ====================

  @Get('features/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener características disponibles en mi plan' })
  @ApiResponse({ status: 200, description: 'Características del plan' })
  async getMyFeatures(
    @Request() req,
  ): Promise<{ features: Record<string, any>; planType: PlanType }> {
    const features = await this.planService.getPlanFeatures(req.user.businessId);
    const subscription = await this.planService.getBusinessSubscription(req.user.businessId);
    
    return {
      features,
      planType: subscription.planType,
    };
  }

  @Get('features/check/:feature')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar si tengo acceso a una característica' })
  @ApiResponse({ status: 200, description: 'Tiene o no acceso' })
  async hasFeatureAccess(
    @Request() req,
    @Param('feature') feature: string,
  ): Promise<{ hasAccess: boolean; feature: string }> {
    const hasAccess = await this.planService.hasFeatureAccess(req.user.businessId, feature);
    return { hasAccess, feature };
  }

  // ==================== ADMIN (Solo Admin) ====================

  @Get('admin/subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todas las suscripciones (Admin)' })
  @ApiResponse({ status: 200, description: 'Lista de suscripciones' })
  async getAllSubscriptions(): Promise<any[]> {
    // Implementar según necesidad
    return [];
  }
}
