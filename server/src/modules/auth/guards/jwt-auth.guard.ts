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
      
      // First check session
      const sessionId = request.headers['session-id'];
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

      const result = (await super.canActivate(context)) as boolean;
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException('Please log in to access this resource');
    }
    return user;
  }
}
