import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { User } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const user = await this.userService.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Remove sensitive information
      const { password, ...userProfile } = user;
      
      return {
        success: true,
        data: userProfile,
        message: 'Profile retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting user profile:', error);
      throw error;
    }
  }

  @Put('profile')
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const updatedUser = await this.userService.updateProfile(userId, updateProfileDto);
      
      // Remove sensitive information
      const { password, ...userProfile } = updatedUser;
      
      return {
        success: true,
        data: userProfile,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  @Get('stats')
  async getUserStats(@Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const stats = await this.userService.getUserStats(userId);
      
      return {
        success: true,
        data: stats,
        message: 'User stats retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException('File too large. Maximum size is 5MB');
      }

      const updatedUser = await this.userService.uploadAvatar(userId, file);
      
      // Remove sensitive information
      const { password, ...userProfile } = updatedUser;
      
      return {
        success: true,
        data: userProfile,
        message: 'Avatar uploaded successfully'
      };
    } catch (error) {
      this.logger.error('Error uploading avatar:', error);
      throw error;
    }
  }

  @Put('password')
  async updatePassword(
    @Request() req,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      await this.userService.updatePassword(userId, updatePasswordDto);
      
      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error) {
      this.logger.error('Error updating password:', error);
      throw error;
    }
  }

  @Get('history')
  async getUserHistory(@Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const history = await this.userService.getUserHistory(userId);
      
      return {
        success: true,
        data: history,
        message: 'User history retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting user history:', error);
      throw error;
    }
  }

  @Post('deactivate')
  async deactivateAccount(@Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      await this.userService.deactivateAccount(userId);
      
      return {
        success: true,
        message: 'Account deactivated successfully'
      };
    } catch (error) {
      this.logger.error('Error deactivating account:', error);
      throw error;
    }
  }

  @Get('preferences')
  async getUserPreferences(@Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const preferences = await this.userService.getUserPreferences(userId);
      
      return {
        success: true,
        data: preferences,
        message: 'User preferences retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting user preferences:', error);
      throw error;
    }
  }

  @Put('preferences')
  async updateUserPreferences(
    @Request() req,
    @Body() preferences: any,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const updatedPreferences = await this.userService.updateUserPreferences(userId, preferences);
      
      return {
        success: true,
        data: updatedPreferences,
        message: 'User preferences updated successfully'
      };
    } catch (error) {
      this.logger.error('Error updating user preferences:', error);
      throw error;
    }
  }
}
