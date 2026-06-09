import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CrmCallService } from './crm-call.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('crm-call')
@UseGuards(JwtAuthGuard)
export class CrmCallController {
  constructor(private readonly crmCallService: CrmCallService) {}

  /**
   * Obtiene la lista completa de registros de llamadas (Escucha Activa) del negocio.
   */
  @Get('logs')
  async getLogs(@Request() req) {
    const businessId = req.user.businessId;
    return this.crmCallService.getCallLogs(businessId);
  }

  /**
   * Obtiene el análisis cuantitativo de satisfacción y resolución del bot.
   */
  @Get('analytics')
  async getAnalytics(@Request() req) {
    const businessId = req.user.businessId;
    return this.crmCallService.getCallAnalytics(businessId);
  }

  /**
   * Registra una nueva llamada en el CRM.
   */
  @Post('log')
  async createLog(
    @Request() req,
    @Body()
    body: {
      contactId?: string;
      contactPhone?: string;
      contactName?: string;
      duration: number;
      status: 'COMPLETED' | 'MISSED' | 'BUSY' | 'FAILED';
      recordingUrl?: string;
      transcription?: string;
      sentiment?: string;
      queryResolved: boolean;
    },
  ) {
    const businessId = req.user.businessId;
    return this.crmCallService.logCall({
      businessId,
      ...body,
    });
  }

  /**
   * Registra el resultado de una encuesta de llamada.
   */
  @Post('survey/:callId')
  async submitSurvey(
    @Param('callId') callId: string,
    @Body() body: { score: number; feedback?: string },
  ) {
    return this.crmCallService.submitSurveyResponse(callId, body.score, body.feedback);
  }
}
