import { SessionService } from '@modules/session/services';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private sessionService: SessionService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();

      // Check both headers and cookies for session ID
      const sessionId =
        request.headers['session-id'] || request.cookies['session_id'];

      if (!sessionId) {
        throw new UnauthorizedException('No session ID provided');
      }

      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        throw new UnauthorizedException('Invalid session');
      }

      // Then check access token
      const accessToken = request.cookies?.access_token;
      if (!accessToken) {
        throw new UnauthorizedException('No access token found');
      }

      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
