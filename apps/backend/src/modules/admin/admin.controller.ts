import { Controller, Get, Query, Patch, Body, Param, Put, UseGuards, Request, Post, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UpdateUserRoleDto, UpdateUserPermissionsDto, UpdateSystemConfigDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('stats')
    async getStats() {
        return this.adminService.getGlobalStats();
    }

    @Get('users')
    async getUsers(
        @Query('search') search?: string,
        @Query('rubro') rubro?: string,
    ) {
        return this.adminService.getAllUsers(search, rubro);
    }

    @Patch('users/:id/role')
    async updateUserRole(
        @Param('id') id: string,
        @Body() dto: UpdateUserRoleDto,
    ) {
        return this.adminService.updateUserRole(id, dto);
    }

    @Patch('users/:id/permissions')
    async updateUserPermissions(
        @Param('id') id: string,
        @Body() dto: UpdateUserPermissionsDto,
    ) {
        return this.adminService.updateUserPermissions(id, dto);
    }

    // System Config Configuration
    @Get('config')
    async getConfigs() {
        return this.adminService.getAllConfigs();
    }

    @Put('config')
    async upsertConfig(@Body() dto: UpdateSystemConfigDto, @Request() req) {
        return this.adminService.upsertConfig(dto, req.user.userId || req.user.sub);
    }

    // --- Enhanced Features ---

    @Patch('users/:id/status')
    async toggleUserStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @Request() req
    ) {
        return this.adminService.toggleUserStatus(id, isActive, req.user.sub);
    }

    @Delete('users/:id')
    async deleteUser(@Param('id') id: string, @Request() req) {
        return this.adminService.deleteUser(id, req.user.sub);
    }

    @Delete('businesses/:id')
    async deleteBusiness(@Param('id') id: string, @Request() req) {
        return this.adminService.deleteBusiness(id, req.user.sub);
    }

    @Patch('businesses/:id/features')
    async updateBusinessFeatures(
        @Param('id') id: string,
        @Body() body: { 
            features: string[]; 
            ragChannelTargets?: string[];
            upsellingEnabled?: boolean;
            sentimentAnalysisEnabled?: boolean;
        },
        @Request() req
    ) {
        return this.adminService.updateBusinessFeatures(
            id, 
            body.features, 
            req.user.sub, 
            body.ragChannelTargets,
            body.upsellingEnabled,
            body.sentimentAnalysisEnabled
        );
    }

    @Patch('businesses/:id/plan')
    async updateBusinessPlan(
        @Param('id') id: string,
        @Body() body: { planExpiresAt: string; isActive: boolean; planType?: string },
        @Request() req
    ) {
        return this.adminService.updateBusinessPlan(
            id,
            body.planExpiresAt ? new Date(body.planExpiresAt) : null,
            body.isActive,
            req.user.sub,
            body.planType
        );
    }

    @Patch('businesses/:id/socials')
    async updateBusinessSocials(
        @Param('id') id: string,
        @Body() body: { allowedSocials: string[]; canSetDestination: boolean },
        @Request() req
    ) {
        return this.adminService.updateBusinessSocials(id, body.allowedSocials, body.canSetDestination, req.user.sub);
    }

    @Get('audit-logs')
    async getAuditLogs(@Query('limit') limit?: number) {
        return this.adminService.getAuditLogs(limit ? Number(limit) : 50);
    }

    @Get('notifications')
    async getNotifications() {
        return this.adminService.getNotifications();
    }

    @Post('notifications')
    async broadcastNotification(
        @Body() body: { subject: string; message: string; type: string; targetRole?: UserRole; mediaUrl?: string; mediaType?: string },
        @Request() req
    ) {
        return this.adminService.broadcastNotification(
            body.subject,
            body.message,
            body.type,
            req.user.sub,
            body.targetRole,
            body.mediaUrl,
            body.mediaType
        );
    }

    @Get('analytics')
    async getAnalytics() {
        return this.adminService.getSystemAnalytics();
    }

    // ===== AI ENGINE MANAGEMENT =====

    @Post('ai/test-providers')
    async testAllProviders() {
        return this.adminService.testAllAIProviders();
    }

    @Post('ai/generate-test')
    async generateTestResponse(@Body() body: {
        businessId: string;
        message: string;
        provider?: string;
        model?: string;
        customerPhone?: string
    }) {
        return this.adminService.generateTestResponse(
            body.businessId,
            body.message,
            body.provider,
            body.model,
            body.customerPhone
        );
    }

    @Get('ai/providers-status')
    async getProvidersStatus() {
        return this.adminService.getAIProvidersStatus();
    }

    @Post('ai/execute-rag')
    async executeRAG(@Body() body: {
        businessId: string;
        query: string;
        maxChunks?: number;
        provider?: string;
        includeMetadata?: boolean
    }) {
        return this.adminService.executeRAGQuery(
            body.businessId,
            body.query,
            body.maxChunks,
            body.provider,
            body.includeMetadata
        );
    }

    @Get('ai/usage-stats')
    async getAIUsageStats(@Query('days') days: number = 7) {
        return this.adminService.getAIUsageStats(Number(days));
    }

    @Get('system-health')
    async getSystemHealth() {
        return this.adminService.getSystemHealth();
    }

    // ===== INDUSTRY MANAGEMENT =====

    @Get('industries')
    async getIndustries() {
        return this.adminService.getIndustries();
    }

    @Patch('industries/:industryType/audio')
    async toggleIndustryAudio(
        @Param('industryType') industryType: string,
        @Body() body: { audioEnabled: boolean }
    ) {
        return this.adminService.toggleIndustryFeature(industryType, 'audioEnabled', body.audioEnabled);
    }

    @Patch('industries/:industryType/calls')
    async toggleIndustryCalls(
        @Param('industryType') industryType: string,
        @Body() body: { callEnabled: boolean }
    ) {
        return this.adminService.toggleIndustryFeature(industryType, 'callEnabled', body.callEnabled);
    }

    @Patch('industries/:industryType/autoreply')
    async toggleIndustryAutoReply(
        @Param('industryType') industryType: string,
        @Body() body: { autoReply: boolean }
    ) {
        return this.adminService.toggleIndustryFeature(industryType, 'autoReply', body.autoReply);
    }

    @Patch('industries/:industryType/whatsapp')
    async toggleIndustryWhatsApp(
        @Param('industryType') industryType: string,
        @Body() body: { whatsappEnabled: boolean }
    ) {
        return this.adminService.toggleIndustryFeature(industryType, 'whatsappWebEnabled', body.whatsappEnabled);
    }

    @Get('industries/:industryType/businesses')
    async getIndustryBusinesses(@Param('industryType') industryType: string) {
        return this.adminService.getIndustryBusinesses(industryType);
    }

    // ===== SUBSCRIPTION MANAGEMENT =====

    @Get('subscriptions')
    async getAllSubscriptions() {
        return this.adminService.getAllSubscriptions();
    }

    @Patch('subscriptions/:businessId/upgrade')
    async upgradeSubscription(
        @Param('businessId') businessId: string,
        @Body() body: { planType: string }
    ) {
        return this.adminService.upgradeSubscription(businessId, body.planType);
    }

    @Patch('subscriptions/:businessId/cancel')
    async cancelSubscription(@Param('businessId') businessId: string) {
        return this.adminService.cancelSubscription(businessId);
    }

    @Get('subscriptions/stats')
    async getSubscriptionStats() {
        return this.adminService.getSubscriptionStats();
    }

    // ===== TELEPHONY MANAGEMENT =====

    @Get('telephony/calls')
    async getCallHistory(@Query('limit') limit?: number) {
        return this.adminService.getCallHistory(limit ? Number(limit) : 50);
    }

    @Get('telephony/stats')
    async getTelephonyStats() {
        return this.adminService.getTelephonyStats();
    }

    @Post('telephony/test-call')
    async testCall(@Body() body: { phoneNumber: string; businessId: string }) {
        return this.adminService.testCall(body.phoneNumber, body.businessId);
    }

    // ===== AUDIO MANAGEMENT =====

    @Get('audio/usage')
    async getAudioUsage(@Query('days') days?: number) {
        return this.adminService.getAudioUsage(days ? Number(days) : 7);
    }

    @Post('audio/generate-test')
    async generateTestAudio(@Body() body: { text: string; voice?: string }) {
        return this.adminService.generateTestAudio(body.text, body.voice);
    }

    @Get('audio/voices')
    async getAvailableVoices() {
        return this.adminService.getAvailableVoices();
    }

    // ==========================================
    // NUEVO SISTEMA DE PLANES - 5 NIVELES
    // ==========================================

    @Get('business-plans')
    async getAllBusinessSubscriptions(
        @Query('planType') planType?: string,
        @Query('status') status?: string,
        @Query('industryType') industryType?: string,
        @Query('search') search?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.adminService.getAllBusinessSubscriptions(
            { planType, status, industryType, search },
            page ? Number(page) : 1,
            limit ? Number(limit) : 50,
        );
    }

    @Get('business-plans/:businessId/details')
    async getBusinessSubscriptionDetails(@Param('businessId') businessId: string) {
        return this.adminService.getBusinessSubscriptionDetails(businessId);
    }

    @Post('business-plans/:businessId/update')
    async manuallyUpdateBusinessPlan(
        @Param('businessId') businessId: string,
        @Body() body: {
            planType: string;
            interval?: string;
            status?: string;
            trialDays?: number;
            priceOverride?: number;
            reason?: string;
        },
        @Request() req,
    ) {
        return this.adminService.manuallyUpdateBusinessPlan(
            businessId,
            body,
            req.user.sub,
        );
    }

    @Get('business-plans/stats/overview')
    async getPlanStats() {
        return this.adminService.getPlanStats();
    }

    @Post('business-plans/:businessId/cancel')
    async cancelBusinessSubscription(
        @Param('businessId') businessId: string,
        @Body('reason') reason: string,
        @Request() req,
    ) {
        return this.adminService.cancelBusinessSubscription(
            businessId,
            reason,
            req.user.sub,
        );
    }

    @Post('business-plans/:businessId/extend-trial')
    async extendTrial(
        @Param('businessId') businessId: string,
        @Body('additionalDays') additionalDays: number,
        @Request() req,
    ) {
        return this.adminService.extendTrial(
            businessId,
            additionalDays,
            req.user.sub,
        );
    }

    @Get('business-plans/:businessId/comparison')
    async getPlanComparison(@Param('businessId') businessId: string) {
        return this.adminService.getPlanComparison(businessId);
    }

    // ===== SMART AUTOMATION =====

    @Post('automation/sync-contacts')
    async syncGlobalContacts() {
        return this.adminService.runGlobalContactSync();
    }

    @Post('automation/tick')
    async processAutomationTick() {
        return this.adminService.processAutomationTick();
    }

    @Get('automation/stats')
    async getAutomationStats() {
        return this.adminService.getAutomationStats();
    }
}
