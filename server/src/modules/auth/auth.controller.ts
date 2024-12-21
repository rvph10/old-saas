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
  Res,
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
import { Enable2FADto, Verify2FADto } from './dto/2fa.dto';
import { TwoFactorService } from './services/two-factor.service';
import { LocationService } from './services/location.service';
import { Response } from 'express';
import * as cookieParser from 'cookie-parser';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private performanceService: PerformanceService,
    private deviceService: DeviceService,
    private twoFactorService: TwoFactorService,
    private locationService: LocationService,
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
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login({
      loginDto,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    });

    // Handle 2FA case separately
    if ('requires2FA' in result) {
      return result; // Return early if 2FA is required
    }

    // Set cookies only if we have tokens
    response.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    response.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    return { 
      user: result.user,
      sessionId: result.sessionId 
    };
  }


@Post('refresh')
@HttpCode(HttpStatus.OK)
async refresh(
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response
) {
  const refreshToken = request.cookies['refresh_token'];
  if (!refreshToken) {
    throw new UnauthorizedException('No refresh token');
  }

  const result = await this.authService.refreshToken(refreshToken);
  
  response.cookie('access_token', result.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(Date.now() + 15 * 60 * 1000)
  });

  return { message: 'Token refreshed' };
}

  @Post('sessions/cleanup')
  @UseGuards(JwtAuthGuard)
  async cleanupOldSessions(
    @Req() req: Request & { user: any },
    @Body('maxAgeDays') maxAgeDays?: number,
  ) {
    const cleanedCount = await this.sessionService.cleanupOldSessions(
      req.user.id,
      maxAgeDays,
    );
    return {
      message: `Cleaned up ${cleanedCount} old sessions`,
      remainingSessions: await this.sessionService.getUserSessions(req.user.id),
    };
  }

  @Delete('sessions/others')
  @UseGuards(JwtAuthGuard)
  async logoutOtherSessions(
    @Req() req: Request & { user: any },
    @Headers('session-id') currentSessionId: string,
  ) {
    const logoutCount = await this.sessionService.forceLogoutOtherSessions(
      req.user.id,
      currentSessionId,
    );
    return {
      message: `Logged out from ${logoutCount} other sessions`,
      currentSession: currentSessionId,
    };
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
    const { ...user } = req.user;
    user.password = '********';
    return user;
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setup2FA(@Req() req: Request & { user: any }) {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2FA(
    @Req() req: Request & { user: any },
    @Body() body: Enable2FADto,
  ) {
    const isValid = await this.twoFactorService.verifyToken(
      req.user.id,
      body.token,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }
    await this.twoFactorService.enable2FA(req.user.id);
    return { message: '2FA enabled successfully' };
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  async verify2FA(
    @Req() req: Request & { user: any },
    @Body() body: Verify2FADto,
  ) {
    const isValid = await this.twoFactorService.verifyToken(
      req.user.id,
      body.token,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }
    return { message: '2FA verification successful' };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2FA(@Req() req: Request & { user: any }) {
    await this.twoFactorService.disable2FA(req.user.id);
    return { message: '2FA disabled successfully' };
  }
}
