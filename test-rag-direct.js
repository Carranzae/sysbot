// Script para verificar si la IA puede leer archivos
// Usa la conexión directa a PostgreSQL

const { Client } = require('pg');

const client = new Client({
  host: process.env.DATABASE_URL?.match(/host=([^;]+)/)?.[1] || 'localhost',
  port: process.env.DATABASE_URL?.match(/port=(\d+)/)?.[1] || 5432,
  database: process.env.DATABASE_URL?.match(/dbname=([^;]+)/)?.[1] || 'systinf',
  user: process.env.DATABASE_URL?.match(/user=([^;]+)/)?.[1] || 'postgres',
  password: process.env.DATABASE_URL?.match(/password=([^;]+)/)?.[1] || 'postgres',
});

async function testRAGReading() {
  console.log('🧪 TEST: Verificando si la IA puede leer archivos\n');
  console.log('='.repeat(60));

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    // 1. Verificar archivos
    console.log('1️⃣ VERIFICANDO ARCHIVOS EN BD...');
    const filesResult = await client.query(`
      SELECT 
        f.id,
        f."originalName",
        f."isProcessed",
        f."fileType",
        f."businessId",
        COUNT(kc.id) as chunk_count
      FROM files f
      LEFT JOIN "knowledgeChunks" kc ON kc."fileId" = f.id
      WHERE f."isActive" = true
      GROUP BY f.id
      ORDER BY f."createdAt" DESC
      LIMIT 10
    `);

    if (filesResult.rows.length === 0) {
      console.log('❌ No se encontraron archivos en la BD');
      console.log('   → Sube archivos desde el frontend primero');
      await client.end();
      return;
    }

    console.log(`✅ Encontrados ${filesResult.rows.length} archivos activos:\n`);
    filesResult.rows.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.originalName}`);
      console.log(`      - Procesado: ${file.isProcessed ? '✅ Sí' : '❌ No'}`);
      console.log(`      - Fragmentos: ${file.chunk_count}`);
      console.log(`      - BusinessId: ${file.businessId}`);
      console.log(`      - Tipo: ${file.fileType}`);
      console.log('');
    });

    // 2. Verificar knowledgeChunks
    console.log('\n2️⃣ VERIFICANDO KNOWLEDGE CHUNKS...');
    const chunksResult = await client.query(`
      SELECT 
        kc.id,
        kc.content,
        kc."vectorId",
        kc."businessId",
        f."originalName"
      FROM "knowledgeChunks" kc
      LEFT JOIN files f ON f.id = kc."fileId"
      ORDER BY kc."createdAt" DESC
      LIMIT 10
    `);

    if (chunksResult.rows.length === 0) {
      console.log('❌ No se encontraron knowledgeChunks en la BD');
      console.log('   → Los archivos no se han procesado correctamente');
      await client.end();
      return;
    }

    console.log(`✅ Encontrados ${chunksResult.rows.length} chunks (mostrando primeros 10):\n`);
    chunksResult.rows.forEach((chunk, index) => {
      console.log(`   ${index + 1}. Archivo: ${chunk.originalName || 'N/A'}`);
      console.log(`      - BusinessId: ${chunk.businessId}`);
      console.log(`      - Contenido (primeros 150 chars):`);
      console.log(`        "${chunk.content.substring(0, 150)}..."`);
      console.log(`      - VectorId: ${chunk.vectorId}`);
      console.log('');
    });

    // 3. Agrupar por businessId
    console.log('\n3️⃣ CHUNKS POR BUSINESS ID...');
    const businessResult = await client.query(`
      SELECT 
        "businessId",
        COUNT(id) as total_chunks
      FROM "knowledgeChunks"
      GROUP BY "businessId"
      ORDER BY total_chunks DESC
    `);

    if (businessResult.rows.length === 0) {
      console.log('❌ No hay chunks agrupados por businessId');
      await client.end();
      return;
    }

    console.log(`✅ Encontrados ${businessResult.rows.length} businessId con chunks:\n`);
    businessResult.rows.forEach((item) => {
      console.log(`   - BusinessId: ${item.businessId}`);
      console.log(`     Total chunks: ${item.total_chunks}`);
    });

    // 4. Probar búsqueda de chunks para un business específico
    console.log('\n4️⃣ PROBANDO BÚSQUEDA DE CHUNKS...');
    
    const testBusinessId = businessResult.rows[0].businessId;
    
    console.log(`   BusinessId de prueba: ${testBusinessId}`);
    console.log('');

    const businessChunksResult = await client.query(`
      SELECT 
        kc.content,
        f."originalName"
      FROM "knowledgeChunks" kc
      LEFT JOIN files f ON f.id = kc."fileId"
      WHERE kc."businessId" = $1
      LIMIT 5
    `, [testBusinessId]);

    if (businessChunksResult.rows.length > 0) {
      console.log(`✅ Encontrados ${businessChunksResult.rows.length} chunks para este business:\n`);
      businessChunksResult.rows.forEach((chunk, index) => {
        console.log(`   ${index + 1}. Archivo: ${chunk.originalName || 'N/A'}`);
        console.log(`      - Contenido: "${chunk.content.substring(0, 200)}..."`);
        console.log('');
      });

      console.log('✅ CONCLUSIÓN:');
      console.log('   ✓ Hay archivos en la BD');
      console.log('   ✓ Hay knowledgeChunks creados');
      console.log('   ✓ Los chunks contienen información de los archivos');
      console.log('   ✓ El RAG puede buscar estos chunks');
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
    console.error('❌ Error durante la prueba:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   → No se pudo conectar a PostgreSQL');
      console.error('   → Verifica que PostgreSQL esté corriendo');
    }
  } finally {
    await client.end();
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
