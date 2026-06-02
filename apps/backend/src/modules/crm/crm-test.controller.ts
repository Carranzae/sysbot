import { Controller, Get, Post, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CRMTestService } from './crm-test.service';

@Controller('crm/test')
@UseGuards(JwtAuthGuard)
export class CRMTestController {
  constructor(private readonly crmTestService: CRMTestService) {}

  @Get('available')
  async getAvailableCRMs() {
    try {
      const crms = await this.crmTestService.getAvailableCRMs();
      return {
        success: true,
        crms
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get available CRMs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('all')
  async testAllCRMs() {
    try {
      const results = await this.crmTestService.testAllCRMs();
      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to test CRMs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  async getTestStatus() {
    return {
      success: true,
      message: 'CRM Test Service is running',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /crm/test/available - List available CRM providers',
        'POST /crm/test/all - Test all CRM integrations'
      ]
    };
  }
}
