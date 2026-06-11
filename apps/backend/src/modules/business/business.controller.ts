import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, BadRequestException, Query } from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { OnboardingBusinessDto } from './dto/onboarding-business.dto';
import { DEFAULT_INDUSTRY_PRESET, INDUSTRY_PRESETS } from './industry-presets';
import { UpdateBotConfigDto } from './dto/bot-config.dto';
import { StartTelegramPersonalDto, VerifyTelegramPersonalCodeDto } from './dto/telegram-personal.dto';
import { CreateBotRuleDto, UpdateBotRuleDto } from './dto/bot-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  private cleanList(values?: string[]): string[] {
    return (values || [])
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  }

  private buildOperationalPrompt(dto: OnboardingBusinessDto, presetPrompt: string): string {
    const sections: string[] = [presetPrompt];
    const services = this.cleanList(dto.services);
    const specialties = this.cleanList(dto.specialties);
    const staff = this.cleanList(dto.staff);
    const paymentMethods = this.cleanList(dto.paymentMethods);

    sections.push('\nPERFIL OPERATIVO DEL NEGOCIO:');
    sections.push('- Usa estos datos como fuente principal antes de responder.');
    sections.push('- Si una consulta depende de disponibilidad, horarios, stock, precios, pagos o políticas y no hay datos suficientes, pregunta una sola cosa concreta o deriva a un asesor.');

    if (dto.businessRUC?.trim()) sections.push(`- RUC: ${dto.businessRUC.trim()}`);
    if (services.length) sections.push(`- Servicios/productos principales: ${services.join(', ')}`);
    if (specialties.length) sections.push(`- Especialidades o líneas de atención: ${specialties.join(', ')}`);
    if (staff.length) sections.push(`- Equipo disponible: ${staff.join(', ')}`);
    if (paymentMethods.length) sections.push(`- Métodos de pago aceptados: ${paymentMethods.join(', ')}`);
    if (dto.paymentQrNotes?.trim()) sections.push(`- QR/pagos: ${dto.paymentQrNotes.trim()}`);
    if (dto.availabilityNotes?.trim()) sections.push(`- Disponibilidad y agenda: ${dto.availabilityNotes.trim()}`);
    if (dto.catalogNotes?.trim()) sections.push(`- Catálogos, fotos o archivos: ${dto.catalogNotes.trim()}`);
    if (dto.policies?.trim()) sections.push(`- Políticas del negocio: ${dto.policies.trim()}`);

    if (dto.industryType === 'CLINIC') {
      sections.push('\nREGLAS ESPECIALES PARA CLÍNICA:');
      sections.push('- Usa especialidades, médicos, horarios y disponibilidad configurada para derivar citas.');
      sections.push('- No inventes diagnósticos. Haz triaje básico, detecta urgencias y deriva a emergencia o asesor humano cuando corresponda.');
      sections.push('- Si el paciente solicita cita y ya hay especialidad, fecha, hora, nombre y teléfono, genera el flujo de cita sin volver a pedir datos.');
    } else if (dto.industryType === 'RETAIL' || dto.industryType === 'RESTAURANT') {
      sections.push('\nREGLAS ESPECIALES PARA VENTAS:');
      sections.push('- Usa catálogos, fotos, precios y stock subidos en archivos cuando existan.');
      sections.push('- Si el cliente quiere comprar, confirma producto, cantidad, entrega y método de pago.');
      sections.push('- Si hay QR de pago configurado o subido como archivo, ofrécelo cuando el cliente esté listo para pagar.');
    } else if (dto.industryType === 'REAL_ESTATE') {
      sections.push('\nREGLAS ESPECIALES PARA BIENES RAÍCES:');
      sections.push('- Pregunta zona, presupuesto, tipo de inmueble y disponibilidad para visita.');
      sections.push('- No inventes propiedades. Usa catálogos/archivos o deriva a asesor.');
    } else if (dto.industryType === 'ACADEMY') {
      sections.push('\nREGLAS ESPECIALES PARA EDUCACIÓN:');
      sections.push('- Usa cursos, horarios, requisitos, vacantes y pagos configurados.');
      sections.push('- Si el usuario quiere inscribirse, captura datos y deriva el pago o asesor.');
    }

    return sections.join('\n');
  }

  @Post()
  create(@Req() req: any, @Body() createBusinessDto: CreateBusinessDto) {
    if (!req.user?.userId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.businessService.create(req.user.userId, createBusinessDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.businessService.findAll(req.user?.userId);
  }

  @Post('onboarding')
  createOnboarding(@Req() req: any, @Body() onboardingDto: OnboardingBusinessDto) {
    if (!req.user?.userId) {
      throw new BadRequestException('User ID not found in token');
    }
    const preset = INDUSTRY_PRESETS[onboardingDto.industryType] || DEFAULT_INDUSTRY_PRESET;
    const normalizedCategories = (onboardingDto.categories || [])
      .map((category) => category?.trim())
      .filter((category): category is string => Boolean(category));

    const basePrompt = (onboardingDto.customPrompt || preset.promptTemplate).replace('{businessName}', onboardingDto.name.trim());
    const createBusinessDto: CreateBusinessDto = {
      name: onboardingDto.name,
      industryType: onboardingDto.industryType,
      description: onboardingDto.description,
      phone: onboardingDto.phone,
      email: onboardingDto.email,
      address: onboardingDto.address,
      website: onboardingDto.website,
      categories: normalizedCategories.length > 0 ? normalizedCategories : preset.defaultCategories,
    };

    return this.businessService.create(req.user.userId, createBusinessDto)
      .then(async (business) => {
        await this.businessService.updateBotConfig(req.user.userId, business.id, {
          welcomeMessage: onboardingDto.welcomeMessage || preset.welcomeTemplate.replace('{businessName}', onboardingDto.name.trim()),
          fallbackMessage: onboardingDto.fallbackMessage || preset.fallbackTemplate.replace('{businessName}', onboardingDto.name.trim()),
          customPrompt: this.buildOperationalPrompt(onboardingDto, basePrompt),
          businessRUC: onboardingDto.businessRUC,
          businessAddress: onboardingDto.address,
          businessHours: onboardingDto.businessHours,
          autoReply: false,
        }, req.user?.role);
        return this.businessService.findOne(business.id);
      });
  }

  @Get('industry-presets')
  getIndustryPresets() {
    return this.businessService.getIndustryPresets();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBusinessDto: UpdateBusinessDto) {
    return this.businessService.update(id, updateBusinessDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.businessService.remove(id);
  }

  @Get(':id/metrics')
  getMetrics(@Param('id') id: string) {
    return this.businessService.getDashboardMetrics(id);
  }
  
  @Get(':id/activity')
  getRecentActivity(@Param('id') id: string) {
    return this.businessService.getRecentActivity(id);
  }

  @Get(':id/bot-config')
  getBotConfig(@Req() req: any, @Param('id') id: string) {
    return this.businessService.getBotConfig(req.user?.userId, id, req.user?.role);
  }

  @Patch(':id/bot-config')
  updateBotConfig(@Req() req: any, @Param('id') id: string, @Body() config: UpdateBotConfigDto) {
    return this.businessService.updateBotConfig(req.user?.userId, id, config, req.user?.role);
  }

  @Post(':id/telegram/connect')
  connectTelegram(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { botToken: string; webhookUrl?: string },
  ) {
    return this.businessService.connectTelegram(req.user?.userId, id, body, req.user?.role);
  }

  @Delete(':id/telegram/connect')
  disconnectTelegram(@Req() req: any, @Param('id') id: string) {
    return this.businessService.disconnectTelegram(req.user?.userId, id, req.user?.role);
  }

  @Post(':id/telegram/personal/start')
  startTelegramPersonal(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: StartTelegramPersonalDto,
  ) {
    return this.businessService.startTelegramPersonalSetup(req.user?.userId, id, body, req.user?.role);
  }

  @Post(':id/telegram/personal/verify')
  verifyTelegramPersonal(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: VerifyTelegramPersonalCodeDto,
  ) {
    return this.businessService.verifyTelegramPersonalCode(req.user?.userId, id, body, req.user?.role);
  }

  @Delete(':id/telegram/personal')
  disconnectTelegramPersonal(@Req() req: any, @Param('id') id: string) {
    return this.businessService.disconnectTelegramPersonal(req.user?.userId, id, req.user?.role);
  }

  @Get(':id/social-settings')
  getSocialSettings(@Req() req: any, @Param('id') id: string) {
    return this.businessService.getSocialSettings(req.user?.userId, id, req.user?.role);
  }

  @Patch(':id/social-channels')
  updateSocialChannels(@Req() req: any, @Param('id') id: string, @Body() body: { channels: any[] }) {
    return this.businessService.updateSocialChannels(req.user?.userId, id, body.channels, req.user?.role);
  }

  @Get(':id/bot-rules')
  getBotRules(@Req() req: any, @Param('id') id: string) {
    return this.businessService.getBotRules(req.user?.userId, id, req.user?.role);
  }

  @Post(':id/bot-rules')
  createBotRule(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateBotRuleDto,
  ) {
    return this.businessService.createBotRule(req.user?.userId, id, body, req.user?.role);
  }

  @Patch(':id/bot-rules/:ruleId')
  updateBotRule(
    @Req() req: any,
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @Body() body: UpdateBotRuleDto,
  ) {
    return this.businessService.updateBotRule(req.user?.userId, id, ruleId, body, req.user?.role);
  }

  @Delete(':id/bot-rules/:ruleId')
  deleteBotRule(@Req() req: any, @Param('id') id: string, @Param('ruleId') ruleId: string) {
    return this.businessService.deleteBotRule(req.user?.userId, id, ruleId, req.user?.role);
  }

  // ===== BUSINESS OWNER CONFIGURATION =====

  @Get(':id/payment-settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_OWNER)
  getPaymentSettings(@Req() req: any, @Param('id') id: string) {
    return this.businessService.getPaymentSettings(req.user?.userId, id);
  }

  @Patch(':id/payment-settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_OWNER)
  updatePaymentSettings(@Req() req: any, @Param('id') id: string, @Body() settings: {
    email?: string;
    gateway?: string;
    whatsappNumber?: string;
    paymentWebhookUrl?: string;
  }) {
    return this.businessService.updatePaymentSettings(req.user?.userId, id, settings);
  }

  @Get(':id/contact-settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_OWNER)
  getContactSettings(@Req() req: any, @Param('id') id: string) {
    return this.businessService.getContactSettings(req.user?.userId, id);
  }

  @Patch(':id/contact-settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_OWNER)
  updateContactSettings(@Req() req: any, @Param('id') id: string, @Body() settings: {
    supportEmail?: string;
    supportPhone?: string;
    businessHours?: {
      monday?: { open: string; close: string; closed?: boolean };
      tuesday?: { open: string; close: string; closed?: boolean };
      wednesday?: { open: string; close: string; closed?: boolean };
      thursday?: { open: string; close: string; closed?: boolean };
      friday?: { open: string; close: string; closed?: boolean };
      saturday?: { open: string; close: string; closed?: boolean };
      sunday?: { open: string; close: string; closed?: boolean };
    };
    timezone?: string;
  }) {
    return this.businessService.updateContactSettings(req.user?.userId, id, settings);
  }

  @Get(':id/business-preferences')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_OWNER)
  getBusinessPreferences(@Req() req: any, @Param('id') id: string) {
    return this.businessService.getBusinessPreferences(req.user?.userId, id);
  }

  @Patch(':id/business-preferences')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_OWNER)
  updateBusinessPreferences(@Req() req: any, @Param('id') id: string, @Body() preferences: {
    language?: string;
    currency?: string;
    notifications?: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      pushNotifications?: boolean;
    };
    privacy?: {
      dataRetentionDays?: number;
      allowAnalytics?: boolean;
      shareData?: boolean;
    };
}) {
    return this.businessService.updateBusinessPreferences(req.user?.userId, id, preferences);
  }

  // Endpoints para activación masiva por industria
  @Patch('industries/:industryType/audio')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async toggleIndustryAudio(
    @Param('industryType') industryType: string,
    @Body() body: { audioEnabled: boolean },
    @Req() req: any
  ) {
    return this.businessService.toggleIndustryFeature(industryType, 'audio', body.audioEnabled, req.user);
  }

  @Patch('industries/:industryType/calls')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async toggleIndustryCalls(
    @Param('industryType') industryType: string,
    @Body() body: { callEnabled: boolean },
    @Req() req: any
  ) {
    return this.businessService.toggleIndustryFeature(industryType, 'calls', body.callEnabled, req.user);
  }

  @Patch('industries/:industryType/autoreply')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async toggleIndustryAutoReply(
    @Param('industryType') industryType: string,
    @Body() body: { autoReply: boolean },
    @Req() req: any
  ) {
    return this.businessService.toggleIndustryFeature(industryType, 'autoreply', body.autoReply, req.user);
  }

  @Patch('industries/:industryType/whatsapp')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async toggleIndustryWhatsApp(
    @Param('industryType') industryType: string,
    @Body() body: { whatsappEnabled: boolean },
    @Req() req: any
  ) {
    return this.businessService.toggleIndustryFeature(industryType, 'whatsapp', body.whatsappEnabled, req.user);
  }

  @Get('industries')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getIndustriesStats() {
    return this.businessService.getIndustriesStats();
  }
}
