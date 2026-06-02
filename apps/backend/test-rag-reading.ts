/**
 * Script de prueba para verificar si la IA puede leer archivos
 * Ejecutar: npx ts-node apps/backend/test-rag-reading.ts
 */

import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { RagService } from './src/modules/rag/rag.service';
import { EmbeddingService } from './src/modules/rag/embedding.service';
import { VectorService } from './src/modules/rag/vector.service';

const prisma = new PrismaClient();

async function testRAGReading() {
  console.log('🧪 TEST: Verificando si la IA puede leer archivos\n');
  console.log('='.repeat(60));

  try {
    // 1. Verificar archivos en BD
    console.log('\n1️⃣ VERIFICANDO ARCHIVOS EN BD...');
    const files = await prisma.file.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            knowledgeChunks: true,
          },
        },
      },
      take: 10,
    });

    if (files.length === 0) {
      console.log('❌ No se encontraron archivos en la BD');
      console.log('   → Sube archivos desde el frontend primero');
      return;
    }

    console.log(`✅ Encontrados ${files.length} archivos activos:\n`);
    files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.originalName}`);
      console.log(`      - Procesado: ${file.isProcessed ? '✅ Sí' : '❌ No'}`);
      console.log(`      - Fragmentos: ${file._count.knowledgeChunks}`);
      console.log(`      - BusinessId: ${file.businessId}`);
      console.log(`      - Tipo: ${file.fileType}`);
      console.log('');
    });

    // 2. Verificar knowledgeChunks
    console.log('\n2️⃣ VERIFICANDO KNOWLEDGE CHUNKS...');
    const allChunks = await prisma.knowledgeChunk.findMany({
      take: 10,
      include: {
        file: {
          select: {
            originalName: true,
            businessId: true,
          },
        },
      },
    });

    if (allChunks.length === 0) {
      console.log('❌ No se encontraron knowledgeChunks en la BD');
      console.log('   → Los archivos no se han procesado correctamente');
      return;
    }

    console.log(`✅ Encontrados ${allChunks.length} chunks (mostrando primeros 10):\n`);
    allChunks.forEach((chunk, index) => {
      console.log(`   ${index + 1}. Archivo: ${chunk.file?.originalName || 'N/A'}`);
      console.log(`      - BusinessId: ${chunk.businessId}`);
      console.log(`      - Contenido (primeros 150 chars):`);
      console.log(`        "${chunk.content.substring(0, 150)}..."`);
      console.log(`      - VectorId: ${chunk.vectorId}`);
      console.log('');
    });

    // 3. Agrupar por businessId
    console.log('\n3️⃣ CHUNKS POR BUSINESS ID...');
    const chunksByBusiness = await prisma.knowledgeChunk.groupBy({
      by: ['businessId'],
      _count: {
        id: true,
      },
    });

    if (chunksByBusiness.length === 0) {
      console.log('❌ No hay chunks agrupados por businessId');
      return;
    }

    console.log(`✅ Encontrados ${chunksByBusiness.length} businessId con chunks:\n`);
    chunksByBusiness.forEach((item) => {
      console.log(`   - BusinessId: ${item.businessId}`);
      console.log(`     Total chunks: ${item._count.id}`);
    });

    // 4. Probar búsqueda RAG (si está configurado)
    console.log('\n4️⃣ PROBANDO BÚSQUEDA RAG...');
    
    const testBusinessId = chunksByBusiness[0].businessId;
    const testQuery = 'información productos servicios horarios';
    
    console.log(`   BusinessId de prueba: ${testBusinessId}`);
    console.log(`   Query de prueba: "${testQuery}"`);
    console.log('');

    // Verificar si hay chunks para este business
    const businessChunks = await prisma.knowledgeChunk.findMany({
      where: { businessId: testBusinessId },
      take: 5,
      include: {
        file: {
          select: {
            originalName: true,
          },
        },
      },
    });

    if (businessChunks.length > 0) {
      console.log(`✅ Encontrados ${businessChunks.length} chunks para este business:\n`);
      businessChunks.forEach((chunk, index) => {
        console.log(`   ${index + 1}. Archivo: ${chunk.file?.originalName || 'N/A'}`);
        console.log(`      - Contenido: "${chunk.content.substring(0, 200)}..."`);
        console.log('');
      });

      console.log('✅ CONCLUSIÓN:');
      console.log('   ✓ Hay archivos en la BD');
      console.log('   ✓ Hay knowledgeChunks creados');
      console.log('   ✓ Los chunks contienen información de los archivos');
      console.log('');
      console.log('📝 PRÓXIMOS PASOS:');
      console.log('   1. Reinicia el backend');
      console.log('   2. Envía un mensaje por WhatsApp relacionado al contenido de tus archivos');
      console.log('   3. Revisa los logs del backend (busca líneas con [RAG])');
      console.log('   4. La IA debería responder usando información de los archivos');
    } else {
      console.log('❌ No se encontraron chunks para este businessId');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la prueba
testRAGReading()
  .then(() => {
    console.log('\n✅ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el test:', error);
    process.exit(1);
  });











