import { Controller, Get, Post, Body, UseGuards, Request, Ip } from '@nestjs/common';
import { VoiceCloningService } from './voice-cloning.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('voice-cloning')
@UseGuards(JwtAuthGuard)
export class VoiceCloningController {
  constructor(private readonly voiceService: VoiceCloningService) {}

  /**
   * Obtiene la configuración de clonación de voz del negocio.
   */
  @Get('config')
  async getConfig(@Request() req) {
    const businessId = req.user.businessId;
    return this.voiceService.getVoiceConfig(businessId);
  }

  /**
   * Obtiene los términos legales en español.
   */
  @Get('terms')
  getTerms() {
    return { terms: this.voiceService.getLegalTerms() };
  }

  /**
   * Firma digitalmente los términos y condiciones de clonación de voz.
   */
  @Post('accept-terms')
  async acceptTerms(@Request() req, @Ip() ip: string) {
    const businessId = req.user.businessId;
    return this.voiceService.acceptTermsAndConditions(businessId, ip || '127.0.0.1');
  }

  /**
   * Configura el ID del modelo de voz clonada.
   */
  @Post('save-model')
  async saveModel(
    @Request() req,
    @Body() body: { voiceModelId: string; sampleUrl?: string },
  ) {
    const businessId = req.user.businessId;
    return this.voiceService.saveVoiceModel(businessId, body.voiceModelId, body.sampleUrl);
  }

  /**
   * Genera un audio de prueba para evaluar la calidad de la clonación.
   */
  @Post('synthesize')
  async testSynthesize(@Request() req, @Body() body: { text: string }) {
    const businessId = req.user.businessId;
    return this.voiceService.generateSpeechFromText(businessId, body.text);
  }
}
