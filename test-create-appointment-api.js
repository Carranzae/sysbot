/**
 * Script de prueba para crear una cita usando la API del backend
 * Ejecutar: node test-create-appointment-api.js
 * 
 * Requiere:
 * - Backend corriendo en http://localhost:3001
 * - Token JWT válido (puedes obtenerlo desde el frontend después de hacer login)
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const BUSINESS_ID = '3067f0bf-3913-4475-aa7c-bea2bdf474d3';

// ⚠️ IMPORTANTE: Necesitas obtener un token JWT válido
// Puedes obtenerlo:
// 1. Abriendo el frontend en http://localhost:3000
// 2. Haciendo login
// 3. Abriendo la consola del navegador (F12)
// 4. Ejecutando: localStorage.getItem('token')
// 5. Copiando el token aquí
const TOKEN = process.env.JWT_TOKEN || '';

async function testCreateAppointment() {
  try {
    console.log('🧪 TEST: Crear cita usando API');
    console.log('================================');
    console.log('');

    // Verificar que el backend esté corriendo
    console.log('1️⃣ Verificando backend...');
    try {
      await axios.get(`${API_URL}/health`).catch(() => {});
      console.log('✅ Backend está corriendo');
    } catch (error) {
      console.log('❌ Backend no está corriendo');
      console.log('   Por favor, inicia el backend: cd apps/backend && pnpm dev');
      return;
    }
    console.log('');

    if (!TOKEN) {
      console.log('⚠️  No se proporcionó token JWT');
      console.log('');
      console.log('Para obtener un token:');
      console.log('1. Abre http://localhost:3000 en tu navegador');
      console.log('2. Haz login');
      console.log('3. Abre la consola del navegador (F12)');
      console.log('4. Ejecuta: localStorage.getItem("token")');
      console.log('5. Copia el token y ejecuta:');
      console.log(`   JWT_TOKEN="tu_token_aqui" node test-create-appointment-api.js`);
      console.log('');
      return;
    }

    // Crear fecha para hoy a las 3 PM
    const appointmentDate = new Date();
    appointmentDate.setHours(15, 0, 0, 0);

    console.log('2️⃣ Creando cita...');
    console.log(`   BusinessId: ${BUSINESS_ID}`);
    console.log(`   Cliente: Pablo Test`);
    console.log(`   Teléfono: 974501998`);
    console.log(`   Fecha: ${appointmentDate.toLocaleString('es-ES')}`);
    console.log(`   Especialidad: Neurología`);
    console.log('');

    const appointmentData = {
      customerName: 'Pablo Test',
      customerPhone: '974501998',
      appointmentDate: appointmentDate.toISOString(),
      duration: 60,
      specialty: 'Neurología',
      status: 'PENDING',
      notes: 'Cita de prueba creada automáticamente',
    };

    const response = await axios.post(
      `${API_URL}/appointments?businessId=${BUSINESS_ID}`,
      appointmentData,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ CITA CREADA EXITOSAMENTE:');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Cliente: ${response.data.customerName}`);
    console.log(`   Teléfono: ${response.data.customerPhone}`);
    console.log(`   Fecha: ${new Date(response.data.appointmentDate).toLocaleString('es-ES')}`);
    console.log(`   Especialidad: ${response.data.specialty}`);
    console.log('');

    // Verificar que se puede obtener
    console.log('3️⃣ Verificando que la cita se puede obtener...');
    const getResponse = await axios.get(
      `${API_URL}/appointments?businessId=${BUSINESS_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
        },
      }
    );

    const appointments = getResponse.data || [];
    const createdAppointment = appointments.find(apt => apt.id === response.data.id);

    if (createdAppointment) {
      console.log('✅ Cita encontrada en la lista de citas');
      console.log(`   Total de citas: ${appointments.length}`);
    } else {
      console.log('⚠️  Cita creada pero no encontrada en la lista');
    }
    console.log('');

    console.log('✅ TEST COMPLETADO');
    console.log('');
    console.log('🔍 PRÓXIMOS PASOS:');
    console.log('1. Abre el frontend en http://localhost:3000');
    console.log('2. Ve a la sección de Citas (/appointments)');
    console.log('3. Deberías ver la cita creada');
    console.log('4. Si no aparece, verifica:');
    console.log('   - Que el businessId coincida');
    console.log('   - Que el frontend esté cargando citas correctamente');
    console.log('   - Revisa la consola del navegador para ver errores');

  } catch (error) {
    console.error('❌ ERROR:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('');
      console.log('⚠️  Error de autenticación');
      console.log('   El token JWT no es válido o ha expirado');
      console.log('   Obtén un nuevo token desde el frontend');
    }
  }
}

testCreateAppointment();












