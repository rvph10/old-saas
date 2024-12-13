import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  Headers,
  Get,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login({
      loginDto,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown',
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Headers('session-id') sessionId: string) {
    return this.authService.logout(sessionId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  async terminateSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request & { user: any },
  ) {
    const session = await this.sessionService.getSession(sessionId);
    if (session?.userId === req.user.id) {
      await this.sessionService.destroySession(sessionId);
      return { message: 'Session terminated successfully' };
    }
    throw new UnauthorizedException();
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
