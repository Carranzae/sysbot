import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { SelfStudyService } from './self-study.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('self-study')
@UseGuards(JwtAuthGuard)
export class SelfStudyController {
  constructor(private readonly studyService: SelfStudyService) {}

  /**
   * Obtiene el listado histórico de auto-estudios realizados por el bot.
   */
  @Get('history')
  async getHistory(@Request() req) {
    const businessId = req.user.businessId;
    return this.studyService.getLearningHistory(businessId);
  }

  /**
   * Fuerza el entrenamiento/simulación autónoma de forma manual desde el panel.
   */
  @Post('trigger')
  async triggerDrill(@Request() req) {
    const businessId = req.user.businessId;
    return this.studyService.triggerManualStudy(businessId);
  }
}
