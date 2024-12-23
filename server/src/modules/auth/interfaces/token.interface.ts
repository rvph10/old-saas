export interface TokenPayload {
  sub: string;
  email?: string;
  username?: string;
  type?: string;
  deviceId?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface TokenMetadata {
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  previousToken?: string;
}

export interface RefreshTokenFamily {
  id: string;
  family: string;
  token: string;
  successive: boolean;
}
