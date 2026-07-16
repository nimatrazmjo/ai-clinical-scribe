import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { LoginUseCase } from './login.use-case';
import { LoginDto } from './login.dto';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserEntity } from '../identity/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
    });
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: UserEntity): {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  } {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
