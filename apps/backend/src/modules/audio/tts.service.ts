import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class TTSService {
  private readonly logger = new Logger(TTSService.name);
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('✅ TTSService: OpenAI TTS configurado correctamente.');
    } else {
      this.logger.warn('⚠️ TTSService: OPENAI_API_KEY no configurada. La síntesis de voz no estará disponible.');
    }
  }

  /**
   * Genera un archivo de audio MP3 a partir de texto usando OpenAI TTS.
   * Retorna el path al archivo temporal generado.
   */
  async generateSpeechToFile(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<string | null> {
    if (!this.openai) {
      this.logger.warn('TTS no disponible: OpenAI no configurado.');
      return null;
    }

    if (!text || text.trim().length === 0) {
      return null;
    }

    // Limitar texto a 4096 caracteres (límite de OpenAI TTS)
    const truncatedText = text.substring(0, 4096);
    const tmpPath = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);

    try {
      this.logger.log(`[TTS] Generando audio para: "${truncatedText.substring(0, 60)}..." con voz "${voice}"`);
      
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: truncatedText,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(tmpPath, buffer);
      
      this.logger.log(`[TTS] ✅ Audio generado: ${tmpPath} (${buffer.length} bytes)`);
      return tmpPath;
    } catch (error) {
      this.logger.error('[TTS] Error generando audio:', error.message);
      return null;
    }
  }

  /**
   * Genera un Buffer de audio MP3 a partir de texto.
   */
  async generateSpeechBuffer(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<Buffer | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text.substring(0, 4096),
        response_format: 'mp3',
      });
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      this.logger.error('[TTS] Error generando buffer:', error.message);
      return null;
    }
  }

  /**
   * @deprecated Use generateSpeechToFile instead
   */
  async generateSpeech(text: string, voice: string = 'nova'): Promise<string> {
    const filePath = await this.generateSpeechToFile(text, voice as any);
    return filePath || '';
  }

  async getAvailableVoices(): Promise<Array<{ name: string; language: string; gender: string }>> {
    return [
      { name: 'nova', language: 'es', gender: 'female' },
      { name: 'shimmer', language: 'es', gender: 'female' },
      { name: 'alloy', language: 'es', gender: 'neutral' },
      { name: 'echo', language: 'es', gender: 'male' },
      { name: 'fable', language: 'es', gender: 'male' },
      { name: 'onyx', language: 'es', gender: 'male' },
    ];
  }
}
