import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { LoginUseCase } from './login.use-case';
import { LoginDto } from './login.dto';

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
}
