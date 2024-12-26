import { Controller, Post, UseGuards } from '@nestjs/common';
import { SessionCleanupService } from './services/session-cleanup.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionCleanupService: SessionCleanupService) {}

  @Post('cleanup')
  @UseGuards(JwtAuthGuard)
  async forceCleanup() {
    return this.sessionCleanupService.forceCleanup();
  }
}