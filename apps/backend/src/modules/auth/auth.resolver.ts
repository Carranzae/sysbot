import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => String)
  async register(@Args('input') registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return result.access_token;
  }

  @Mutation(() => String)
  async login(@Args('input') loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return result.access_token;
  }
}
