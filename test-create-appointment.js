/**
 * Script de prueba para crear una cita y verificar que aparezca en el frontend
 * Ejecutar desde el directorio raíz: node test-create-appointment.js
 * 
 * Requiere que el backend esté corriendo y que Prisma esté configurado
 */

// Usar Prisma desde el backend
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, 'apps/backend/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function testCreateAppointment() {
  try {
    const businessId = '3067f0bf-3913-4475-aa7c-bea2bdf474d3';
    
    console.log('🧪 TEST: Crear cita de prueba');
    console.log(`BusinessId: ${businessId}`);
    console.log('');

    // Verificar que el negocio existe
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      console.error('❌ Error: Business no encontrado');
      return;
    }

    console.log(`✅ Business encontrado: ${business.name}`);
    console.log('');

    // Crear fecha para hoy a las 3 PM
    const appointmentDate = new Date();
    appointmentDate.setHours(15, 0, 0, 0); // 3 PM

    console.log('📅 Creando cita para:', appointmentDate.toLocaleString('es-ES'));
    console.log('');

    // Crear la cita
    const appointment = await prisma.appointment.create({
      data: {
        businessId: businessId,
        customerName: 'Pablo Test',
        customerPhone: '974501998',
        appointmentDate: appointmentDate,
        duration: 60,
        specialty: 'Neurología',
        status: 'PENDING',
        notes: 'Cita de prueba creada automáticamente',
      },
    });

    console.log('✅ CITA CREADA EXITOSAMENTE:');
    console.log(`  - ID: ${appointment.id}`);
    console.log(`  - Cliente: ${appointment.customerName}`);
    console.log(`  - Teléfono: ${appointment.customerPhone}`);
    console.log(`  - Fecha: ${appointment.appointmentDate.toLocaleString('es-ES')}`);
    console.log(`  - Especialidad: ${appointment.specialty}`);
    console.log(`  - Estado: ${appointment.status}`);
    console.log('');

    // Verificar que se guardó correctamente
    const verifyAppointment = await prisma.appointment.findUnique({
      where: { id: appointment.id },
    });

    if (verifyAppointment) {
      console.log('✅ VERIFICACIÓN: Cita encontrada en BD');
      console.log('');
    } else {
      console.error('❌ ERROR: Cita NO encontrada en BD después de crear');
      console.log('');
    }

    // Listar todas las citas del negocio
    const allAppointments = await prisma.appointment.findMany({
      where: { businessId },
      orderBy: { appointmentDate: 'desc' },
    });

    console.log(`📊 Total de citas en BD para este negocio: ${allAppointments.length}`);
    allAppointments.forEach((apt, index) => {
      console.log(`  ${index + 1}. ${apt.customerName} - ${apt.appointmentDate.toLocaleString('es-ES')} - ${apt.specialty || 'N/A'}`);
    });
    console.log('');

    console.log('✅ TEST COMPLETADO');
    console.log('');
    console.log('🔍 PRÓXIMOS PASOS:');
    console.log('1. Abre el frontend en http://localhost:3000');
    console.log('2. Ve a la sección de Citas');
    console.log('3. Deberías ver la cita creada');
    console.log('4. Si no aparece, verifica que el businessId coincida');

  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateAppointment();

