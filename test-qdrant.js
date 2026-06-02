// Script para probar la conexión con Qdrant
// Ejecución: node test-qdrant.js [URL_DE_QDRANT]
// Ejemplo: node test-qdrant.js http://localhost:6333
// O si tienes variables en el entorno: QDRANT_URL=http://... node test-qdrant.js

const url = process.argv[2] || process.env.QDRANT_URL || 'http://localhost:6333';
const apiKey = process.env.QDRANT_API_KEY;

console.log(`Checking connection to Qdrant at: ${url}`);

async function checkQdrant() {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['api-key'] = apiKey;
    }

    const start = Date.now();
    const response = await fetch(`${url}/collections`, {
      method: 'GET',
      headers,
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      console.log(`\n✅ Successfully connected to Qdrant! (Response time: ${duration}ms)`);
      console.log('Collections list:', data.result?.collections || data.result || data);
    } else {
      const body = await response.text();
      console.log(`\n❌ Failed to connect to Qdrant. Status: ${response.status} ${response.statusText}`);
      console.log('Response body:', body);
    }
  } catch (error) {
    console.error('\n❌ Connection error:', error.message);
  }
}

checkQdrant();
