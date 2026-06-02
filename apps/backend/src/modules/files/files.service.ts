import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { AIProviderFactory } from '../ai/providers/ai-provider.factory';
import { FileAttachment } from '../ai/providers/ai-provider.interface';
import { chunkText, sanitizeText } from '@syst/shared';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import sharp from 'sharp';
import { createWorker, Worker } from 'tesseract.js';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private aiService: AiService,
  ) {}

  /**
   * Procesa un archivo usando APIs de IA directamente (sin extracción manual de texto)
   * Recomendado para PDFs e imágenes con Gemini
   */
  async processFileWithAI(
    businessId: string,
    fileId: string,
    filePath: string,
    mimeType: string,
    aiProvider: string = 'GEMINI'
  ) {
    try {
      console.log(`[FilesService] Processing file ${fileId} with ${aiProvider} AI directly`);

      // Leer archivo como buffer
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);

      // Obtener configuración del negocio
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: { botConfig: true }
      });

      if (!business?.botConfig) {
        throw new Error('Business bot configuration not found');
      }

      // Preparar configuración del AI provider
      const aiConfig = {
        provider: aiProvider,
        apiKey: business.botConfig.aiApiKey || this.configService.get(`${aiProvider}_API_KEY`),
        model: business.botConfig.aiModel,
        temperature: business.botConfig.temperature || 0.7,
        maxTokens: business.botConfig.maxTokens || 1000,
      };

      // Crear provider
      const providerFactory = new AIProviderFactory();
      const provider = providerFactory.createProvider(aiConfig);

      // Verificar que el provider soporte archivos
      if (!provider.generateResponseWithFiles) {
        throw new Error(`Provider ${aiProvider} does not support direct file processing`);
      }

      // Preparar archivos para el AI
      const files: FileAttachment[] = [{
        data: fileBuffer,
        mimeType,
        filename: fileName
      }];

      // Crear prompt específico según tipo de archivo
      let prompt = '';

      if (mimeType === 'application/pdf') {
        prompt = `Analiza este documento PDF y extrae TODA la información relevante sobre productos, medicamentos, precios, servicios y cualquier detalle importante. 

INSTRUCCIONES ESPECÍFICAS:
- Extrae nombres de productos/medicamentos
- Extrae precios (especialmente en S/ - soles peruanos)
- Extrae descripciones y especificaciones
- Extrae cualquier información de contacto, horarios, servicios
- Si hay tablas o listas, conviértelas a formato legible
- Mantén la información organizada y estructurada

Responde de manera completa y detallada con toda la información que encuentres.`;
      } else if (mimeType.startsWith('image/')) {
        prompt = `Analiza esta imagen y describe detalladamente todo lo que ves. Si contiene texto, transcríbelo completamente. Si es un catálogo, producto, documento o imagen médica, describe todos los elementos visibles, textos, precios, y cualquier información relevante.

INSTRUCCIONES:
- Transcribe cualquier texto visible
- Describe productos, precios, especificaciones
- Identifica logotipos, marcas, información de contacto
- Si es una imagen médica o de productos, describe todo lo visible
- Sé lo más detallado posible`;
      } else {
        prompt = `Analiza este archivo y extrae toda la información relevante que contenga. Describe su contenido de manera detallada y completa.`;
      }

      // Procesar con AI directamente (Usando tracking industrial)
      console.log(`[FilesService] Sending file to ${aiProvider} for direct processing...`);
      const response = await this.aiService.executeProviderRequestWithFiles(
        businessId,
        provider,
        prompt,
        files,
        {
          temperature: aiConfig.temperature,
          maxTokens: aiConfig.maxTokens,
        },
        'FILE_UPLOAD'
      );
      
      const extractedInfo = response.content;

      console.log(`[FilesService] AI extracted ${extractedInfo.length} characters of information`);

      // Procesar y guardar chunks
      const chunks = chunkText(extractedInfo, 1000, 100); // chunkSize, overlap
      console.log(`[FilesService] Created ${chunks.length} chunks from AI extraction`);

      // Guardar chunks en base de datos
      for (let i = 0; i < chunks.length; i++) {
        await this.prisma.knowledgeChunk.create({
          data: {
            businessId,
            fileId,
            content: sanitizeText(chunks[i]),
            // Nota: chunkIndex y metadata no existen en el modelo actual
            // Se pueden agregar después si es necesario
          }
        });
      }

      // Marcar archivo como procesado
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          isProcessed: true,
          // Nota: processedAt y metadata no existen en el modelo actual
          // Se pueden agregar después si es necesario
        }
      });

      console.log(`[FilesService] ✅ File ${fileId} processed successfully with ${aiProvider}`);
      return { success: true, chunks: chunks.length, extractedInfo: extractedInfo.length };

    } catch (error) {
      console.error(`[FilesService] ❌ Error processing file with AI:`, error);

      // Marcar como fallido pero no bloquear
      // Nota: metadata no existe en el modelo actual
      // Se puede agregar después si es necesario
      console.log(`[FilesService] AI processing failed for file ${fileId}: ${error.message}`);

      throw error;
    }
  }

  async uploadFile(businessId: string, file: Express.Multer.File, description?: string, tags?: string[]) {
    // Validar archivo según el rubro del negocio
    await this.validateFileForBusiness(businessId, file);

    // Determinar tipo de archivo
    const fileType = this.getFileType(file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        businessId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: file.path,
        fileType,
        isProcessed: false,
        description,
        tags: tags || [],
      },
    });

    // Procesar archivo según su tipo (asíncrono, no bloquea la respuesta)
    if (fileType === 'IMAGE') {
      this.processImage(businessId, fileRecord.id, file.path).catch((error) => {
        console.error('Image processing error:', error);
      });
    } else if (fileType === 'AUDIO') {
      this.processAudio(businessId, fileRecord.id, file.path, file.mimetype).catch((error) => {
        console.error('Audio processing error:', error);
      });
    } else {
      // Intentar procesamiento directo con AI si es soportado
      const useDirectAI = await this.shouldUseDirectAI(file.mimetype, businessId);
      if (useDirectAI) {
        this.processFileWithAI(businessId, fileRecord.id, file.path, file.mimetype).catch((error) => {
          console.error('Direct AI processing failed, falling back to traditional processing:', error);
          // Fallback a procesamiento tradicional
          this.processFile(businessId, fileRecord.id, file.path, file.mimetype).catch((fallbackError) => {
            console.error('Traditional processing also failed:', fallbackError);
          });
        });
      } else {
        this.processFile(businessId, fileRecord.id, file.path, file.mimetype).catch((error) => {
          console.error('File processing error:', error);
        });
      }
    }

    return fileRecord;
  }

  async updateFile(fileId: string, file: Express.Multer.File, description?: string, tags?: string[]) {
    const existingFile = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { business: true },
    });

    if (!existingFile) {
      throw new BadRequestException('File not found');
    }

    // Validar archivo según el rubro del negocio
    await this.validateFileForBusiness(existingFile.businessId, file);

    // Crear versión anterior en el historial
    await this.prisma.fileVersion.create({
      data: {
        fileId,
        version: existingFile.version,
        filename: existingFile.filename,
        originalName: existingFile.originalName,
        mimeType: existingFile.mimeType,
        size: existingFile.size,
        url: existingFile.url,
        description: existingFile.description,
      },
    });

    // Eliminar archivo físico anterior si existe
    if (fs.existsSync(existingFile.url)) {
      fs.unlinkSync(existingFile.url);
    }

    // Actualizar archivo con nueva versión
    const newVersion = existingFile.version + 1;
    const fileType = this.getFileType(file.mimetype);

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: file.path,
        fileType,
        version: newVersion,
        isProcessed: false,
        description,
        tags: tags || existingFile.tags,
        updatedAt: new Date(),
      },
    });

    // Procesar archivo según su tipo (asíncrono, no bloquea la respuesta)
    if (fileType === 'IMAGE') {
      this.processImage(existingFile.businessId, fileId, file.path).catch((error) => {
        console.error('Image processing error:', error);
      });
    } else if (fileType === 'AUDIO') {
      this.processAudio(existingFile.businessId, fileId, file.path, file.mimetype).catch((error) => {
        console.error('Audio processing error:', error);
      });
    } else {
      this.processFile(existingFile.businessId, fileId, file.path, file.mimetype).catch((error) => {
        console.error('File processing error:', error);
      });
    }

    return updatedFile;
  }

  async processFile(businessId: string, fileId: string, filePath: string, mimeType: string) {
    const startTime = Date.now();
    console.log(`[FilesService] Starting processing for file ${fileId} (${mimeType})`);
    
    try {
      // Marcar como procesando inmediatamente
      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: false },
      });

      let text = '';
      const extractStartTime = Date.now();

      if (mimeType === 'application/pdf') {
        console.log(`[FilesService] Extracting text from PDF: ${filePath}`);
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        text = pdfData.text;
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        console.log(`[FilesService] Extracting text from DOCX: ${filePath}`);
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
      } else if (mimeType === 'text/plain') {
        console.log(`[FilesService] Reading text file: ${filePath}`);
        text = fs.readFileSync(filePath, 'utf-8');
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel'
      ) {
        console.log(`[FilesService] Extracting text from Excel: ${filePath}`);
        const workbook = xlsx.readFile(filePath);
        const sheets = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          return xlsx.utils.sheet_to_txt(sheet);
        });
        text = sheets.join('\n\n');
      }

      const extractTime = Date.now() - extractStartTime;
      console.log(`[FilesService] Text extraction completed in ${extractTime}ms. Text length: ${text.length} chars`);

      const sanitized = sanitizeText(text);
      // MEJORA: Aumentar tamaño de chunks (1500 chars) y overlap (300 chars) para mejor contexto
      // Esto permite que cada chunk tenga más información y haya más solapamiento entre chunks
      const chunks = chunkText(sanitized, 1500, 300);
      console.log(`[FilesService] Created ${chunks.length} chunks from file ${fileId} (chunk size: 1500, overlap: 300)`);
      
      // MEJORA: Validar que se crearon chunks
      if (chunks.length === 0) {
        console.error(`[FilesService] ❌ ERROR: No se pudieron crear chunks del archivo. Texto extraído: ${text.length} chars, Sanitizado: ${sanitized.length} chars`);
        throw new Error(`No se pudieron crear chunks del archivo. El archivo puede estar vacío o no se pudo extraer texto.`);
      }
      
      // MEJORA: Log de muestra de chunks para diagnóstico
      console.log(`[FilesService] 📄 Muestra de chunks:`);
      chunks.slice(0, 3).forEach((chunk, index) => {
        console.log(`[FilesService]   Chunk ${index + 1} (${chunk.length} chars): ${chunk.substring(0, 150)}...`);
      });

      // Procesar embeddings de forma asíncrona con timeout
      // IMPORTANTE: Si falla el procesamiento de RAG, NO marcar como procesado para poder reintentar
      try {
        const processStartTime = Date.now();
        console.log(`[FilesService] Starting AI knowledge processing for ${chunks.length} chunks...`);
        
        if (chunks.length === 0) {
          console.warn(`[FilesService] ⚠️ No chunks to process for file ${fileId}. File may be empty or unreadable.`);
          console.warn(`[FilesService] Text extracted length: ${text.length} chars, Sanitized length: ${sanitized.length} chars`);
        } else {
          // MEJORA: Procesar con timeout de 10 minutos máximo y mejor logging
          console.log(`[FilesService] 📊 Processing ${chunks.length} chunks for RAG...`);
          console.log(`[FilesService] 📝 First chunk preview (first 200 chars): ${chunks[0]?.substring(0, 200)}...`);
          
          try {
            await Promise.race([
              this.aiService.processFileKnowledge(businessId, fileId, chunks),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Processing timeout after 10 minutes')), 10 * 60 * 1000)
              ),
            ]);
            console.log(`[FilesService] ✅ RAG processing completed successfully`);
          } catch (ragError: any) {
            console.error(`[FilesService] ❌ RAG processing error:`, ragError.message || ragError);
            console.error(`[FilesService] Error stack:`, ragError.stack);
            throw ragError;
          }
        }
        
        const processTime = Date.now() - processStartTime;
        console.log(`[FilesService] ✅ AI knowledge processing completed in ${processTime}ms`);
      } catch (error: any) {
        console.error(
          `[FilesService] ❌ AI processing FAILED for file ${fileId}:`,
          error.message || error,
        );
        // NO marcar como procesado si falla - permite reintentar
        throw new Error(`Failed to process file knowledge: ${error.message || 'Unknown error'}`);
      }

      // Solo marcar como procesado si TODO el proceso fue exitoso
      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: true },
      });

      const totalTime = Date.now() - startTime;
      console.log(`[FilesService] ✅ File ${fileId} processing completed successfully in ${totalTime}ms`);
    } catch (error: any) {
      console.error(`[FilesService] ❌ File processing error for ${fileId}:`, error);
      // NO marcar como procesado si hay error - permite reintentar con el endpoint de reprocess
      // Solo marcar como procesado si es un error de extracción de texto (archivo corrupto/vacío)
      const isExtractionError = error.message?.includes('extract') || error.message?.includes('read');
      if (isExtractionError) {
        console.warn(`[FilesService] File extraction error - marking as processed to avoid infinite retries`);
        await this.prisma.file.update({
          where: { id: fileId },
          data: { isProcessed: true },
        }).catch(() => {});
      }
      throw error;
    }
  }

  async findAll(businessId: string) {
    return this.prisma.file.findMany({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            knowledgeChunks: true,
            fileVersions: true,
          },
        },
      },
    });
  }

  async countChunks(businessId: string): Promise<number> {
    return this.prisma.knowledgeChunk.count({
      where: { businessId },
    });
  }

  async getFileHistory(fileId: string) {
    return this.prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { version: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.file.findUnique({
      where: { id },
      include: {
        knowledgeChunks: true,
      },
    });
  }

  async remove(id: string) {
    const file = await this.prisma.file.findUnique({
      where: { id },
    });

    if (file) {
      await this.aiService.deleteFileKnowledge(file.businessId, id);

      // Marcar como inactivo en lugar de eliminar físicamente
      await this.prisma.file.update({
        where: { id },
        data: { isActive: false },
      });

      // No eliminamos el archivo físico para mantener el historial
      return file;
    }
  }

  async reprocessFile(businessId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.businessId !== businessId) {
      throw new BadRequestException('File not found or does not belong to this business');
    }

    // Eliminar chunks existentes
    await this.prisma.knowledgeChunk.deleteMany({
      where: { fileId },
    });

    // Eliminar conocimiento del vector DB
    try {
      await this.aiService.deleteFileKnowledge(businessId, fileId);
    } catch (error) {
      console.warn('Error deleting knowledge from vector DB:', error);
    }

    // Marcar como no procesado
    await this.prisma.file.update({
      where: { id: fileId },
      data: { isProcessed: false },
    });

    // Reprocesar el archivo
    const filePath = file.url.startsWith('http') ? file.url : path.join(process.cwd(), file.url);
    await this.processFile(businessId, fileId, filePath, file.mimeType);

    return file;
  }

  private async validateFileForBusiness(businessId: string, file: Express.Multer.File) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { industryType: true },
    });

    if (!business) {
      throw new BadRequestException('Business not found');
    }

    const allowedTypes = this.getAllowedFileTypes(business.industryType);
    const fileType = this.getFileType(file.mimetype);

    if (!allowedTypes.includes(fileType)) {
      throw new BadRequestException(
        `File type ${fileType} is not allowed for ${business.industryType} industry`
      );
    }

    // Validar tamaño máximo
    const maxSize = this.getMaxFileSize(business.industryType);
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB for ${business.industryType} industry`
      );
    }
  }

  private getFileType(mimeType: string): 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER' {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet') || mimeType.includes('text')) {
      return 'DOCUMENT';
    }
    return 'OTHER';
  }

  private getAllowedFileTypes(industryType: string): string[] {
    const baseTypes = ['DOCUMENT', 'IMAGE'];

    switch (industryType) {
      case 'RESTAURANT':
        return [...baseTypes, 'IMAGE']; // Especialmente imágenes de menú, platos
      case 'CLINIC':
        return [...baseTypes, 'IMAGE']; // Imágenes médicas, documentos
      case 'REAL_ESTATE':
        return [...baseTypes, 'VIDEO', 'IMAGE']; // Fotos y videos de propiedades
      case 'ACADEMY':
        return [...baseTypes, 'VIDEO', 'AUDIO']; // Material educativo
      case 'RETAIL':
        return [...baseTypes, 'IMAGE']; // Catálogos, productos
      case 'SERVICES':
        return [...baseTypes, 'IMAGE', 'VIDEO']; // Portafolio de servicios
      case 'AUTOMOTIVE':
        return [...baseTypes, 'IMAGE', 'VIDEO']; // Fotos y videos de vehículos
      case 'TECHNOLOGY':
        return [...baseTypes, 'DOCUMENT']; // Documentación técnica
      default:
        return baseTypes;
    }
  }

  /**
   * Determina si debe usar procesamiento directo con AI basado en el tipo de archivo y configuración
   */
  private async shouldUseDirectAI(mimeType: string, businessId: string): Promise<boolean> {
    try {
      // Tipos de archivo ideales para procesamiento directo con AI
      const aiSupportedTypes = [
        'application/pdf',  // PDFs - Gemini los lee perfectamente
        'image/jpeg',       // Imágenes - Tanto Gemini como OpenAI Vision
        'image/png',
        'image/webp',
        'image/gif'
      ];

      if (!aiSupportedTypes.includes(mimeType)) {
        return false; // No usar AI para tipos no soportados
      }

      // Verificar que el negocio tenga configuración de AI
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: { botConfig: true }
      });

      const provider = business?.botConfig?.aiProvider?.toUpperCase();
      if (!provider) {
        return false; // No hay configuración de AI
      }

      const apiKey = business.botConfig.aiApiKey || this.configService.get(`${provider}_API_KEY`);
      if (!apiKey || apiKey.trim().length < 10 || apiKey.includes('your-api-key')) {
        return false; // No hay API key válida
      }

      // Priorizar Gemini para PDFs (es excelente para ellos)
      if (mimeType === 'application/pdf' && provider === 'GEMINI') {
        return true;
      }

      // Usar AI para imágenes si tienen Vision API
      if (mimeType.startsWith('image/') &&
          ['GEMINI', 'OPENAI'].includes(provider)) {
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error checking AI processing eligibility:', error);
      return false; // Por defecto, usar procesamiento tradicional
    }
  }

  private getMaxFileSize(industryType: string): number {
    const baseSize = 10 * 1024 * 1024; // 10MB

    switch (industryType) {
      case 'REAL_ESTATE':
      case 'AUTOMOTIVE':
        return 50 * 1024 * 1024; // 50MB para videos de propiedades/vehículos
      case 'ACADEMY':
        return 100 * 1024 * 1024; // 100MB para contenido educativo
      default:
        return baseSize;
    }
  }

  private async processImage(businessId: string, fileId: string, filePath: string) {
    const startTime = Date.now();
    console.log(`[FilesService] Starting image processing for file ${fileId}`);
    
    try {
      // Marcar como procesando
      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: false },
      });

      const metadata = await sharp(filePath).metadata();

      // Crear versiones optimizadas (asíncrono, no bloquea)
      const outputDir = path.dirname(filePath);
      const baseName = path.basename(filePath, path.extname(filePath));

      const createThumbnail = sharp(filePath)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(path.join(outputDir, `${baseName}_thumb.jpg`));

      const createMedium = sharp(filePath)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(path.join(outputDir, `${baseName}_medium.jpg`));

      // No esperar a que terminen las optimizaciones, continuar con OCR
      Promise.all([createThumbnail, createMedium]).catch(err => {
        console.warn(`[FilesService] Error creating optimized versions:`, err);
      });

      // Extraer texto de la imagen usando OCR (Tesseract.js)
      let extractedText = '';
      let worker: Worker | null = null;
      try {
        console.log(`[FilesService] Starting OCR for image ${fileId}`);
        worker = await createWorker('spa+eng'); // Español e Inglés
        const { data: { text } } = await worker.recognize(filePath);
        extractedText = text.trim();
        console.log(`[FilesService] OCR extracted ${extractedText.length} characters from image`);
      } catch (ocrError) {
        console.warn(`[FilesService] OCR failed for image ${fileId}, using metadata only:`, ocrError);
        // Continuar con solo metadatos si OCR falla
      } finally {
        if (worker) {
          await worker.terminate().catch(err => console.warn('Error terminating OCR worker:', err));
        }
      }

      // Combinar metadatos y texto extraído
      const metadataText = `Imagen: ${baseName}, Dimensiones: ${metadata.width}x${metadata.height}, Formato: ${metadata.format}`;
      const fullText = extractedText 
        ? `${metadataText}\n\nContenido de la imagen:\n${extractedText}`
        : metadataText;
      
      const sanitized = sanitizeText(fullText);
      const chunks = chunkText(sanitized, 1000, 200);
      console.log(`[FilesService] Created ${chunks.length} chunks from image ${fileId}`);

      // Procesar con IA
      try {
        await this.aiService.processFileKnowledge(businessId, fileId, chunks);
      } catch (error) {
        console.warn(
          `[FilesService] AI processing skipped for image ${fileId}. Marking as processed anyway.`,
          error,
        );
      }

      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: true },
      });

      const totalTime = Date.now() - startTime;
      console.log(`[FilesService] Image ${fileId} processing completed in ${totalTime}ms`);
    } catch (error) {
      console.error(`[FilesService] Image processing error for ${fileId}:`, error);
      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: true },
      }).catch(() => {});
      throw error;
    }
  }

  private async processAudio(businessId: string, fileId: string, filePath: string, mimeType: string) {
    const startTime = Date.now();
    console.log(`[FilesService] Starting audio processing for file ${fileId} (${mimeType})`);
    
    try {
      // Marcar como procesando
      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: false },
      });

      // Intentar transcribir el audio usando Whisper (si está disponible) o indicar que es audio
      let transcribedText = '';
      
      try {
        // Nota: Para producción, usar un servicio de transcripción como OpenAI Whisper API
        // Por ahora, creamos metadatos del archivo de audio
        const fileStats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        
        transcribedText = `Archivo de audio: ${fileName}\nTipo: ${mimeType}\nTamaño: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB\n\nNota: El contenido de audio puede ser procesado cuando se configure un servicio de transcripción.`;
        
        console.log(`[FilesService] Audio metadata extracted for ${fileId}`);
      } catch (error) {
        console.warn(`[FilesService] Error processing audio metadata:`, error);
      }

      // Si hay texto transcrito, procesarlo
      if (transcribedText) {
        const sanitized = sanitizeText(transcribedText);
        const chunks = chunkText(sanitized, 1000, 200);
        console.log(`[FilesService] Created ${chunks.length} chunks from audio ${fileId}`);

        try {
          await this.aiService.processFileKnowledge(businessId, fileId, chunks);
        } catch (error) {
          console.warn(
            `[FilesService] AI processing skipped for audio ${fileId}. Marking as processed anyway.`,
            error,
          );
        }
      }

      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: true },
      });

      const totalTime = Date.now() - startTime;
      console.log(`[FilesService] Audio ${fileId} processing completed in ${totalTime}ms`);
    } catch (error) {
      console.error(`[FilesService] Audio processing error for ${fileId}:`, error);
      await this.prisma.file.update({
        where: { id: fileId },
        data: { isProcessed: true },
      }).catch(() => {});
      throw error;
    }
  }
}
