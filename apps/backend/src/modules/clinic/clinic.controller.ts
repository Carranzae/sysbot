import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ClinicService } from './clinic.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('clinic')
export class ClinicController {
  constructor(
    private readonly clinicService: ClinicService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  /**
   * Endpoint receptor: POST /v1/integrations/appointments
   * Recibe las nuevas citas del sistema HIS de la clínica
   */
  @Post('integrations/appointments')
  async handleIncomingAppointment(
    @Query('businessId') businessId: string,
    @Body() body: any
  ) {
    return this.clinicService.createAppointmentFromIntegration(businessId, body);
  }

  /**
   * Endpoint receptor: POST /v1/integrations/invoices
   * Recibe la factura cobrada por la clínica y calcula comisiones automáticamente
   */
  @Post('integrations/invoices')
  async handleIncomingInvoice(
    @Query('businessId') businessId: string,
    @Body() body: any
  ) {
    return this.clinicService.processInvoiceCommission(businessId, body);
  }

  /**
   * Endpoint de consulta: GET /v1/slots/disponibles
   * Conecta al HIS de la clínica para ver qué horas tiene libres el médico
   */
  @Get('slots/disponibles')
  async getAvailableSlots(
    @Query('businessId') businessId: string,
    @Query('date') dateStr: string,
    @Query('specialty') specialty: string,
    @Query('duration') duration?: number
  ) {
    const date = new Date(dateStr);
    return this.appointmentsService.findAvailableSlotsBySpecialty(
      businessId,
      date,
      specialty,
      duration ? Number(duration) : 60
    );
  }

  /**
   * Endpoint de consulta: GET /v1/patients/documents
   * Permite descargar PDF de recetas o laboratorios del paciente
   */
  @Get('patients/documents')
  async getPatientDocuments(
    @Query('businessId') businessId: string,
    @Query('customerPhone') customerPhone: string
  ) {
    return this.clinicService.getPatientDocuments(businessId, customerPhone);
  }

  /**
   * Endpoint receptor: POST /v1/inventory/deduct
   * Orden de descarga de insumos cuando se cierra un expediente médico
   */
  @Post('inventory/deduct')
  async deductInventory(
    @Query('businessId') businessId: string,
    @Body('procedureName') procedureName: string
  ) {
    return this.clinicService.deductInventoryForProcedure(businessId, procedureName);
  }

  /**
   * Configuración de contratos de comisión de médicos
   */
  @Post('clinic/contracts')
  @UseGuards(JwtAuthGuard)
  async configureContract(
    @Query('businessId') businessId: string,
    @Body() body: any
  ) {
    return this.clinicService.configureDoctorContract(businessId, body);
  }

  @Get('clinic/contracts')
  @UseGuards(JwtAuthGuard)
  async getContracts(
    @Query('businessId') businessId: string
  ) {
    return this.clinicService.getContracts(businessId);
  }

  /**
   * Creación y actualización de stock de insumos médicos
   */
  @Post('clinic/inventory')
  @UseGuards(JwtAuthGuard)
  async createInventory(
    @Query('businessId') businessId: string,
    @Body() body: any
  ) {
    return this.clinicService.createInventoryItem(businessId, body);
  }

  @Get('clinic/inventory')
  @UseGuards(JwtAuthGuard)
  async getInventory(
    @Query('businessId') businessId: string
  ) {
    return this.clinicService.getInventoryItems(businessId);
  }

  /**
   * Configuración de insumos necesarios para procedimientos médicos
   */
  @Post('clinic/supplies')
  @UseGuards(JwtAuthGuard)
  async configureSupplies(
    @Query('businessId') businessId: string,
    @Body() body: any
  ) {
    return this.clinicService.configureProcedureSupplies(businessId, body);
  }

  @Get('clinic/supplies')
  @UseGuards(JwtAuthGuard)
  async getSupplies(
    @Query('businessId') businessId: string
  ) {
    return this.clinicService.getProcedureSupplies(businessId);
  }

  /**
   * Listado de liquidaciones y balances de billeteras de médicos
   */
  @Get('clinic/doctors/wallet')
  @UseGuards(JwtAuthGuard)
  async getDoctorPayouts(
    @Query('businessId') businessId: string
  ) {
    return this.clinicService.getDoctorPayouts(businessId);
  }

  /**
   * Notificación manual de resultados de laboratorio
   */
  @Post('clinic/notify-lab')
  @UseGuards(JwtAuthGuard)
  async simulateLabNotify(
    @Query('businessId') businessId: string,
    @Body('fileId') fileId: string
  ) {
    return this.clinicService.notifyNewLabResult(businessId, fileId);
  }
}
