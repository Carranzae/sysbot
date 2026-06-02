import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { hash, compare } from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
        include: {
          businesses: true,
        },
      });
    } catch (error) {
      this.logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
        include: {
          businesses: {
            include: {
              botConfig: true,
              appointments: {
                orderBy: { createdAt: 'desc' },
                take: 10,
              },
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto): Promise<User> {
    try {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Check if email is being changed and if it's already taken
      if (updateProfileDto.email && updateProfileDto.email !== existingUser.email) {
        const emailExists = await this.findByEmail(updateProfileDto.email);
        if (emailExists) {
          throw new BadRequestException('Email already in use');
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateProfileDto,
          updatedAt: new Date(),
        },
        include: {
          businesses: true,
        },
      });

      this.logger.log(`User profile updated: ${updatedUser.id}`);
      return updatedUser;
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  async getUserStats(id: string): Promise<any> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const businesses = user.businesses || [];
      
      // Calculate stats from all businesses
      const totalBusinesses = businesses.length;
      const activeBusinesses = businesses.filter(b => b.isActive).length;
      
      // Get appointments stats
      const appointments = await this.prisma.appointment.findMany({
        where: {
          business: {
            ownerId: id,
          },
        },
      });

      const totalAppointments = appointments.length;
      const completedAppointments = appointments.filter(a => a.status === 'COMPLETED').length;
      const pendingAppointments = appointments.filter(a => a.status === 'PENDING').length;

      // Get payment stats
      const paymentReceipts = await this.prisma.paymentReceipt.findMany({
        where: {
          business: {
            ownerId: id,
          },
        },
      });

      const totalPayments = paymentReceipts.length;
      const totalRevenue = paymentReceipts.reduce((sum, payment) => sum + Number(payment.amount), 0);

      // Get files stats
      const files = await this.prisma.file.findMany({
        where: {
          business: {
            ownerId: id,
          },
        },
      });

      const totalFiles = files.length;
      const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        businesses: {
          total: totalBusinesses,
          active: activeBusinesses,
          inactive: totalBusinesses - activeBusinesses,
        },
        appointments: {
          total: totalAppointments,
          completed: completedAppointments,
          pending: pendingAppointments,
          completionRate: totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0,
        },
        payments: {
          total: totalPayments,
          totalRevenue: totalRevenue,
          averagePayment: totalPayments > 0 ? totalRevenue / totalPayments : 0,
        },
        files: {
          total: totalFiles,
          totalSize: totalFileSize,
          averageSize: totalFiles > 0 ? totalFileSize / totalFiles : 0,
        },
      };
    } catch (error) {
      this.logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  async uploadAvatar(id: string, file: Express.Multer.File): Promise<User> {
    try {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // In a real implementation, you would upload the file to a storage service
      // For now, we'll simulate the upload and store the filename
      const avatarUrl = `/uploads/avatars/${id}-${Date.now()}-${file.originalname}`;

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          avatarUrl,
          updatedAt: new Date(),
        },
        include: {
          businesses: true,
        },
      });

      this.logger.log(`Avatar uploaded for user: ${id}`);
      return updatedUser;
    } catch (error) {
      this.logger.error('Error uploading avatar:', error);
      throw error;
    }
  }

  async updatePassword(id: string, updatePasswordDto: UpdatePasswordDto): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await compare(
        updatePasswordDto.currentPassword,
        user.password,
      );

      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await hash(updatePasswordDto.newPassword, 10);

      await this.prisma.user.update({
        where: { id },
        data: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Password updated for user: ${id}`);
    } catch (error) {
      this.logger.error('Error updating password:', error);
      throw error;
    }
  }

  async getUserHistory(id: string): Promise<any> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get recent activities
      const recentAppointments = await this.prisma.appointment.findMany({
        where: {
          business: {
            ownerId: id,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          business: true,
        },
      });

      const recentPayments = await this.prisma.paymentReceipt.findMany({
        where: {
          business: {
            ownerId: id,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          business: true,
        },
      });

      const recentFiles = await this.prisma.file.findMany({
        where: {
          business: {
            ownerId: id,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          business: true,
        },
      });

      return {
        appointments: recentAppointments,
        payments: recentPayments,
        files: recentFiles,
      };
    } catch (error) {
      this.logger.error('Error getting user history:', error);
      throw error;
    }
  }

  async deactivateAccount(id: string): Promise<void> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      await this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Account deactivated: ${id}`);
    } catch (error) {
      this.logger.error('Error deactivating account:', error);
      throw error;
    }
  }

  async getUserPreferences(id: string): Promise<any> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // In a real implementation, this would fetch from a preferences table
      // For now, return default preferences
      return {
        language: 'es',
        timezone: 'America/Mexico_City',
        notifications: {
          email: true,
          whatsapp: true,
          push: false,
        },
        theme: 'light',
        dateFormat: 'DD/MM/YYYY',
      };
    } catch (error) {
      this.logger.error('Error getting user preferences:', error);
      throw error;
    }
  }

  async updateUserPreferences(id: string, preferences: any): Promise<any> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // In a real implementation, this would save to a preferences table
      // For now, just return the updated preferences
      const updatedPreferences = {
        language: preferences.language || 'es',
        timezone: preferences.timezone || 'America/Mexico_City',
        notifications: {
          email: preferences.notifications?.email ?? true,
          whatsapp: preferences.notifications?.whatsapp ?? true,
          push: preferences.notifications?.push ?? false,
        },
        theme: preferences.theme || 'light',
        dateFormat: preferences.dateFormat || 'DD/MM/YYYY',
      };

      this.logger.log(`Preferences updated for user: ${id}`);
      return updatedPreferences;
    } catch (error) {
      this.logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Delete user's businesses first (cascade delete should handle this)
      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`User deleted: ${id}`);
    } catch (error) {
      this.logger.error('Error deleting user:', error);
      throw error;
    }
  }
}
