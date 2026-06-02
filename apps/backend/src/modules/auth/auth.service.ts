import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { PrismaService } from '../database/prisma.service';
import { UserRole, UpdateUserDto } from '../users/dto/user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) { }

  async validateUser(email: string, password: string): Promise<any> {
    // Usar base de datos para validación
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      if (!user.isActive) {
        throw new Error('Cuenta desactivada. Contacte al administrador.')
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      })
      const { password, ...result } = user;
      return result;
    }
    
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const businesses = await this.prisma.business.findMany({
      where: { ownerId: user.id },
      select: { id: true },
      take: 1,
    });

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...user,
        needsOnboarding: businesses.length === 0,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      role: ((registerDto.role as UserRole) || UserRole.BUSINESS_OWNER),
    });

    const { password, ...result } = user;
    const payload = { email: result.email, sub: result.id, role: result.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...result,
        needsOnboarding: true,
      },
    };
  }

  async updateMe(userId: string, updateUserDto: UpdateUserDto) {
    const data = { ...updateUserDto };
    
    // Hash password if it is being updated
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    // Role and email should probably not be updated via this endpoint for security
    // unless you want to allow it. For now, let's keep them if provided, or remove them.
    delete data.role;
    delete data.email;

    return this.usersService.update(userId, data);
  }

  async getOnboardingStatus(userId: string) {
    try {
      console.log('🔍 Verificando onboarding para userId:', userId);

      // Verificar negocios reales del usuario en la base de datos
      const businesses = await this.prisma.business.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true, industryType: true },
      });

      console.log('📊 Negocios encontrados:', businesses.length);
      businesses.forEach((business, index) => {
        console.log(`   ${index + 1}. ${business.name} (${business.id})`);
      });

      const result = {
        needsOnboarding: businesses.length === 0,
        hasBusiness: businesses.length > 0,
        businesses: businesses,
      };

      console.log('✅ Resultado onboarding:', result);
      return result;
    } catch (error) {
      console.error('❌ Error checking onboarding status:', error);
      // Si hay error, asumimos que necesita onboarding por seguridad
      return {
        needsOnboarding: true,
        hasBusiness: false,
        businesses: [],
      };
    }
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    // En producción esto iría a S3 o similar. Aquí guardamos local.
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatarUrl: true,
      },
    });
  }

  async validateToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
