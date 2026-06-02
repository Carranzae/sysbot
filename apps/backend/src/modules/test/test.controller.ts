import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('test')
export class TestController {
  constructor(private prisma: PrismaService) {}

  @Get('user')
  async testUser() {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: 'admin@syst.com' },
        select: { email: true, isActive: true, role: true }
      });
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
