import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotConfigService } from './bot-config.service';
import { UpdateBotConfigDto } from './dto/update-bot-config.dto';
import { TestBotConfigDto } from './dto/test-bot-config.dto';

@Controller('bot-config')
@UseGuards(JwtAuthGuard)
export class BotConfigController {
  private readonly logger = new Logger(BotConfigController.name);

  constructor(private readonly botConfigService: BotConfigService) {}

  @Get(':businessId')
  async getBotConfig(@Param('businessId') businessId: string, @Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const botConfig = await this.botConfigService.findByBusinessId(businessId);
      
      if (!botConfig) {
        // Create default config if it doesn't exist
        const defaultConfig = await this.botConfigService.createDefaultConfig(businessId);
        return {
          success: true,
          data: defaultConfig,
          message: 'Default bot configuration created'
        };
      }

      return {
        success: true,
        data: botConfig,
        message: 'Bot configuration retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting bot config:', error);
      throw error;
    }
  }

  @Put(':businessId')
  async updateBotConfig(
    @Param('businessId') businessId: string,
    @Body() updateBotConfigDto: UpdateBotConfigDto,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const updatedConfig = await this.botConfigService.updateBotConfig(businessId, updateBotConfigDto);
      
      return {
        success: true,
        data: updatedConfig,
        message: 'Bot configuration updated successfully'
      };
    } catch (error) {
      this.logger.error('Error updating bot config:', error);
      throw error;
    }
  }

  @Post(':businessId/test')
  async testBotConfig(
    @Param('businessId') businessId: string,
    @Body() testBotConfigDto: TestBotConfigDto,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const testResult = await this.botConfigService.testBotConfig(businessId, testBotConfigDto);
      
      return {
        success: true,
        data: testResult,
        message: 'Bot configuration tested successfully'
      };
    } catch (error) {
      this.logger.error('Error testing bot config:', error);
      throw error;
    }
  }

  @Post(':businessId/reset')
  async resetBotConfig(
    @Param('businessId') businessId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const resetConfig = await this.botConfigService.resetBotConfig(businessId);
      
      return {
        success: true,
        data: resetConfig,
        message: 'Bot configuration reset to default successfully'
      };
    } catch (error) {
      this.logger.error('Error resetting bot config:', error);
      throw error;
    }
  }

  @Post(':businessId/activate')
  async activateBot(
    @Param('businessId') businessId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const activatedConfig = await this.botConfigService.activateBot(businessId);
      
      return {
        success: true,
        data: activatedConfig,
        message: 'Bot activated successfully'
      };
    } catch (error) {
      this.logger.error('Error activating bot:', error);
      throw error;
    }
  }

  @Post(':businessId/deactivate')
  async deactivateBot(
    @Param('businessId') businessId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const deactivatedConfig = await this.botConfigService.deactivateBot(businessId);
      
      return {
        success: true,
        data: deactivatedConfig,
        message: 'Bot deactivated successfully'
      };
    } catch (error) {
      this.logger.error('Error deactivating bot:', error);
      throw error;
    }
  }

  @Get(':businessId/logs')
  async getBotLogs(
    @Param('businessId') businessId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const logs = await this.botConfigService.getBotLogs(businessId);
      
      return {
        success: true,
        data: logs,
        message: 'Bot logs retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting bot logs:', error);
      throw error;
    }
  }

  @Get(':businessId/stats')
  async getBotStats(
    @Param('businessId') businessId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const stats = await this.botConfigService.getBotStats(businessId);
      
      return {
        success: true,
        data: stats,
        message: 'Bot statistics retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting bot stats:', error);
      throw error;
    }
  }

  @Post(':businessId/export')
  async exportBotConfig(
    @Param('businessId') businessId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const exportData = await this.botConfigService.exportBotConfig(businessId);
      
      return {
        success: true,
        data: exportData,
        message: 'Bot configuration exported successfully'
      };
    } catch (error) {
      this.logger.error('Error exporting bot config:', error);
      throw error;
    }
  }

  @Post(':businessId/import')
  async importBotConfig(
    @Param('businessId') businessId: string,
    @Body() importData: any,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.botConfigService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const importedConfig = await this.botConfigService.importBotConfig(businessId, importData);
      
      return {
        success: true,
        data: importedConfig,
        message: 'Bot configuration imported successfully'
      };
    } catch (error) {
      this.logger.error('Error importing bot config:', error);
      throw error;
    }
  }
}
