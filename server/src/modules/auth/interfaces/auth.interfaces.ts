import { LoginDto } from '../dto/login.dto';

export interface LoginResponse {
  user?: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  sessionId?: string;
  requires2FA?: boolean;
  tempToken?: string;
}

export interface SessionOptions {
  maxSessions?: number;
  forceLogoutOthers?: boolean;
}

export interface LoginParams {
  loginDto: LoginDto;
  ipAddress: string;
  userAgent: string;
  sessionOptions?: SessionOptions;
}
