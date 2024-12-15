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
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './services/auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { SessionService } from './services/session.service';
import { SessionGuard } from './guard/session.guard';
import { PerformanceService } from 'src/common/monitoring/performance.service';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verifiy-email.dto';
import { DeviceService } from './services/device.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private performanceService: PerformanceService,
    private deviceService: DeviceService,
  ) {}

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getUserDevices(@Req() req: Request & { user: any }) {
    return this.deviceService.getUserDevices(req.user.id);
  }

  @Post('devices/:deviceId/trust')
  @UseGuards(JwtAuthGuard)
  async trustDevice(
    @Param('deviceId') deviceId: string,
    @Req() req: Request & { user: any },
  ) {
    await this.deviceService.setDeviceTrusted(deviceId, req.user.id, true);
    return { message: 'Device trusted successfully' };
  }

  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  async removeDevice(
    @Param('deviceId') deviceId: string,
    @Headers('session-id') currentSessionId: string,
    @Req() req: Request & { user: any },
  ) {
    // Check if trying to remove current device
    const currentSession =
      await this.sessionService.getSession(currentSessionId);
    if (currentSession?.deviceId === deviceId) {
      throw new BadRequestException('Cannot remove currently active device');
    }

    await this.deviceService.removeDevice(deviceId, req.user.id);
    const revokedSessions = await this.sessionService.revokeDeviceSessions(
      req.user.id,
      deviceId,
    );

    return {
      message: 'Device removed successfully',
      sessionsRevoked: revokedSessions,
    };
  }

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
  @Throttle({ default: { limit: 3, ttl: 300000 } })
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

  @Delete('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async terminateAllSessions(
    @Headers('session-id') currentSessionId: string,
    @Req() req: Request & { user: any },
    @Body() body: { keepCurrentSession?: boolean },
  ) {
    const result = await this.authService.logoutAllDevices(
      req.user.id,
      body.keepCurrentSession ? currentSessionId : undefined,
    );
    return result;
  }

  @Post('extend-session')
  @UseGuards(JwtAuthGuard, SessionGuard)
  async extendUserSession(
    @Headers('session-id') sessionId: string,
    @Body() body: { duration?: number },
  ) {
    await this.sessionService.extendSession(sessionId, body.duration);
    return { message: 'Session extended successfully' };
  }

  @Post('block')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async blockUser(
    @Headers('session-id') currentSessionId: string,
    @Req() req: Request & { user: any },
    @Body() blockAccountId: string,
  ) {
    return this.authService.blockAccount(blockAccountId);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(resendDto.email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: Request & { user: any }) {
    const { password, ...user } = req.user;
    return user;
  }
}
