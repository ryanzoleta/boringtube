import { SvelteKitAuth } from '@auth/sveltekit';
import GoogleProvider from '@auth/core/providers/google';
import { env } from '$env/dynamic/private';
import type { Provider } from '@auth/core/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '$lib/data/prisma';
import { getAccount, updateAccountRefreshToken } from '$lib/data/queries';
import moment from 'moment';
import axios from 'axios';

export const handle = SvelteKitAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }) as Provider
  ],
  pages: {
    error: '/signup/error'
  },
  cookies: {
    pkceCodeVerifier: {
      name: 'sveltekit-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true
      }
    }
  },
  callbacks: {
    async session({ session, user }) {
      if (user.id) {
        const account = await getAccount(user.id);

        if (account?.expires_at) {
          const tokenExpiry = moment(account?.expires_at * 1000).subtract(5, 'minutes');
          const now = moment();

          if (now.isAfter(tokenExpiry)) {
            const data = {
              refresh_token: account?.refresh_token,
              client_id: env.GOOGLE_CLIENT_ID,
              client_secret: env.GOOGLE_CLIENT_SECRET,
              grant_type: 'refresh_token'
            };

            const response = await axios.post('https://oauth2.googleapis.com/token', data);

            const accessToken = response.data.access_token;
            const expiresAt = Math.floor(Date.now() / 1000 + response.data.expires_in);

            await updateAccountRefreshToken(account.id, accessToken, expiresAt);
          }
        }
      }
      return session;
    }
  }
});
