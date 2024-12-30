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
  LoggerService,
  Logger,
} from '@nestjs/common';
import {
  AuthService,
  CsrfService,
  DeviceService,
  TwoFactorService,
} from '../services';
import { SessionService } from '@modules/session/services';
import { PerformanceService } from '@infrastructure/monitoring/performance.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, SessionGuard } from '../guards';
import {
  Enable2FADto,
  LoginDto,
  RegisterDto,
  RequestResetDto,
  ResendVerificationDto,
  ResetPasswordDto,
  Verify2FADto,
  VerifyEmailDto,
} from '../dto';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { LoginResponse } from '../interfaces';
import { CookieOptions, Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private performanceService: PerformanceService,
    private deviceService: DeviceService,
    private twoFactorService: TwoFactorService,
    private jwtService: JwtService,
    private csrfService: CsrfService,
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
  async register(
    @Body() registerDto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.register(registerDto, response);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(
      {
        loginDto,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
      },
      response,
    );

    if (result.sessionId) {
      const csrfToken = await this.csrfService.generateToken(result.sessionId);
      response.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }

    return result;
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
    @Res({ passthrough: true }) response: Response,
  ) {
    const logoutCount = await this.sessionService.forceLogoutOtherSessions(
      req.user.id,
      currentSessionId,
      response,
    );
    return {
      message: `Logged out from ${logoutCount} other sessions`,
      currentSession: currentSessionId,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Headers('session-id') sessionId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(sessionId, response);
    return { message: 'Logged out successfully' };
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  async requestPasswordReset(@Body() resetDto: RequestResetDto) {
    return this.authService.requestPasswordReset(resetDto.email);
  }

  @Post('password-reset/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetDto: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.resetPassword(resetDto, response);
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
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.userId !== req.user.id) {
      throw new UnauthorizedException('Unauthorized to terminate this session');
    }

    await this.sessionService.destroySession(sessionId);
    response.clearCookie('auth_token', this.cookieOptions);
    return { message: 'Session terminated successfully' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async terminateAllSessions(
    @Headers('session-id') currentSessionId: string,
    @Req() req: Request & { user: any },
    @Body() body: { keepCurrentSession?: boolean },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logoutAllDevices(
      req.user.id,
      body.keepCurrentSession ? currentSessionId : undefined,
      response,
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
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.blockAccount(blockAccountId, response);
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

  @Get('csrf-token')
  @UseGuards(JwtAuthGuard)
  async getCsrfToken(
    @Headers('session-id') sessionId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.csrfService.generateToken(sessionId);

    response.cookie('csrf_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { csrfToken: token };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
    return this.authService.refreshToken(refreshToken, response);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2FA(
    @Req() req: Request & { user: any },
    @Body() body: Enable2FADto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const isValid = await this.twoFactorService.verifyToken(
      req.user.id,
      body.token,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }
    await this.twoFactorService.enable2FA(req.user.id);

    // Clear existing cookie as we'll require 2FA now
    response.clearCookie('auth_token', this.cookieOptions);

    return { message: '2FA enabled successfully' };
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  async verify2FA(
    @Req() req: Request & { user: any },
    @Body() body: Verify2FADto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const isValid = await this.twoFactorService.verifyToken(
      req.user.id,
      body.token,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    // Generate new token after successful 2FA
    const token = this.jwtService.sign({
      sub: req.user.id,
      username: req.user.username,
      email: req.user.email,
      twoFactorAuthenticated: true,
    });

    response.cookie('auth_token', token, this.cookieOptions);
    return { message: '2FA verification successful' };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2FA(@Req() req: Request & { user: any }) {
    await this.twoFactorService.disable2FA(req.user.id);
    return { message: '2FA disabled successfully' };
  }
}
