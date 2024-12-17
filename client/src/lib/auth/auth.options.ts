import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { apiClient } from '@/lib/http/api-client';
import { LoginResponse } from '@/lib/http/types';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const response = await apiClient.post<LoginResponse>('/auth/login', {
            username: credentials?.username,
            password: credentials?.password,
          });

          if (response.access_token) {
            return {
              id: response.user.id,
              email: response.user.email,
              username: response.user.username,
              accessToken: response.access_token,
              sessionId: response.sessionId,
            };
          }
          return null;
        } catch (error: unknown) {
          if (error instanceof Error) {
            throw new Error(error.message);
          }
          throw new Error('An unexpected error occurred');
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.sessionId = user.sessionId;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken;
        session.sessionId = token.sessionId;
        if (session.user) {
          session.user.id = token.userId as string;
        }
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  events: {
    async signOut({ session, token }) {
      try {
        if (session?.sessionId) {
          await apiClient.post('/auth/logout', {}, {
            headers: {
              'session-id': session.sessionId,
            },
          });
        }
      } catch (error) {
        console.error('Error during signOut:', error);
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};