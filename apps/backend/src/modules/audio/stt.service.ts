import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class STTService {
  private readonly logger = new Logger(STTService.name);
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('✅ STTService: OpenAI Whisper configurado correctamente.');
    } else {
      this.logger.warn('⚠️ STTService: OPENAI_API_KEY no configurada. La transcripción de audio no estará disponible.');
    }
  }

  /**
   * Transcribe un buffer de audio a texto usando OpenAI Whisper.
   * Soporta mp3, mp4, wav, ogg, webm, etc.
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string> {
    if (!this.openai) {
      this.logger.warn('STT no disponible: OpenAI no configurado.');
      return '';
    }

    // Determinar extensión según mimeType
    const extMap: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'mp4',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/aac': 'aac',
    };
    const ext = extMap[mimeType] || 'ogg';

    // Guardar buffer en archivo temporal (Whisper requiere un archivo)
    const tmpPath = path.join(os.tmpdir(), `stt_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, audioBuffer);

    try {
      this.logger.log(`[STT] Transcribiendo audio de ${audioBuffer.length} bytes con Whisper...`);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath) as any,
        model: 'whisper-1',
        language: 'es',
        response_format: 'text',
      });

      const text = typeof transcription === 'string' ? transcription : (transcription as any).text || '';
      this.logger.log(`[STT] ✅ Transcripción exitosa: "${text.substring(0, 80)}..."`);
      return text.trim();
    } catch (error) {
      this.logger.error('[STT] Error al transcribir con Whisper:', error.message);
      return '';
    } finally {
      // Limpiar archivo temporal
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  async transcribeAudioWithLanguage(audioBuffer: Buffer, language: string = 'es'): Promise<string> {
    return this.transcribeAudio(audioBuffer);
  }

  async getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
    return [
      { code: 'es', name: 'Español' },
      { code: 'en', name: 'English' },
      { code: 'pt', name: 'Português' },
      { code: 'fr', name: 'Français' },
    ];
  }
}
