import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { SessionService } from './session.service';
import { SessionGuard } from './guard/session.guard';
import { PerformanceService } from 'src/common/monitoring/performance.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private performanceService: PerformanceService,
  ) {}

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  async getMetrics() {
    const metrics = this.performanceService.getMetricsSummary();
    return {
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login({
      loginDto,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown',
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, SessionGuard)
  async logout(@Headers('session-id') sessionId: string) {
    return this.authService.logout(sessionId);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 5 minutes
  async requestPasswordReset(@Body() resetDto: RequestResetDto) {
    return this.authService.requestPasswordReset(resetDto.email);
  }

  @Post('password-reset/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetDto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: Request & { user: any }) {
    const sessions = await this.sessionService.getUserSessions(req.user.id);
    return { sessions };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async terminateSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request & { user: any },
  ) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.userId !== req.user.id) {
      throw new UnauthorizedException('Unauthorized to terminate this session');
    }

    await this.sessionService.destroySession(sessionId);
    return { message: 'Session terminated successfully' };
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async terminateAllSessions(
    @Headers('session-id') currentSessionId: string,
    @Req() req: Request & { user: any },
  ) {
    const sessions = await this.sessionService.getUserSessions(req.user.id);

    for (const sessionId of sessions) {
      // Skip the current session
      if (sessionId !== currentSessionId) {
        await this.sessionService.destroySession(sessionId);
      }
    }

    return { message: 'All other sessions terminated successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: Request & { user: any }) {
    // Remove sensitive information
    const { password, ...user } = req.user;
    return user;
  }
}
