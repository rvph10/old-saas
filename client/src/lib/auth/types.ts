import 'next-auth';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    sessionId?: string;
    user: UserProfile;
  }

  interface User extends UserProfile {
    accessToken?: string;
    sessionId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    sessionId?: string;
    userId?: string;
  }
}