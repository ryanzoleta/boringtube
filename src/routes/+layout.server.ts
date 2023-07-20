import type { RequestEvent } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getAccount, getUser, updateAccountRefreshToken } from '$lib/data/queries';
import type { Session } from '@auth/core/types';
import type { User } from '.prisma/client';
import moment from 'moment';
import { env } from '$env/dynamic/private';
import axios from 'axios';

export const load: LayoutServerLoad = async ({ locals }: RequestEvent) => {
  const session = await locals.getSession();

  if (session) {
    const user = await getUser(session as Session);
    const account = await getAccount(user as User);

    if (account?.expires_at) {
      const tokenExpiry = moment(account?.expires_at * 1000);
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

  return {
    session
  };
};
