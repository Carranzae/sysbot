import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { BusinessService } from '../business/business.service';
import { Req } from '@nestjs/common';

const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly businessService: BusinessService,
  ) {}

  @Post('upload')
  @RateLimit({ limit: 5, windowMs: 300000 }) // 5 uploads per 5 minutes
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
      fileFilter: (req, file, cb) => {
        // Aceptar todos los tipos de archivos comunes
        const allowedMimes = [
          // Documentos
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'text/csv',
          'application/rtf',
          // Imágenes
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/tiff',
          'image/svg+xml',
          'image/heic',
          'image/heif',
          'image/avif',
          // Videos
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo',
          'video/x-ms-wmv',
          'video/webm',
          'video/3gpp',
          // Audio
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/wave',
          'audio/x-wav',
          'audio/ogg',
          'audio/vorbis',
          'audio/aac',
          'audio/mp4',
          'audio/webm',
          'audio/flac',
          'audio/x-m4a',
        ];
        
        // También aceptar por extensión si el mimetype no está en la lista
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        const allowedExtensions = [
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf',
          'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'heic', 'heif', 'avif',
          'mp4', 'mpeg', 'mov', 'avi', 'wmv', 'webm', '3gp',
          'mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'webm'
        ];
        
        if (allowedMimes.includes(file.mimetype) || (ext && allowedExtensions.includes(ext))) {
          cb(null, true);
        } else {
          cb(new Error(`Tipo de archivo no permitido: ${file.mimetype || ext}`), false);
        }
      },
    }),
  )
  async uploadFile(
    @Req() req: any,
    @Query('businessId') businessId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: { description?: string; tags?: string }
  ) {
    if (!businessId) throw new BadRequestException('Business ID is required');
    await this.businessService.ensureBusinessOwnership(req.user.userId, businessId);
    const tags = body?.tags ? JSON.parse(body.tags) : [];
    return this.filesService.uploadFile(businessId, file, body?.description, tags);
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        // Aceptar todos los tipos de archivos comunes (mismo que upload)
        const allowedMimes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'text/csv',
          'application/rtf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/tiff',
          'image/svg+xml',
          'image/heic',
          'image/heif',
          'image/avif',
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo',
          'video/x-ms-wmv',
          'video/webm',
          'video/3gpp',
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/wave',
          'audio/x-wav',
          'audio/ogg',
          'audio/vorbis',
          'audio/aac',
          'audio/mp4',
          'audio/webm',
          'audio/flac',
          'audio/x-m4a',
        ];
        
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        const allowedExtensions = [
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf',
          'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'heic', 'heif', 'avif',
          'mp4', 'mpeg', 'mov', 'avi', 'wmv', 'webm', '3gp',
          'mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'webm'
        ];
        
        if (allowedMimes.includes(file.mimetype) || (ext && allowedExtensions.includes(ext))) {
          cb(null, true);
        } else {
          cb(new Error(`Tipo de archivo no permitido: ${file.mimetype || ext}`), false);
        }
      },
    }),
  )
  async updateFile(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: { description?: string; tags?: string }
  ) {
    const existingFile = await this.filesService.findOne(id);
    if (!existingFile) throw new BadRequestException('File not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, existingFile.businessId);
    
    const tags = body?.tags ? JSON.parse(body.tags) : [];
    return this.filesService.updateFile(id, file, body?.description, tags);
  }

  @Get()
  async findAll(@Req() req: any, @Query('businessId') businessId: string) {
    if (!businessId) throw new BadRequestException('Business ID is required');
    await this.businessService.ensureBusinessOwnership(req.user.userId, businessId);
    return this.filesService.findAll(businessId);
  }

  @Get('serve/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    return res.sendFile(filePath);
  }

  @Get(':id([0-9a-fA-F-]{36})')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const file = await this.filesService.findOne(id);
    if (!file) throw new BadRequestException('File not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, file.businessId);
    return file;
  }

  @Get(':id([0-9a-fA-F-]{36})/history')
  async getFileHistory(@Req() req: any, @Param('id') id: string) {
    const file = await this.filesService.findOne(id);
    if (!file) throw new BadRequestException('File not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, file.businessId);
    return this.filesService.getFileHistory(id);
  }

  @Get(':id([0-9a-fA-F-]{36})/download')
  async downloadFile(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const file = await this.filesService.findOne(id);
    if (!file) throw new BadRequestException('File not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, file.businessId);

    if (!file || file.isActive === false) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.url?.startsWith('http')) {
      return res.redirect(file.url);
    }

    const resolvedPath = file.url
      ? path.isAbsolute(file.url)
        ? file.url
        : path.join(process.cwd(), file.url)
      : null;

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ message: 'File not available on disk' });
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    return res.download(resolvedPath, file.originalName);
  }

  @Get('test/rag-status')
  async testRAGStatus(@Req() req: any, @Query('businessId') businessId: string) {
    if (!businessId) {
      return { error: 'businessId is required' };
    }
    await this.businessService.ensureBusinessOwnership(req.user.userId, businessId);

    const files = await this.filesService.findAll(businessId);
    const totalFiles = files.length;
    const processedFiles = files.filter(f => f.isProcessed).length;
    const totalChunks = files.reduce((sum, f) => sum + (f._count?.knowledgeChunks || 0), 0);

    // Verificar si hay chunks en BD
    const { PrismaService } = await import('../database/prisma.service');
    const prisma = new PrismaService();
    const chunksInDB = await prisma.knowledgeChunk.count({
      where: { businessId },
    });

    // Verificar Qdrant si está configurado
    let qdrantStatus = 'NOT_CONFIGURED';
    let qdrantChunks = 0;
    let qdrantUrl = process.env.QDRANT_URL;
    if (qdrantUrl && qdrantUrl.endsWith('/')) {
      qdrantUrl = qdrantUrl.slice(0, -1);
    }
    
    if (qdrantUrl) {
      try {
        const collectionName = `business_${businessId}`;
        const qdrantApiKey = process.env.QDRANT_API_KEY;
        
        const response = await fetch(`${qdrantUrl}/collections/${collectionName}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(qdrantApiKey && { 'api-key': qdrantApiKey }),
          },
        });
        
        if (response.ok) {
          const collectionData = await response.json();
          qdrantChunks = collectionData.result?.points_count || 0;
          qdrantStatus = 'CONNECTED';
        } else if (response.status === 404) {
          qdrantStatus = 'COLLECTION_NOT_FOUND';
        } else {
          qdrantStatus = 'ERROR';
        }
      } catch (error) {
        qdrantStatus = 'ERROR';
        console.error('Error checking Qdrant:', error);
      }
    }

    return {
      businessId,
      files: {
        total: totalFiles,
        processed: processedFiles,
        notProcessed: totalFiles - processedFiles,
      },
      chunks: {
        total: totalChunks,
        inDatabase: chunksInDB,
        inQdrant: qdrantChunks,
      },
      qdrant: {
        status: qdrantStatus,
        chunks: qdrantChunks,
      },
      status: chunksInDB > 0 && qdrantChunks > 0 ? 'READY' : chunksInDB > 0 ? 'PARTIAL' : 'NO_CHUNKS',
      message: chunksInDB > 0 && qdrantChunks > 0
        ? `✅ RAG está listo. Hay ${chunksInDB} chunks en BD y ${qdrantChunks} en Qdrant.`
        : chunksInDB > 0
        ? `⚠️ Hay ${chunksInDB} chunks en BD pero ${qdrantChunks} en Qdrant. Puede que necesites reprocesar los archivos.`
        : '❌ No hay chunks disponibles. Los archivos no se han procesado correctamente.',
    };
  }

  @Post('reprocess/:fileId')
  async reprocessFile(@Req() req: any, @Param('fileId') fileId: string, @Query('businessId') businessId: string) {
    if (!businessId) {
      return { error: 'businessId is required' };
    }
    await this.businessService.ensureBusinessOwnership(req.user.userId, businessId);

    try {
      const file = await this.filesService.findOne(fileId);
      if (!file || file.businessId !== businessId) {
        return { error: 'File not found or does not belong to this business' };
      }

      // Marcar como no procesado
      await this.filesService.reprocessFile(businessId, fileId);
      
      return {
        success: true,
        message: 'File queued for reprocessing',
        fileId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error reprocessing file',
      };
    }
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const file = await this.filesService.findOne(id);
    if (!file) throw new BadRequestException('File not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, file.businessId);
    return this.filesService.remove(id);
  }
}
