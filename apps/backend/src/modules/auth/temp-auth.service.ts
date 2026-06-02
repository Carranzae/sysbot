import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TempAuthService {
  constructor(private jwtService: JwtService) {}

  async login(email: string, password: string) {
    // Temporal: validar contra hardcoded user
    if (email === 'admin@syst.com' && password === 'nueva123') {
      const payload = { email, sub: 'admin-id', role: 'SUPER_ADMIN' };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: 'admin-id',
          email: 'admin@syst.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'SUPER_ADMIN',
          needsOnboarding: false,
        },
      };
    }
    throw new Error('Invalid credentials');
  }
}
